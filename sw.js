/* Virtual Tabla — offline service worker.
 * Cache-first: the whole app shell is precached, so it runs with no network.
 * Bump VERSION on every release so clients pick up new assets (see AGENTS.md). */
const VERSION = 'v1.0.0';
const CACHE = `tabla-${VERSION}`;

const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "icon-512-maskable.png",
  "apple-touch-icon.png",
  "app/tabla.css",
  "app/tabla.js",
  "app/img/tabla-bg.jpg",
  "app/img/keyboard-legacy.png",
  "fonts/BarlowCondensed-Regular.woff2",
  "fonts/BarlowCondensed-Medium.woff2",
  "fonts/BarlowCondensed-Bold.woff2",
  "app/sounds/1.mp3",
  "app/sounds/10.mp3",
  "app/sounds/11.mp3",
  "app/sounds/12.mp3",
  "app/sounds/13.mp3",
  "app/sounds/14.mp3",
  "app/sounds/2.mp3",
  "app/sounds/3.mp3",
  "app/sounds/4.mp3",
  "app/sounds/5.mp3",
  "app/sounds/6.mp3",
  "app/sounds/7.mp3",
  "app/sounds/8.mp3",
  "app/sounds/9.mp3",
  "app/sounds/ghe.mp3",
  "app/sounds/ke.mp3",
  "app/sounds/ta.mp3",
  "app/sounds/te.mp3",
  "app/sounds/tin.mp3",
  "app/sounds/too.mp3",
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
