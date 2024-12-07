const APP_VERSION = '1.0.0';
const CACHE_NAME = `baby-care-tracker-${APP_VERSION}`;

self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            self.skipWaiting(),
            // Tu môžeme pridať cache pre offline režim ak bude potrebné
        ])
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Vyčistíme staré cache
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => cacheName.startsWith('baby-care-tracker-'))
                        .filter(cacheName => cacheName !== CACHE_NAME)
                        .map(cacheName => caches.delete(cacheName))
                );
            }),
            // Prevezmeme kontrolu nad všetkými tabmi
            clients.claim()
        ])
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .catch(error => {
                return new Response('Network error', {
                    status: 408,
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
    );
}); 