const CACHE_NAME = "hotel-pwa-v2";

const ASSETS = [
    "./",
    "./index.html",
    "./manifest.json",

    "./assets/css/bootstrap.min.css",
    "./assets/css/bootstrap-icons.min.css",
    "./assets/css/styles.css",

    "./assets/js/bootstrap.bundle.min.js",
    "./assets/js/auth.controller.js",
    "./assets/js/maid-api.js",
    "./assets/js/recepcion-api.js",

    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",

    "./pages/maid.html",
    "./pages/reception.html",
    "./pages/offline.html"
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
      Promise.all(
        keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))
      )
    )
  );
});


self.addEventListener("fetch", event => {
  const req = event.request;

  if (req.url.includes("/api/") && req.method === "GET") {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});


async function cacheFirst(req) {
  const cached = await caches.match(req);

  if (cached) {
    return cached;
  }

  try {
    const fresh = await fetch(req);
    return fresh;
  } catch (err) {

    const offlinePage = await caches.match("./pages/offline.html");
    return offlinePage || new Response("Offline", { status: 200 });
  }
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    return cached || caches.match("./pages/offline.html");
  }
}
