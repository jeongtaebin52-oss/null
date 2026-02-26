const CACHE_NAME = "null-pwa-v2";
const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve(true))))
      ),
    ])
  );
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/") ||
    /\.(?:js|css|png|jpg|jpeg|svg|webp|gif|ico|woff2|woff|ttf|map)$/i.test(pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => undefined);
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("/offline.html"))
        )
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => undefined);
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => undefined);
        return res;
      })
      .catch(() => caches.match(req))
  );
});
