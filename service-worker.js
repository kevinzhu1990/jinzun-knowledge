const CACHE_VERSION = 'jinzun-20260718-version-check1';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css?v=20260718-version-check1',
  './app.js?v=20260718-version-check1',
  './mooncake-filter.js?v=af8d1d9',
  './manifest.webmanifest?v=20260718-version-check1',
  './assets/brand/jinzun-logo.png',
  './assets/app-icons/icon-192.png',
  './assets/app-icons/icon-512.png',
  './outputs/product_quiz/金尊产品知识库题库.json?v=20260718-version-check1',
  './outputs/role_quiz/岗位学习考核题库.json?v=20260718-version-check1'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith('jinzun-') && key !== CACHE_VERSION).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
        return response;
      })
      .catch(() => caches.match('./index.html')));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => {
    const network = fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, response.clone()));
      return response;
    });
    return cached || network;
  }));
});
