"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mutationQueue } from "@/lib/mutation-queue";
import {
  runCloudDataPull,
  getNextDueScheduledSyncSlotId,
  markScheduledSyncSlotComplete,
  CLOUD_SYNC_LOCAL_HOURS,
} from "@/lib/cloud-data-pull";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/components/settings-provider";
import { offlineDetector } from "@/lib/offline-detector";
import { getPageRoutesToPreload } from "@/lib/page-routes";
import { purgeUnscopedCatalogueCacheOnce } from "@/lib/entity-cache";
import { productKeys, categoryKeys } from "@/hooks/use-catalogue";

const PRELOAD_VERSION_KEY = "kasipos-preload-version";
const PRELOAD_TIMESTAMP_KEY = "kasipos-preload-timestamp";
const APP_PRELOAD_VERSION = "kasipos-v4";

async function waitForServiceWorkerReady(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    if (navigator.serviceWorker.controller) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return true;
    } else {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000);

        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            clearTimeout(timeout);
            setTimeout(() => resolve(true), 500);
          },
          { once: true },
        );
      });
    }
  } catch (error) {
    console.warn("[DataPreloader] Service worker not available:", error);
    return false;
  }
}

async function ensureAssetCached(
  cache: Cache,
  asset: string,
): Promise<boolean> {
  try {
    const cached = await cache.match(asset);
    if (cached) {
      return true;
    }

    const response = await fetch(asset);
    if (response.ok) {
      await cache.put(asset, response.clone());
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[DataPreloader] Could not cache asset ${asset}:`, error);
    return false;
  }
}

async function verifyServiceWorkerCache(
  maxRetries: number = 5,
  retryDelay: number = 1000,
): Promise<boolean> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return false;
  }

  const swReady = await waitForServiceWorkerReady();
  if (!swReady) {
    console.log(
      "[DataPreloader] Service worker not ready yet - cache verification may complete on next load",
    );
  }

  const REQUIRED_ASSETS = ["/", "/manifest.json"];
  const OPTIONAL_ASSETS = ["/offline"];

  const CACHE_NAME = "kasipos-cache-kasipos-v4";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const cache = await caches.open(CACHE_NAME);

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
        for (const asset of OPTIONAL_ASSETS) {
          await cache.match(asset);
        }

        return true;
      } else {
        if (attempt === maxRetries - 1) {
          let allManuallyCached = true;

          for (const asset of missingAssets) {
            const cached = await ensureAssetCached(cache, asset);
            if (!cached) {
              allManuallyCached = false;
            }
          }

          if (allManuallyCached) {
            return true;
          }
        }

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          if (swReady && navigator.serviceWorker.controller) {
            return true;
          }
          return false;
        }
      }
    } catch (error) {
      console.error(
        "[DataPreloader] Error verifying service worker cache:",
        error,
      );
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        if (swReady && navigator.serviceWorker.controller) {
          return true;
        }
        return false;
      }
    }
  }

  return false;
}

export function DataPreloader() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { settings } = useSettings();
  const syncBusyRef = useRef(false);
  const isCypressRuntime =
    typeof window !== "undefined" &&
    Boolean((window as Window & { Cypress?: unknown }).Cypress);

  useEffect(() => {
    if (!settings.isLoggedIn) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    const storeId = settings?.currentStore?.id ?? undefined;

    if (storeId) {
      void purgeUnscopedCatalogueCacheOnce(String(storeId)).then((result) => {
        if (
          !result ||
          (result.productsRemoved === 0 && result.categoriesRemoved === 0)
        )
          return;
        void queryClient.invalidateQueries({ queryKey: productKeys.all });
        void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      });
    }

    const tickScheduledSync = async () => {
      if (cancelled || !settings.isLoggedIn || syncBusyRef.current) return;
      const slotId = getNextDueScheduledSyncSlotId();
      if (!slotId) return;
      const hasConnectivity = await offlineDetector.forceCheck();
      if (!hasConnectivity) return;
      syncBusyRef.current = true;
      try {
        offlineDetector.setOfflineFirstActive(false);
        await mutationQueue.processQueue({ force: true });
        await runCloudDataPull({
          queryClient,
          storeId,
        });
        markScheduledSyncSlotComplete(slotId);
      } catch (e) {
        console.error("[DataPreloader] Scheduled cloud sync failed:", e);
      } finally {
        if (!isCypressRuntime) {
          offlineDetector.setOfflineFirstActive(true);
        }
        syncBusyRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void tickScheduledSync();
    }, 45_000);

    if (!isCypressRuntime) {
      offlineDetector.setOfflineFirstActive(true);
    }

    if (!cancelled) {
      void startPreloading();
    }

    async function startPreloading() {
      const cacheVerified = isCypressRuntime
        ? true
        : await verifyServiceWorkerCache();
      const storedVersion =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(PRELOAD_VERSION_KEY)
          : null;
      const needsFullPreload =
        !cacheVerified || storedVersion !== APP_PRELOAD_VERSION;

      const pagesToPreload = getPageRoutesToPreload(settings.isLoggedIn);
      const pagePreloadCount = needsFullPreload ? pagesToPreload.length : 0;
      const totalItems = pagePreloadCount;

      let completed = 0;
      if (totalItems > 0) {
        mutationQueue.setPreloadProgress(completed, totalItems);
      }

      const updateProgress = async () => {
        completed++;
        mutationQueue.setPreloadProgress(completed, totalItems);

        if (completed >= totalItems) {
          const finalCacheVerified =
            cacheVerified ?? (await verifyServiceWorkerCache());

          if (typeof localStorage !== "undefined") {
            localStorage.setItem(PRELOAD_VERSION_KEY, APP_PRELOAD_VERSION);
            localStorage.setItem(PRELOAD_TIMESTAMP_KEY, String(Date.now()));
          }

          if (finalCacheVerified && settings.isLoggedIn) {
            setTimeout(() => {
              mutationQueue.setPreloadProgress(totalItems, totalItems);
              toast({
                title: "Offline mode ready",
                description: needsFullPreload
                  ? `Essential data and ${pagesToPreload.length} pages are cached. You can work offline.`
                  : "Local data is ready. Cloud updates run at 6:00, 12:00, and 18:00 (or use Sync → Download from cloud).",
                duration: 6000,
              });
            }, 500);
          } else {
            mutationQueue.setPreloadProgress(totalItems, totalItems);
          }
        }
      };

      async function preloadPage(route: string): Promise<void> {
        const timeout = 10000;
        return new Promise((resolve) => {
          const iframe = document.createElement("iframe");
          iframe.setAttribute("aria-hidden", "true");
          iframe.style.position = "absolute";
          iframe.style.width = "0";
          iframe.style.height = "0";
          iframe.style.border = "none";
          iframe.style.visibility = "hidden";
          iframe.style.pointerEvents = "none";
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

      async function preloadPagesInBatches(
        routes: string[],
        batchSize: number = 3,
      ): Promise<void> {
        for (let i = 0; i < routes.length; i += batchSize) {
          const batch = routes.slice(i, i + batchSize);

          await Promise.allSettled(
            batch.map((route) =>
              preloadPage(route)
                .then(() => updateProgress())
                .catch(() => updateProgress()),
            ),
          );

          if (i + batchSize < routes.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      }

      if (needsFullPreload && pagesToPreload.length > 0) {
        setTimeout(async () => {
          if (cancelled) return;
          await preloadPagesInBatches(pagesToPreload, 2);
          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: "PRECACHE_URLS",
              urls: pagesToPreload,
            });
          }
        }, 1000);
      } else {
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
