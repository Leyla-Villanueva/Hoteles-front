const CACHE_NAME = "hotel-pwa-v3";
const API_CACHE = "hotel-api-cache-v1";

// Archivos estáticos
const ASSETS = [
    "/",  
    "/index.html",
    "/manifest.json",

    "/assets/css/bootstrap.min.css",
    "/assets/css/bootstrap-icons.min.css",
    "/assets/css/styles.css",

    "/assets/js/bootstrap.bundle.min.js",
    "/assets/js/auth.controller.js",
    "/assets/js/maid-api.js",
    "/assets/js/recepcion-api.js",

    "/assets/icons/icon-192.png",
    "/assets/icons/icon-512.png",

    "/pages/maid.html",
    "/pages/reception.html",
    "/pages/offline.html"
];


// ---------------------------
// INSTALACIÓN (precache)
// ---------------------------
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


// ---------------------------
// ACTIVACIÓN (limpiar versiones viejas)
// ---------------------------
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))
            )
        )
    );
});


// -------------------------------------------------
// 4. Cola de peticiones OFFLINE
// -------------------------------------------------
let pendingRequests = [];

async function saveRequest(request) {
    const cloned = request.clone();
let body = null;
try {
    body = await cloned.json();
} catch (e) {}


    const entry = {
        url: request.url,
        method: request.method,
        body
    };

    // Guardar header Authorization si existe (para poder reenviar con token)
    try {
        const authHeader = request.headers.get('Authorization');
        if (authHeader) {
            entry.headers = { Authorization: authHeader };
        }
    } catch (e) {
        // algunos requests pueden no exponer headers; ignore
    }

    // Guardar en IndexedDB para persistir entre reinicios del SW
    try {
        await savePendingToIDB(entry);
        console.log("Petición guardada offline (IDB):", entry);
    } catch (err) {
        // Fallback en memoria si IDB falla
        pendingRequests.push(entry);
        console.warn("Fallo al guardar en IDB, guardado en memoria:", err);
    }
}


async function sendPendingRequests() {
    // Obtener pendientes desde IndexedDB
    let items = [];
    try {
        items = await getAllPendingFromIDB();
    } catch (err) {
        console.warn('No se pudo leer IDB, usando memoria:', err);
        items = [...pendingRequests];
        pendingRequests = [];
    }

    if (!items.length) return;

    console.log("Reintentando peticiones guardadas...", items.length);

    let successCount = 0;
    let failureCount = 0;

    for (const req of items) {
        try {
            const baseHeaders = { "Content-Type": "application/json" };
            const mergedHeaders = Object.assign({}, baseHeaders, req.headers || {});

            const fetchOptions = {
                method: req.method,
                headers: mergedHeaders
            };

            if (req.body) fetchOptions.body = JSON.stringify(req.body);

            await fetch(req.url, fetchOptions);

            // Si se envió correctamente, eliminar del IDB
            try {
                await deletePendingById(req.id);
            } catch (e) {
                console.warn('No se pudo eliminar pending de IDB:', e);
            }

            console.log("Petición reenviada:", req);
            successCount++;

        } catch (err) {
            console.log("Falló nuevamente, se mantiene en cola.", req, err);
            failureCount++;
        }
    }

    // Notificar a las páginas clientes que se reintentaron peticiones
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


// ---------------------------
// IndexedDB helpers
// ---------------------------
function openDatabase() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('hotel-pwa-db', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('pending-requests')) {
                db.createObjectStore('pending-requests', { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function savePendingToIDB(obj) {
    return openDatabase().then(db => new Promise((res, rej) => {
        const tx = db.transaction('pending-requests', 'readwrite');
        const store = tx.objectStore('pending-requests');
        store.add(obj);
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = (e) => { db.close(); rej(e); };
    }));
}

function getAllPendingFromIDB() {
    return openDatabase().then(db => new Promise((res, rej) => {
        const tx = db.transaction('pending-requests', 'readonly');
        const store = tx.objectStore('pending-requests');
        const req = store.getAll();
        req.onsuccess = () => { db.close(); res(req.result || []); };
        req.onerror = (e) => { db.close(); rej(e); };
    }));
}

function deletePendingById(id) {
    return openDatabase().then(db => new Promise((res, rej) => {
        const tx = db.transaction('pending-requests', 'readwrite');
        const store = tx.objectStore('pending-requests');
        store.delete(id);
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = (e) => { db.close(); rej(e); };
    }));
}



// -------------------------------------------------
// 5. Estrategias de Caché
// -------------------------------------------------
self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    // ----------------------------
    // API → Network First
    // ----------------------------
    if (url.pathname.includes("/api") || url.pathname.includes("/maid") || url.pathname.includes("/recepcion")) {

// Métodos que deben guardarse offline
if (["POST", "PUT", "DELETE"].includes(request.method)) {
    event.respondWith(
        fetch(request).catch(() => {
            saveRequest(request);
            return new Response(JSON.stringify({
                offline: true,
                message: "Se actualizará el estado cuando vuelvas a estar en línea."
            }), {
                headers: { "Content-Type": "application/json" }
            });
        })
    );
    return;
}


        // GET → Network First
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Guardamos copia en cache
                    const clone = response.clone();
                    caches.open(API_CACHE).then(cache => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request)) // si no hay red → cache
        );
        return;
    }

    // ----------------------------
    // Assets estáticos → Cache First
    // ----------------------------
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



// -------------------------------------------------
// 6. Detectar cuando vuelve el internet
// -------------------------------------------------
self.addEventListener("sync", event => {
    if (event.tag === "sync-pending-requests") {
        event.waitUntil(sendPendingRequests());
    }
});

// Permitir que la página solicite una sincronización manual (fallback si no hay Background Sync)
self.addEventListener('message', event => {
    if (!event.data) return;
    if (event.data.type === 'sync') {
        event.waitUntil(sendPendingRequests());
    }
});
