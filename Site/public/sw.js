// CalhaFlow Service Worker v1.0
// Estratégia: Network first (dados sempre frescos), Cache as fallback

const CACHE_NAME = 'calhaflow-v1';
const STATIC_ASSETS = [
    '/',
    '/login',
    '/dashboard',
    '/orcamento',
    '/admin',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

// Install: pré-cache de assets essenciais
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(() => {
                // Ignora falhas ao pre-cachear (assets podem não existir ainda)
            });
        })
    );
    self.skipWaiting();
});

// Activate: limpa caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Fetch: Network first → Cache fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Não interceptar requests da API (sempre buscar da rede)
    if (url.pathname.startsWith('/api/')) return;

    // Não interceptar requests de outros domínios
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                // Cachear apenas respostas bem-sucedidas
                if (response && response.status === 200 && request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback para cache quando offline
                return caches.match(request).then((cached) => {
                    if (cached) return cached;
                    // Offline fallback page
                    if (request.destination === 'document') {
                        return caches.match('/login');
                    }
                });
            })
    );
});
