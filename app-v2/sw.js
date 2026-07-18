// Service worker: оболочка приложения работает офлайн,
// аудио кэшируется отдельно при первом прослушивании (см. app.js → cacheTrack).

const SHELL_CACHE = 'av-shell-v7'; // v7: звук видео при выключенном экране + ползунок блок-экрана
const AUDIO_CACHE = 'av-audio-v1';

const SHELL = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './quiz-data.js',
  './app.js',
  './manifest.webmanifest',
  './bg.svg',
  './icons/logo.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== AUDIO_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Чужие домены (видео с GitHub Releases и т.п.) — напрямую в сеть, не перехватываем:
  // потоковое видео просит файл кусками (Range), через respondWith это ломается.
  if (url.origin !== location.origin) return;

  // Аудио: сначала кэш, иначе сеть (Range-запросы плеера пропускаем в сеть).
  if (url.pathname.includes('/audio/')) {
    if (e.request.headers.has('range')) return;
    e.respondWith(
      caches.match(e.request.url, { cacheName: AUDIO_CACHE }).then((hit) => hit || fetch(e.request))
    );
    return;
  }

  // Оболочка: кэш first, обновление в фоне.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request)
        .then((res) => {
          if (res.ok && url.origin === location.origin) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
