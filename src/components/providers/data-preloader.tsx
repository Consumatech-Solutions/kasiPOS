'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { catalogueApi } from '@/lib/api/catalogue';
import { customersApi } from '@/lib/api/customers';
import { vouchersApi } from '@/lib/api/vouchers';
import { mutationQueue } from '@/lib/mutation-queue';
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
    '/favicon.ico',
  ];
  const OPTIONAL_ASSETS = [
    '/offline', // Offline fallback page (if exists)
  ];

  const CACHE_NAME = 'kasipos-cache-v3'; // Must match CACHE_NAME in sw.js

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
      console.log('[DataPreloader] Prefetching essential data and pages for offline use...');
      
      // Get pages to preload based on login status
      const pagesToPreload = getPageRoutesToPreload(settings.isLoggedIn);
      const dataQueryCount = 4; // products, categories, customers, vouchers
      const totalItems = dataQueryCount + pagesToPreload.length;
      
      let completed = 0;
      mutationQueue.setPreloadProgress(completed, totalItems);

      const updateProgress = async () => {
        completed++;
        mutationQueue.setPreloadProgress(completed, totalItems);
        
        // When all complete, verify cache and show toast
        if (completed >= totalItems) {
          // Verify service worker cache before showing ready message
          // This ensures all assets are cached to prevent "You are offline" page
          const cacheVerified = await verifyServiceWorkerCache();
          
          // Only show toast if:
          // 1. All data queries and pages are complete
          // 2. Service worker cache is verified (all assets cached)
          // 3. User is still logged in
          if (cacheVerified && settings.isLoggedIn) {
            setTimeout(() => {
              mutationQueue.setPreloadProgress(totalItems, totalItems);
              toast({
                title: "Offline Mode Ready!",
                description: `All data and ${pagesToPreload.length} pages have been downloaded. You can now work offline`,
                duration: 5000,
              });
            }, 500);
          } else {
            if (!cacheVerified) {
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
       * Preload a single page by fetching it
       * The service worker will automatically cache it
       */
      async function preloadPage(route: string): Promise<void> {
        try {
          // Fetch the page - service worker will cache it automatically
          const response = await fetch(route, {
            method: 'GET',
            cache: 'default', // Let service worker handle caching
          });
          
          if (response.ok) {
            // Read the response to ensure it's fully loaded
            await response.text();
            console.log(`[DataPreloader] Preloaded page: ${route}`);
          } else {
            console.warn(`[DataPreloader] Failed to preload page ${route}: ${response.status}`);
          }
        } catch (error) {
          console.warn(`[DataPreloader] Error preloading page ${route}:`, error);
          // Continue even if one page fails
        }
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

    // Prefetch products (first 100 for POS)
    queryClient.prefetchQuery({
      queryKey: productKeys.list({ page: 1, limit: 100 }),
      queryFn: async () => {
        const response = await catalogueApi.products.getAll({ page: 1, limit: 100 });
        // Normalize response to always have data/meta structure
        if ('data' in response && 'meta' in response) {
          return response;
        }
        const data = Array.isArray(response) ? response : [];
        return {
          data,
          meta: { total: data.length, page: 1, limit: 100, totalPages: 1 },
        };
      },
      staleTime: 30 * 60 * 1000, // 30 minutes
    }).then(() => updateProgress()).catch(() => updateProgress());

    // Prefetch categories
    queryClient.prefetchQuery({
      queryKey: categoryKeys.list({ page: 1, limit: 50 }),
      queryFn: async () => {
        const response = await catalogueApi.categories.getAll({ page: 1, limit: 50 });
        // Normalize response
        if ('data' in response && 'meta' in response) {
          return response;
        }
        const data = Array.isArray(response) ? response : [];
        return {
          data,
          meta: { total: data.length, page: 1, limit: 50, totalPages: 1 },
        };
      },
      staleTime: 30 * 60 * 1000,
    }).then(() => updateProgress()).catch(() => updateProgress());

    // Prefetch recent customers
    queryClient.prefetchQuery({
      queryKey: customerKeys.list({ page: 1, limit: 50 }),
      queryFn: async () => {
        const response = await customersApi.getAll({ page: 1, limit: 50 });
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

    // After all data queries complete, preload pages
    // Wait a bit for data queries to start, then begin page preloading
    setTimeout(async () => {
      if (pagesToPreload.length > 0) {
        console.log(`[DataPreloader] Starting to preload ${pagesToPreload.length} pages...`);
        await preloadPagesInBatches(pagesToPreload, 3);
        console.log('[DataPreloader] All pages preloaded');
      }
    }, 1000); // Small delay to let data queries start first
    }
  }, [queryClient, toast, settings.isLoggedIn]);

  // This component renders nothing - it only prefetches data
  return null;
}
