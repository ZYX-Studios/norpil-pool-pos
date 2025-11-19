/* 
	Simple service worker for Norpil POS.
	- Caches the main POS shell and static assets.
	- Uses a cache-first strategy for navigation requests so the app can open offline.
	- Uses a network-first strategy for API/data requests so we always prefer fresh data when online.
	- This is intentionally minimal and well-commented to stay easy to reason about.
*/

const CACHE_VERSION = "norpil-pos-v1";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;

// List of core routes and assets that should be available offline.
// We keep this list small and focused on the POS experience.
const SHELL_ASSETS = [
  "/",
  "/pos",
  "/favicon.ico",
  "/manifest.json",
  "/window.svg"
];

self.addEventListener("install", (event) => {
  // Pre-cache the minimal application shell as soon as the SW is installed.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch(() => {
        // If some assets fail to cache (e.g. during dev), we still want
        // the service worker to install so basic offline works.
        return undefined;
      });
    })
  );

  // Activate this service worker immediately on install.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clean up old caches when a new version of the SW takes over.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests; ignore CDNs or third-party calls.
  if (url.origin !== self.location.origin) {
    return;
  }

  // For navigation (page) requests, use a cache-first strategy.
  // This keeps the POS usable even if the network is down.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Serve cached page and update it in the background when online.
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => {
              cache.put(request, copy);
            });
          }).catch(() => {
            // If the background update fails, we silently ignore it.
          });
          return cached;
        }

        // If we do not have it cached yet, fall back to network.
        return fetch(request).catch(() => {
          // As a simple offline fallback, return the cached /pos shell if available.
          return caches.match("/pos");
        });
      })
    );
    return;
  }

  // For static shell assets, we also use cache-first.
  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // For all other requests (e.g. data), prefer network but fall back to cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response;
      })
      .catch(() => caches.match(request))
  );
});


