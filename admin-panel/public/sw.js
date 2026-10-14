const CACHE_NAME = 'attendhr-pwa-v3';
const ASSETS_TO_CACHE = [
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

  // The HTML shell (every route — including client-side ones via the Vercel
  // SPA rewrite — resolves here on a fresh navigation) must always be
  // revalidated against the network first. It's what pins down *which*
  // content-hashed JS/CSS chunk filenames are current; a new deploy renames
  // those chunks, so serving a stale cached copy of the shell makes it
  // reference chunk files that no longer exist on the server — surfacing as
  // "Failed to fetch dynamically imported module" the moment a user opens a
  // route they didn't already have cached from before the deploy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Content-hashed static assets (/assets/*.js, *.css) are safe to serve
  // cache-first — their filename changes whenever their content does, so a
  // cached copy can never be stale for a given URL.
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
