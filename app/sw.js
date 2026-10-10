/*
 * Service worker: guarda o app no aparelho para abrir sem internet.
 * Responde sempre do cache e, quando há sinal, busca a versão nova em
 * segundo plano (ela aparece na próxima vez que o app for aberto).
 * Troque CACHE quando mudar a lista de arquivos.
 */
const CACHE = 'ajm-box-v1';

const ASSETS = [
  './',
  'index.html',
  'style.css',
  'strategy.js',
  'app.js',
  'manifest.webmanifest',
  'fonts/fonts.css',
  'fonts/barlow-400.woff2',
  'fonts/barlow-500.woff2',
  'fonts/barlow-600.woff2',
  'fonts/barlow-700.woff2',
  'fonts/saira-condensed-500.woff2',
  'fonts/saira-condensed-600.woff2',
  'fonts/saira-condensed-700.woff2',
  'fonts/saira-condensed-800.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Toda navegação abre o app (index.html), com ou sem #aba.
  const key = req.mode === 'navigate' ? 'index.html' : req;

  const network = fetch(req)
    .then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(key, copy));
      }
      return res;
    })
    .catch(() => null);
  event.waitUntil(network);

  event.respondWith(
    caches.match(key, { cacheName: CACHE, ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return network.then((res) => res || Response.error());
    })
  );
});
