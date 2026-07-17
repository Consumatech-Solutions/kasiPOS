// Error handler for workbox-related errors (if any cached service workers try to use workbox)
self.addEventListener("error", (event) => {
  if (
    event.error &&
    event.error.message &&
    event.error.message.includes("_ref")
  ) {
    console.warn(
      "[Service Worker] Suppressed workbox error:",
      event.error.message
    );
    event.preventDefault();
  }
});

// Unhandled promise rejection handler
self.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason &&
    event.reason.message &&
    event.reason.message.includes("_ref")
  ) {
    console.warn(
      "[Service Worker] Suppressed workbox promise rejection:",
      event.reason.message
    );
    event.preventDefault();
  }
});

const CACHE_VERSION = "kasipos-v4";
const CACHE_NAME = `kasipos-cache-${CACHE_VERSION}`;
const RUNTIME_CACHE = "kasipos-runtime-cache";
const API_CACHE = "kasipos-api-cache";

// All page routes to precache (aligned with src/lib/page-routes.ts)
const PRECACHE_PAGES = [
  "/",
  "/dashboard",
  "/catalogue",
  "/customers",
  "/inventory",
  "/transactions",
  "/vouchers",
  "/reports",
  "/settings",
  "/profile",
  "/buy-stock",
  "/buy-stock/cart",
  "/buy-stock/history",
  "/marketplace",
  "/marketplace/orders",
  "/boph",
  "/store-setup",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/reset-password/verify",
  "/request-access",
  "/verify-code",
  "/set-password",
  "/offline",
  "/print-test",
];

// Assets to precache on install (manifest + all pages)
const PRECACHE_ASSETS = ["/manifest.json", ...PRECACHE_PAGES];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: "cache-first",
  NETWORK_FIRST: "network-first",
  STALE_WHILE_REVALIDATE: "stale-while-revalidate",
  NETWORK_ONLY: "network-only",
};

// Install event - precache assets
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...", CACHE_VERSION);

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Precaching assets");
        // Cache assets individually to handle missing files gracefully
        // This prevents one missing asset from failing the entire precache
        return Promise.allSettled(
          PRECACHE_ASSETS.map((url) => {
            return fetch(new Request(url, { cache: "reload" }))
              .then((response) => {
                if (response.ok) {
                  return cache.put(url, response);
                } else {
                  console.warn(
                    `[Service Worker] Failed to cache ${url}: ${response.status}`
                  );
                  return Promise.resolve();
                }
              })
              .catch((error) => {
                console.warn(`[Service Worker] Could not cache ${url}:`, error);
                // Don't fail the entire install if one asset fails
                return Promise.resolve();
              });
          })
        );
      })
      .then(() => {
        console.log("[Service Worker] Assets precached");
        // Force activation of new service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("[Service Worker] Precaching failed:", error);
        // Still activate even if precaching had issues
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...", CACHE_VERSION);

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches (keep current version and runtime/api caches)
            if (
              cacheName !== CACHE_NAME &&
              cacheName !== RUNTIME_CACHE &&
              cacheName !== API_CACHE &&
              cacheName.startsWith("kasipos-")
            ) {
              console.log("[Service Worker] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[Service Worker] Activated");
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API calls with stale-while-revalidate strategy
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.match(
      /^\/(categories|products|customers|transactions|vouchers|parcels|stock-adjustments|marketplace-orders|marketplace-stores)/
    )
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(API_CACHE);
        const cachedResponse = await cache.match(request);

        // Try network first
        try {
          const networkResponse = await fetch(request);

          // Cache successful GET responses
          if (networkResponse.ok && request.method === "GET") {
            const responseClone = networkResponse.clone();
            await cache.put(request, responseClone);
          }

          return networkResponse;
        } catch (error) {
          // Network failed - try cache
          if (cachedResponse) {
            // Add cache headers to indicate this is stale data
            const headers = new Headers(cachedResponse.headers);
            headers.set("X-Served-From-Cache", "true");
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: headers,
            });
          }

          // No cache available - return offline response
          return new Response(
            JSON.stringify({
              error: "Offline",
              message:
                "No internet connection. Please check your network and try again.",
              cached: false,
            }),
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: {
                "Content-Type": "application/json",
                "X-Served-From-Cache": "false",
              },
            }
          );
        }
      })()
    );
    return;
  }

  // In development, never intercept _next requests to avoid ChunkLoadError (double path, cache issues)
  const isDev = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (isDev && url.pathname.startsWith("/_next/")) {
    return;
  }

  // Handle Next.js static assets
  // Only intercept if we have a cached version to avoid breaking offline behavior
  // Next.js handles these assets with its own caching, so we only help when offline
  if (url.pathname.startsWith("/_next/static/")) {
    // Use a promise to check cache first before deciding to intercept
    const cacheCheck = caches.open(CACHE_NAME).then(async (cache) => {
      // Try to match without query parameters (for better cache matching)
      const cacheKey = new Request(url.pathname, { method: "GET" });
      let cachedResponse = await cache.match(cacheKey);

      // If no match without query, try with the full request (including query)
      if (!cachedResponse) {
        cachedResponse = await cache.match(request);
      }

      return { cache, cachedResponse, cacheKey };
    });

    // Only intercept if we have a cached version
    event.respondWith(
      cacheCheck
        .then(async ({ cache, cachedResponse, cacheKey }) => {
          if (cachedResponse) {
            // We have cache - use stale-while-revalidate
            // Try to update cache in background
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                  // Cache with pathname only (ignore query params) for better matching
                  cache.put(cacheKey, networkResponse.clone()).catch(() => {});
                }
              })
              .catch(() => {});

            return cachedResponse;
          }

          // No cache - try network, but if it fails, don't return empty response
          // Instead, let the fetch fail naturally so Next.js can handle it
          try {
            const networkResponse = await fetch(request);
            if (networkResponse && networkResponse.ok) {
              // Cache successful responses for offline use
              const responseClone = networkResponse.clone();
              cache.put(cacheKey, responseClone).catch(() => {});
            }
            return networkResponse;
          } catch (error) {
            // Network failed - rethrow to let browser/Next.js handle
            // This prevents us from returning empty responses
            throw error;
          }
        })
        .catch(() => {
          // If cache check or fetch fails, fall back to normal fetch
          // This allows Next.js to handle the request normally
          return fetch(request);
        })
    );
    return;
  }

  // For other static assets (JS, CSS, images), use cache-first strategy
  if (
    url.pathname.match(
      /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/
    )
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            await cache.put(request, responseClone);
          }
          return networkResponse;
        } catch (error) {
          // Network failed - return cached version if available
          if (cachedResponse) {
            return cachedResponse;
          }
          // No cache - return network error (browser will handle)
          return new Response("Asset not available offline", {
            status: 503,
            statusText: "Service Unavailable",
          });
        }
      })()
    );
    return;
  }

  // For pages and other routes, use stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);

      // Start fetching from network in parallel
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // Cache successful responses
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            cache.put(request, responseClone);
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed - will use cache if available
          return null;
        });

      // Return cached version immediately if available
      if (cachedResponse) {
        // Don't wait for network - return cache immediately
        fetchPromise.catch(() => {}); // Fire and forget
        return cachedResponse;
      }

      // No cache - wait for network
      const networkResponse = await fetchPromise;
      if (networkResponse) {
        return networkResponse;
      }

      // Network failed and no cache - return offline page for navigation
      if (request.mode === "navigate") {
        const offlinePage = await cache.match("/");
        return (
          offlinePage ||
          new Response(
            "<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your internet connection and try again.</p></body></html>",
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "text/html" },
            }
          )
        );
      }

      return new Response("Resource not available", {
        status: 503,
        statusText: "Service Unavailable",
      });
    })()
  );
});

// Message handler for cache management
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (
    event.data &&
    event.data.type === "PRECACHE_URLS" &&
    Array.isArray(event.data.urls)
  ) {
    const urls = event.data.urls;
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) => {
          return Promise.allSettled(
            urls.map((url) =>
              fetch(new Request(url, { cache: "reload" }))
                .then((res) =>
                  res.ok ? cache.put(url, res) : Promise.resolve()
                )
                .catch(() => Promise.resolve())
            )
          );
        })
        .then(() => {
          if (event.ports && event.ports[0])
            event.ports[0].postMessage({ success: true });
        })
    );
  }

  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        })
        .then(() => {
          if (event.ports && event.ports[0])
            event.ports[0].postMessage({ success: true });
        })
    );
  }
});
