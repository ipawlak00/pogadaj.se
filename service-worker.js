// pogadaj.se — Service Worker (offline shell dla PWA)
const CACHE = 'pogadajse-v0.1.0';
const ASSETS = [
  './',
  './index.html',
  './css/theme.css',
  './css/app.css',
  './js/app.js',
  './manifest.webmanifest',
  './assets/izabela/avatar.svg',
  './assets/favicon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  // Nie cache'ujemy wywołań API (Gemini/Firebase)
  if (/generativelanguage|firebase|googleapis/.test(request.url)) return;
  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
