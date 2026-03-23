'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { mutationQueue } from '@/lib/mutation-queue';
import {
  runCloudDataPull,
  needsInitialCloudHydration,
  getCurrentScheduledSyncSlotId,
  markScheduledSyncSlotComplete,
  CLOUD_SYNC_LOCAL_HOURS,
} from '@/lib/cloud-data-pull';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/components/settings-provider';
import { checkOfflineStatus } from '@/lib/offline-detector';
import { getPageRoutesToPreload } from '@/lib/page-routes';

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

  // Wait for service worker to be ready first (non-blocking: we continue verification either way)
  const swReady = await waitForServiceWorkerReady();
  if (!swReady) {
    console.log('[DataPreloader] Service worker not ready yet - cache verification may complete on next load');
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
 * DataPreloader — offline shell + cloud sync scheduling
 *
 * - First-time cloud hydration runs once when online (upload queue, then download catalogue data).
 * - Further uploads run at local hours 6, 12, and 18 (and as soon as possible after reconnecting).
 * - Downloads from the cloud run on the same schedule, or anytime via the sync modal (manual pull).
 */
export function DataPreloader() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { settings } = useSettings();
  const syncBusyRef = useRef(false);

  useEffect(() => {
    if (!settings.isLoggedIn) {
      console.log('[DataPreloader] User not logged in - skipping preload');
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    let cancelled = false;
    const storeId = settings?.currentStore?.id ?? undefined;

    const tickScheduledSync = async () => {
      if (cancelled || !settings.isLoggedIn || syncBusyRef.current) return;
      const offline = await checkOfflineStatus();
      if (offline) return;
      const slotId = getCurrentScheduledSyncSlotId();
      if (!slotId) return;
      syncBusyRef.current = true;
      try {
        await mutationQueue.processQueue();
        await runCloudDataPull({
          queryClient,
          storeId,
        });
        markScheduledSyncSlotComplete(slotId);
        console.log('[DataPreloader] Scheduled cloud sync completed (local hours ' + CLOUD_SYNC_LOCAL_HOURS.join(', ') + ')');
      } catch (e) {
        console.error('[DataPreloader] Scheduled cloud sync failed:', e);
      } finally {
        syncBusyRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void tickScheduledSync();
    }, 45_000);
    void tickScheduledSync();

    checkOfflineStatus().then((isOffline) => {
      if (isOffline || cancelled) {
        console.log('[DataPreloader] Offline - skipping bootstrap preload');
        return;
      }

      void startPreloading();
    });

    async function startPreloading() {
      const cacheVerified = await verifyServiceWorkerCache();
      const storedVersion = typeof localStorage !== 'undefined' ? localStorage.getItem(PRELOAD_VERSION_KEY) : null;
      const needsFullPreload = !cacheVerified || storedVersion !== APP_PRELOAD_VERSION;

      if (needsFullPreload) {
        console.log('[DataPreloader] Full preload: cache empty or app version changed');
      } else {
        console.log('[DataPreloader] App shell OK - cloud data loads on schedule or manually');
      }

      const pagesToPreload = getPageRoutesToPreload(settings.isLoggedIn);
      const pagePreloadCount = needsFullPreload ? pagesToPreload.length : 0;
      const needsFirstCloudPull = await needsInitialCloudHydration();
      const cloudStepCount = needsFirstCloudPull ? 1 : 0;
      const totalItems = cloudStepCount + pagePreloadCount;

      let completed = 0;
      if (totalItems > 0) {
        mutationQueue.setPreloadProgress(completed, totalItems);
      }

      const updateProgress = async () => {
        completed++;
        mutationQueue.setPreloadProgress(completed, totalItems);

        if (completed >= totalItems) {
          const finalCacheVerified = cacheVerified ?? (await verifyServiceWorkerCache());

          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PRELOAD_VERSION_KEY, APP_PRELOAD_VERSION);
            localStorage.setItem(PRELOAD_TIMESTAMP_KEY, String(Date.now()));
          }

          if (finalCacheVerified && settings.isLoggedIn) {
            setTimeout(() => {
              mutationQueue.setPreloadProgress(totalItems, totalItems);
              toast({
                title: 'Offline mode ready',
                description: needsFullPreload
                  ? `Essential data and ${pagesToPreload.length} pages are cached. You can work offline.`
                  : 'Local data is ready. Cloud updates run at 6:00, 12:00, and 18:00 (or use Sync → Download from cloud).',
                duration: 6000,
              });
            }, 500);
          } else {
            if (!finalCacheVerified) {
              console.warn(
                '[DataPreloader] Service worker cache not complete - offline mode not fully ready. ' +
                  'The offline fallback page may still appear until assets are cached.'
              );
            }
            mutationQueue.setPreloadProgress(totalItems, totalItems);
          }
        }
      };

      async function preloadPage(route: string): Promise<void> {
        const timeout = 10000;
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
            setTimeout(done, 500);
          };
          iframe.onerror = done;
          iframe.src = route;
          document.body.appendChild(iframe);
        });
      }

      async function preloadPagesInBatches(routes: string[], batchSize: number = 3): Promise<void> {
        for (let i = 0; i < routes.length; i += batchSize) {
          const batch = routes.slice(i, i + batchSize);
          console.log(
            `[DataPreloader] Preloading page batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(routes.length / batchSize)}:`,
            batch
          );

          await Promise.allSettled(
            batch.map((route) => preloadPage(route).then(() => updateProgress()).catch(() => updateProgress()))
          );

          if (i + batchSize < routes.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      }

      if (needsFirstCloudPull) {
        syncBusyRef.current = true;
        try {
          await mutationQueue.processQueue();
          await runCloudDataPull({ queryClient, storeId });
          const slotAfterInitial = getCurrentScheduledSyncSlotId();
          if (slotAfterInitial) {
            markScheduledSyncSlotComplete(slotAfterInitial);
          }
        } catch (e) {
          console.error('[DataPreloader] Initial cloud hydration failed:', e);
        } finally {
          syncBusyRef.current = false;
        }
        await updateProgress();
      }

      if (needsFullPreload && pagesToPreload.length > 0) {
        setTimeout(async () => {
          if (cancelled) return;
          console.log(`[DataPreloader] Starting to preload ${pagesToPreload.length} pages (iframe)...`);
          await preloadPagesInBatches(pagesToPreload, 2);
          console.log('[DataPreloader] All pages preloaded');
          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'PRECACHE_URLS', urls: pagesToPreload });
          }
        }, 1000);
      } else if (totalItems === 0) {
        mutationQueue.setPreloadProgress(0, 0);
      }
    }

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [queryClient, toast, settings.isLoggedIn, settings?.currentStore?.id]);

  return null;
}
