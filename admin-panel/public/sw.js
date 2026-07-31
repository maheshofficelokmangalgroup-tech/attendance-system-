const CACHE_NAME = 'attendhr-pwa-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only GET requests are safe to intercept/cache. POST/PUT/PATCH/DELETE
  // (every mutating API call — creating an employee, checking in, etc.) must
  // go straight to the network untouched, otherwise a failed fetch() falls
  // through to caches.match(), which returns undefined for anything that
  // was never cached — and undefined is not a valid Response, so the
  // browser throws "Failed to convert value to 'Response'" and the real
  // error (or success) from the network never reaches the app.
  if (event.request.method !== 'GET') {
    return;
  }

  // Network first for GET API requests, cache fallback only if something
  // was actually cached for this exact request.
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        return cached || Response.error();
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});
