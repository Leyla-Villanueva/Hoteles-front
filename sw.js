const CACHE_NAME = "hotel-pwa-v3";
const API_CACHE = "hotel-api-cache-v1";

// Archivos estáticos
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

    "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"

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



function openDatabase() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('hotel-pwa-db', 1);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('pending-requests')) {
                db.createObjectStore('pending-requests', { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
    });
}

function savePendingToIDB(obj) {
    return openDatabase().then(db => new Promise((res, rej) => {
        const tx = db.transaction('pending-requests', 'readwrite');
        const store = tx.objectStore('pending-requests');
        const request = store.add(obj);
        request.onsuccess = e => {
            obj.id = e.target.result;
            db.close();
            res(obj.id);
        };
        request.onerror = e => { db.close(); rej(e); };
    }));
}

function getAllPendingFromIDB() {
    return openDatabase().then(db => new Promise((res, rej) => {
        const tx = db.transaction('pending-requests', 'readonly');
        const store = tx.objectStore('pending-requests');
        const req = store.getAll();
        req.onsuccess = () => { db.close(); res(req.result || []); };
        req.onerror = e => { db.close(); rej(e); };
    }));
}

function deletePendingById(id) {
    return openDatabase().then(db => new Promise((res, rej) => {
        const tx = db.transaction('pending-requests', 'readwrite');
        const store = tx.objectStore('pending-requests');
        store.delete(id);
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = e => { db.close(); rej(e); };
    }));
}


async function saveRequest(request) {
    let body = null;

    try {
        const clonedForRead = request.clone();
        const contentType = request.headers.get('Content-Type') || '';

        if (contentType.includes('application/json')) {
            body = await clonedForRead.json();
        } else if (request.method === 'POST' || request.method === 'PUT') {
            try {
                const formData = await clonedForRead.formData();
                body = Object.fromEntries(formData.entries());
            } catch {
                body = null;
            }
        }
    } catch {
        body = null;
    }

    const entry = {
        url: request.url,
        method: request.method,
        body,
        timestamp: Date.now()
    };

    try {
        await savePendingToIDB(entry);
        console.log("Petición guardada offline (IDB):", entry);
    } catch (err) {
        console.warn("Fallo al guardar en IDB:", err);
    }
}


async function sendPendingRequests() {

    let items = [];
    try {
        items = await getAllPendingFromIDB();
    } catch (err) {
        console.warn('No se pudo leer IDB:', err);
        return;
    }

    if (!items.length) return;

    console.log("Reintentando peticiones guardadas...", items.length);

    let successCount = 0;
    let failureCount = 0;

    for (const req of items) {
        try {
            const token = localStorage.getItem('jwt') || '';
            const headers = { "Content-Type": "application/json" };
            if (token) headers.Authorization = `Bearer ${token}`;

            const fetchOptions = { method: req.method, headers };
            if (req.body) fetchOptions.body = JSON.stringify(req.body);

            const response = await fetch(req.url, fetchOptions);

            if (response.status === 403) {
                console.warn("Token inválido o expirado, petición pendiente:", req);
                failureCount++;
                continue;
            }

            await deletePendingById(req.id);
            console.log("Petición reenviada:", req);
            successCount++;

        } catch (err) {
            console.warn("Falló el reenvío, se mantiene en cola:", req, err);
            failureCount++;
        }
    }


    try {
        const clientsList = await self.clients.matchAll();
        clientsList.forEach(client => {
            client.postMessage({
                type: 'requests-synced',
                success: successCount,
                failures: failureCount
            });
        });
    } catch (e) {
        console.warn('No se pudo notificar a los clientes:', e);
    }
}


self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);


    // 👇 CACHEAR CDNs EXTERNOS (unpkg, cdnjs, jsdelivr, etc.)
    if (url.origin !== location.origin && 
        (url.hostname.includes('unpkg.com') || 
         url.hostname.includes('cdn') || 
         url.hostname.includes('cloudflare'))) {
        
        event.respondWith(
            caches.match(request).then(cacheRes => {
                if (cacheRes) {
                    console.log("📦 CDN desde cache:", url.href);
                    return cacheRes;
                }
                
                return fetch(request).then(fetchRes => {
                    // Solo cachear respuestas exitosas
                    if (fetchRes && fetchRes.status === 200) {
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, fetchRes.clone());
                            console.log("✅ CDN guardado en cache:", url.href);
                            return fetchRes;
                        });
                    }
                    return fetchRes;
                }).catch(() => {
                    console.warn("❌ CDN no disponible offline:", url.href);
                    return cacheRes; // Intenta devolver cache aunque sea null
                });
            })
        );
        return;
    }
    
    if (url.pathname.includes("/api") || url.pathname.includes("/maid") || url.pathname.includes("/recepcion")) {
        if (["POST", "PUT", "DELETE"].includes(request.method)) {
            const requestClone = request.clone(); 
            event.respondWith(
                fetch(request).catch(() => {
                    saveRequest(requestClone);
                    return new Response(JSON.stringify({
                        offline: true,
                        message: "Se actualizará el estado cuando vuelvas a estar en línea."
                    }), { headers: { "Content-Type": "application/json" } });
                })
            );
            return;
        }



        event.respondWith(

            fetch(request)
                .then(response => {

                    const clone = response.clone();
                    caches.open(API_CACHE).then(cache => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }


    event.respondWith(
        caches.match(request).then(cacheRes => {
            return cacheRes || fetch(request).then(fetchRes => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, fetchRes.clone());
                    return fetchRes;
                });
            }).catch(() => {
                if (request.mode === "navigate") {
                    return caches.match("/pages/offline.html");
                }
            });
        })
    );
});



self.addEventListener("sync", event => {
    if (event.tag === "sync-pending-requests") {
        event.waitUntil(sendPendingRequests());
    }
});


self.addEventListener('message', event => {
    if (!event.data) return;
    if (event.data.type === 'sync') {
        event.waitUntil(sendPendingRequests());
    }
});

