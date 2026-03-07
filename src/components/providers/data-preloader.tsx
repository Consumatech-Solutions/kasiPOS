'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { catalogueApi } from '@/lib/api/catalogue';
import { customersApi } from '@/lib/api/customers';
import { vouchersApi } from '@/lib/api/vouchers';
import { mutationQueue } from '@/lib/mutation-queue';
import { saveProductsToDexie, saveCustomersToDexie, saveCategoriesToDexie, getLastSyncAt, setLastSyncAt, getProductsFromDexie, getCategoriesFromDexie, getCustomersFromDexie } from '@/lib/entity-cache';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/components/settings-provider';
import { checkOfflineStatus } from '@/lib/offline-detector';
import { getPageRoutesToPreload } from '@/lib/page-routes';

// Define query keys locally to avoid circular imports from hooks
const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: { page?: number; limit?: number }) => [...productKeys.lists(), filters] as const,
};

const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (filters: { page?: number; limit?: number }) => [...categoryKeys.lists(), filters] as const,
};

const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters?: { page?: number; limit?: number; search?: string }) => [...customerKeys.lists(), filters] as const,
};

const voucherKeys = {
  all: ['vouchers'] as const,
  lists: () => [...voucherKeys.all, 'list'] as const,
  list: (filters?: { page?: number; limit?: number; isActive?: boolean }) => [...voucherKeys.lists(), filters] as const,
};

const PRELOAD_VERSION_KEY = 'kasipos-preload-version';
const PRELOAD_TIMESTAMP_KEY = 'kasipos-preload-timestamp';
const APP_PRELOAD_VERSION = 'kasipos-v4'; // Match CACHE_VERSION in public/sw.js

/**
 * Wait for service worker to be ready and installed
 */
async function waitForServiceWorkerReady(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    // Wait for service worker registration
    const registration = await navigator.serviceWorker.ready;
    
    // Check if service worker is actually controlling the page
    if (navigator.serviceWorker.controller) {
      // Service worker is active, wait a bit for install to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    } else {
      // Service worker is registered but not controlling yet
      // Wait for it to activate
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000);
        
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          clearTimeout(timeout);
          setTimeout(() => resolve(true), 500);
        }, { once: true });
      });
    }
  } catch (error) {
    console.warn('[DataPreloader] Service worker not available:', error);
    return false;
  }
}

/**
 * Verify that all service worker precache assets are cached
 * This prevents the "You are offline" page from showing
 * Retries up to 5 times with delays to wait for service worker to cache assets
 */
/**
 * Manually cache an asset if it's missing
 */
async function ensureAssetCached(cache: Cache, asset: string): Promise<boolean> {
  try {
    const cached = await cache.match(asset);
    if (cached) {
      return true;
    }

    // Try to fetch and cache the asset
    const response = await fetch(asset);
    if (response.ok) {
      await cache.put(asset, response.clone());
      console.log(`[DataPreloader] Manually cached missing asset: ${asset}`);
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[DataPreloader] Could not cache asset ${asset}:`, error);
    return false;
  }
}

async function verifyServiceWorkerCache(maxRetries: number = 5, retryDelay: number = 1000): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return false;
  }

  // Wait for service worker to be ready first
  const swReady = await waitForServiceWorkerReady();
  if (!swReady) {
    console.warn('[DataPreloader] Service worker not ready - cache verification may be incomplete');
  }

  // PRECACHE_ASSETS from public/sw.js - all are required except /offline which might not exist
  const REQUIRED_ASSETS = [
    '/',
    '/manifest.json',
  ];
  const OPTIONAL_ASSETS = [
    '/offline', // Offline fallback page (if exists)
  ];

  const CACHE_NAME = 'kasipos-cache-kasipos-v4'; // Must match CACHE_NAME in sw.js

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const cache = await caches.open(CACHE_NAME);

      // Check if all required precache assets are in the cache
      let allRequiredCached = true;
      const missingAssets: string[] = [];

      for (const asset of REQUIRED_ASSETS) {
        const cached = await cache.match(asset);
        if (!cached) {
          missingAssets.push(asset);
          allRequiredCached = false;
        }
      }

      if (allRequiredCached) {
        // Check optional assets (log but don't fail)
        for (const asset of OPTIONAL_ASSETS) {
          const cached = await cache.match(asset);
          if (!cached) {
            console.log(`[DataPreloader] Optional asset not cached: ${asset} (this is OK)`);
          }
        }

        console.log('[DataPreloader] All required service worker assets are cached');
        return true;
      } else {
        // On last attempt, try to manually cache missing assets
        if (attempt === maxRetries - 1) {
          console.log('[DataPreloader] Attempting to manually cache missing assets...');
          let allManuallyCached = true;
          
          for (const asset of missingAssets) {
            const cached = await ensureAssetCached(cache, asset);
            if (!cached) {
              allManuallyCached = false;
            }
          }

          if (allManuallyCached) {
            console.log('[DataPreloader] Successfully manually cached all missing assets');
            return true;
          }
        }

        if (attempt < maxRetries - 1) {
          console.log(
            `[DataPreloader] Waiting for assets to be cached (attempt ${attempt + 1}/${maxRetries}):`,
            missingAssets.join(', ')
          );
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          console.warn(
            `[DataPreloader] Some required assets not cached after ${maxRetries} attempts:`,
            missingAssets.join(', ')
          );
          // If service worker is active, we can still return true as it will cache on demand
          if (swReady && navigator.serviceWorker.controller) {
            console.log('[DataPreloader] Service worker is active - assets will be cached on demand');
            return true;
          }
          return false;
        }
      }
    } catch (error) {
      console.error('[DataPreloader] Error verifying service worker cache:', error);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        // If service worker is active, we can still return true
        if (swReady && navigator.serviceWorker.controller) {
          console.log('[DataPreloader] Service worker is active - cache errors are non-critical');
          return true;
        }
        return false;
      }
    }
  }

  return false;
}

/**
 * DataPreloader - Prefetches essential data on app startup for offline availability
 * 
 * This component runs prefetch queries for:
 * - Products (first 100)
 * - Categories (first 50)
 * - Customers (first 50)
 * - Active vouchers (first 50)
 * 
 * The prefetched data is stored in TanStack Query cache and persisted to IndexedDB,
 * making it available even when the app goes offline.
 */
export function DataPreloader() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { settings } = useSettings();

  useEffect(() => {
    // Skip preloading if user is not logged in
    if (!settings.isLoggedIn) {
      console.log('[DataPreloader] User not logged in - skipping preload');
      return;
    }

    // Only prefetch when online to avoid errors
    if (typeof window === 'undefined') {
      return;
    }

    // Check if we're actually online using enhanced detector
    checkOfflineStatus().then((isOffline) => {
      if (isOffline) {
        console.log('[DataPreloader] Offline - skipping preload');
        return;
      }

      startPreloading();
    });

    async function startPreloading() {
      // Determine if we need full preload (pages + data) or incremental data sync only
      const cacheVerified = await verifyServiceWorkerCache();
      const storedVersion = typeof localStorage !== 'undefined' ? localStorage.getItem(PRELOAD_VERSION_KEY) : null;
      const needsFullPreload = !cacheVerified || storedVersion !== APP_PRELOAD_VERSION;

      if (needsFullPreload) {
        console.log('[DataPreloader] Full preload: cache empty or app version changed');
      } else {
        console.log('[DataPreloader] Incremental sync: cache valid, skipping page preload');
      }

      const pagesToPreload = getPageRoutesToPreload(settings.isLoggedIn);
      const dataQueryCount = 4; // products, categories, customers, vouchers
      const pagePreloadCount = needsFullPreload ? pagesToPreload.length : 0;
      const totalItems = dataQueryCount + pagePreloadCount;
      
      let completed = 0;
      mutationQueue.setPreloadProgress(completed, totalItems);

      const updateProgress = async () => {
        completed++;
        mutationQueue.setPreloadProgress(completed, totalItems);
        
        // When all complete, verify cache and show toast
        if (completed >= totalItems) {
          // Ensure cache is verified (may have been done earlier for conditional preload)
          const finalCacheVerified = cacheVerified ?? (await verifyServiceWorkerCache());
          
          // Store version and timestamp after successful preload
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PRELOAD_VERSION_KEY, APP_PRELOAD_VERSION);
            localStorage.setItem(PRELOAD_TIMESTAMP_KEY, String(Date.now()));
          }
          
          // Only show toast if:
          // 1. All data queries and pages are complete
          // 2. Service worker cache is verified (all assets cached)
          // 3. User is still logged in
          if (finalCacheVerified && settings.isLoggedIn) {
            setTimeout(() => {
              mutationQueue.setPreloadProgress(totalItems, totalItems);
              toast({
                title: "Offline Mode Ready!",
                description: needsFullPreload
                  ? `All data and ${pagesToPreload.length} pages have been downloaded. You can now work offline`
                  : 'Data synced. You can work offline.',
                duration: 5000,
              });
            }, 500);
          } else {
            if (!finalCacheVerified) {
              console.warn(
                '[DataPreloader] Service worker cache not complete - offline mode not fully ready. ' +
                'The "You are offline" page may still appear. Assets will be cached on next page load.'
              );
            }
            // Reset preload status even if cache isn't verified
            mutationQueue.setPreloadProgress(totalItems, totalItems);
          }
        }
      };

      /**
       * Preload a single page by loading it in a hidden iframe.
       * This triggers the browser to request the document and all its script/style chunks,
       * which the service worker will cache for full offline support.
       */
      async function preloadPage(route: string): Promise<void> {
        const timeout = 10000; // 10s max per page
        return new Promise((resolve) => {
          const iframe = document.createElement('iframe');
          iframe.setAttribute('aria-hidden', 'true');
          iframe.style.position = 'absolute';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = 'none';
          iframe.style.visibility = 'hidden';
          iframe.style.pointerEvents = 'none';
          const done = () => {
            try {
              if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            } catch {
              // ignore
            }
            resolve();
          };
          const t = setTimeout(done, timeout);
          iframe.onload = () => {
            clearTimeout(t);
            setTimeout(done, 500); // Allow subresources to be requested
          };
          iframe.onerror = done;
          iframe.src = route;
          document.body.appendChild(iframe);
        });
      }

      /**
       * Preload pages in batches to avoid overwhelming the network
       */
      async function preloadPagesInBatches(routes: string[], batchSize: number = 3): Promise<void> {
        for (let i = 0; i < routes.length; i += batchSize) {
          const batch = routes.slice(i, i + batchSize);
          console.log(`[DataPreloader] Preloading page batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(routes.length / batchSize)}:`, batch);
          
          // Preload batch in parallel
          await Promise.allSettled(
            batch.map(route => preloadPage(route).then(() => updateProgress()).catch(() => updateProgress()))
          );
          
          // Small delay between batches to avoid overwhelming the network
          if (i + batchSize < routes.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }

    // Prefetch products - incremental sync if lastSyncAt exists
    queryClient.prefetchQuery({
      queryKey: productKeys.list({ page: 1, limit: 100 }),
      queryFn: async () => {
        const lastSync = await getLastSyncAt('products');
        const params: { page: number; limit: number; updatedAtAfter?: string } = { page: 1, limit: 100 };
        if (lastSync) params.updatedAtAfter = lastSync;
        const response = await catalogueApi.products.getAll(params);
        const delta = 'data' in response && response.data ? response.data : Array.isArray(response) ? response : [];
        if (delta.length) await saveProductsToDexie(delta);
        await setLastSyncAt('products', new Date().toISOString());
        const result = lastSync ? await getProductsFromDexie(1, 100) : { data: delta, meta: 'meta' in response && response.meta ? response.meta : { total: delta.length, page: 1, limit: 100, totalPages: 1 } };
        return result;
      },
      staleTime: 30 * 60 * 1000, // 30 minutes
    }).then(() => updateProgress()).catch(() => updateProgress());

    // Prefetch categories - incremental sync if lastSyncAt exists
    queryClient.prefetchQuery({
      queryKey: categoryKeys.list({ page: 1, limit: 50 }),
      queryFn: async () => {
        const lastSync = await getLastSyncAt('categories');
        const params: { page: number; limit: number; updatedAtAfter?: string } = { page: 1, limit: 50 };
        if (lastSync) params.updatedAtAfter = lastSync;
        const response = await catalogueApi.categories.getAll(params);
        const delta = ('data' in response && response.data) ? response.data : Array.isArray(response) ? response : [];
        if (delta.length) await saveCategoriesToDexie(delta);
        await setLastSyncAt('categories', new Date().toISOString());
        const result = lastSync ? await getCategoriesFromDexie(1, 50) : { data: delta, meta: ('meta' in response && response.meta) ? response.meta : { total: delta.length, page: 1, limit: 50, totalPages: 1 } };
        return result;
      },
      staleTime: 30 * 60 * 1000,
    }).then(() => updateProgress()).catch(() => updateProgress());

    // Prefetch customers - incremental sync if lastSyncAt exists
    queryClient.prefetchQuery({
      queryKey: customerKeys.list({ page: 1, limit: 50 }),
      queryFn: async () => {
        const lastSync = await getLastSyncAt('customers');
        const params: { page: number; limit: number; updatedAtAfter?: string } = { page: 1, limit: 50 };
        if (lastSync) params.updatedAtAfter = lastSync;
        const response = await customersApi.getAll(params);
        const responseData = response.data;
        const delta = responseData && 'data' in responseData ? responseData.data : Array.isArray(responseData) ? responseData : [];
        if (delta.length) await saveCustomersToDexie(delta);
        await setLastSyncAt('customers', new Date().toISOString());
        const result = lastSync ? await getCustomersFromDexie(1, 50) : { data: delta, meta: responseData && 'meta' in responseData ? responseData.meta : { total: delta.length, page: 1, limit: 50, totalPages: 1 } };
        return result;
      },
      staleTime: 30 * 60 * 1000,
    }).then(() => updateProgress()).catch(() => updateProgress());

    // Prefetch active vouchers/campaigns
    queryClient.prefetchQuery({
      queryKey: voucherKeys.list({ page: 1, limit: 50, isActive: true }),
      queryFn: async () => {
        const response = await vouchersApi.getAll({ page: 1, limit: 50, isActive: true });
        const responseData = response.data;
        // Normalize response
        if (responseData && 'data' in responseData && 'meta' in responseData) {
          return responseData;
        }
        const data = Array.isArray(responseData) ? responseData : [];
        return {
          data,
          meta: { total: data.length, page: 1, limit: 50, totalPages: 1 },
        };
      },
      staleTime: 30 * 60 * 1000,
    }).then(() => updateProgress()).catch(() => updateProgress());

    // Only preload pages when full preload is needed (cache empty or app version changed)
    if (needsFullPreload && pagesToPreload.length > 0) {
      setTimeout(async () => {
        console.log(`[DataPreloader] Starting to preload ${pagesToPreload.length} pages (iframe)...`);
        await preloadPagesInBatches(pagesToPreload, 2);
        console.log('[DataPreloader] All pages preloaded');
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'PRECACHE_URLS', urls: pagesToPreload });
        }
      }, 1000); // Small delay to let data queries start first
    }
    }
  }, [queryClient, toast, settings.isLoggedIn]);

  // This component renders nothing - it only prefetches data
  return null;
}
