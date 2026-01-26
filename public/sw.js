const CACHE_VERSION = 'kasipos-v3';
const CACHE_NAME = `kasipos-cache-${CACHE_VERSION}`;
const RUNTIME_CACHE = 'kasipos-runtime-cache';
const API_CACHE = 'kasipos-api-cache';

// Assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/offline', // Offline fallback page (if exists)
];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
};

// Install event - precache assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching assets');
        return cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      })
      .then(() => {
        console.log('[Service Worker] Assets precached');
        // Force activation of new service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Precaching failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches (keep current version and runtime/api caches)
            if (
              cacheName !== CACHE_NAME && 
              cacheName !== RUNTIME_CACHE && 
              cacheName !== API_CACHE &&
              cacheName.startsWith('kasipos-')
            ) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activated');
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API calls with stale-while-revalidate strategy
  if (url.pathname.startsWith('/api/') || url.pathname.match(/^\/(categories|products|customers|transactions|vouchers|parcels|stock-adjustments|marketplace-orders|marketplace-stores)/)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(API_CACHE);
        const cachedResponse = await cache.match(request);

        // Try network first
        try {
          const networkResponse = await fetch(request);
          
          // Cache successful GET responses
          if (networkResponse.ok && request.method === 'GET') {
            const responseClone = networkResponse.clone();
            await cache.put(request, responseClone);
          }
          
          return networkResponse;
        } catch (error) {
          // Network failed - try cache
          if (cachedResponse) {
            // Add cache headers to indicate this is stale data
            const headers = new Headers(cachedResponse.headers);
            headers.set('X-Served-From-Cache', 'true');
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: headers,
            });
          }
          
          // No cache available - return offline response
          return new Response(
            JSON.stringify({ 
              error: 'Offline', 
              message: 'No internet connection. Please check your network and try again.',
              cached: false
            }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 
                'Content-Type': 'application/json',
                'X-Served-From-Cache': 'false'
              },
            }
          );
        }
      })()
    );
    return;
  }

  // For static assets (JS, CSS, images), use cache-first strategy
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
    url.pathname.startsWith('/_next/static/')
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
          // Network failed - return cached version if available, or error
          return cachedResponse || new Response('Asset not available offline', {
            status: 503,
            statusText: 'Service Unavailable',
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
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Cache successful responses
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          cache.put(request, responseClone);
        }
        return networkResponse;
      }).catch(() => {
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
      if (request.mode === 'navigate') {
        const offlinePage = await cache.match('/');
        return offlinePage || new Response(
          '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your internet connection and try again.</p></body></html>',
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/html' },
          }
        );
      }

      return new Response('Resource not available', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    })()
  );
});

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});
