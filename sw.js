const CACHE_NAME = "hotel-pwa-v1";

const ASSETS = [
    "./", 
    "./index.html",
    "./manifest.json",
    "./assets/css/bootstrap.min.css",
    "./assets/css/styles.css",
    "./assets/js/bootstrap.bundle.min.js",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./pages/maid.html",
    "./pages/reception.html"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (let asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn("No se pudo cachear:", asset);
        }
      }
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(res => {
      return res || fetch(event.request).catch(() => caches.match("./pages/offline.html"));
    })
  );
});
