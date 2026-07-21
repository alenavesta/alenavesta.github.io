// Service worker: оболочка приложения работает офлайн,
// реальные аудио-медитации прекэшируются при установке (список AUDIO ниже),
// остальные треки (.wav-заглушки) кэшируются при первой сетевой загрузке.

// ВАЖНО: при любом изменении файлов оболочки (html/css/js) бампать номер версии ниже —
// именно смена sw.js запускает автообновление на телефонах (см. app.js, блок «Автообновление»).
const SHELL_CACHE = 'av-shell-v23'; // v23: аудио стартует мгновенно (прекэш .m4a + Range из кэша)
const AUDIO_CACHE = 'av-audio-v2';  // v2: прекэш 6 медитаций; бамп заставляет старые установки перекачать

// Реальные медитации (.m4a). Прекэшируются в AUDIO_CACHE при install → мгновенный старт и офлайн.
// AUDIO_CACHE переживает бампы SHELL_CACHE (см. activate), поэтому ~21 МБ качаются один раз на версию
// аудио-кэша, а не при каждом обновлении оболочки. Заглушки .wav сюда не кладём — они кэшируются лениво.
const AUDIO = [
  './audio/glubokiy-son.m4a',
  './audio/legkoe-utro.m4a',
  './audio/mini-usnut-za-10-minut.m4a',
  './audio/otpustit-den.m4a',
  './audio/spokoynoe-zavtra.m4a',
  './audio/tihiy-um.m4a',
];

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
  './covers/mini-usnut-za-10-minut.png',
  './covers/otpustit-den.png',
  './covers/tihiy-um.png',
  './covers/glubokiy-son.png',
  './covers/spokoynoe-zavtra.png',
  './covers/legkoe-utro.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' — качаем оболочку с сервера напрямую, минуя HTTP-кэш браузера,
  // иначе в новую версию могут попасть старые файлы.
  e.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))),
      // Прекэш медитаций: старый SW продолжает обслуживать страницу, пока эти ~21 МБ докачаются,
      // поэтому пользователя это не блокирует. addAll упадёт целиком, если хоть один файл недоступен —
      // ловим ошибку, чтобы недокачанное аудио не срывало установку новой версии оболочки.
      caches.open(AUDIO_CACHE).then((c) => c.addAll(AUDIO).catch(() => {})),
    ])
  );
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

  // Аудио: отдаём из кэша (в т.ч. по Range — плеер стартует и перематывает мгновенно),
  // иначе один раз качаем из сети и кладём в кэш. См. respondAudio ниже.
  if (url.pathname.includes('/audio/')) {
    e.respondWith(respondAudio(e.request));
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

// Раздача аудио с поддержкой Range.
// Плеер запрашивает файл кусками (Range: bytes=…) — если такой запрос уйти в сеть,
// прекэшированный трек скачается заново, а офлайн-воспроизведение сломается. Поэтому
// нарезаем 206-ответ прямо из кэшированного файла. Нет в кэше — качаем целиком один раз.
async function respondAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  let full = await cache.match(request.url); // полный файл (ключ — URL без Range)
  if (!full) {
    try {
      const res = await fetch(request.url); // запрашиваем весь файл, а не текущий Range-кусок
      if (res.ok) {
        await cache.put(request.url, res.clone());
        full = res;
      } else {
        return fetch(request); // ошибка сервера — отдаём как есть, не кэшируем
      }
    } catch {
      return fetch(request); // нет сети и нет в кэше — пусть решает браузер
    }
  }

  const range = request.headers.get('range');
  if (!range) return full; // обычный запрос — полный файл (200)

  // Range вида "bytes=START-" или "bytes=START-END": режем тело кэшированного ответа.
  const buf = await full.arrayBuffer();
  const total = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const start = m && m[1] ? parseInt(m[1], 10) : 0;
  const end = m && m[2] ? parseInt(m[2], 10) : total - 1;
  if (isNaN(start) || start >= total) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  }
  const last = Math.min(end, total - 1);
  const slice = buf.slice(start, last + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      'Content-Type': full.headers.get('Content-Type') || 'audio/mp4',
      'Content-Range': `bytes ${start}-${last}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(slice.byteLength),
    },
  });
}
