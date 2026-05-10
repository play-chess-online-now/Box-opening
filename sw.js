const CACHE_NAME = 'case-simulator-v1';

// All files to cache for offline play
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Exo+2:wght@900&display=swap'
];

// ── Install: cache all assets ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache local files reliably; external fonts best-effort
      return cache.addAll(['./index.html', './manifest.json'])
        .then(() => {
          // Try to cache Google Fonts, but don't fail install if blocked
          return cache.add('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Exo+2:wght@900&display=swap')
            .catch(() => console.log('[SW] Google Fonts not cached (offline install)'));
        });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first strategy ────────────────────────────
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Serve from cache; update cache in background (stale-while-revalidate)
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => { /* offline: silently ignore */ });

        return cachedResponse;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request)
        .then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: return main page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
