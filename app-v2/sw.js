// Service worker: оболочка приложения работает офлайн, аудио-медитации стримятся из сети
// при первом запуске (мгновенный старт, как видео) и докэшируется ТОЛЬКО тот трек, который
// пользователь запустил, — дальше он играет из кэша и офлайн. Остальные медитации НЕ качаются
// заранее: иначе фоновая загрузка всех файлов забивает канал и запуск нажатого трека тормозит.

// ВАЖНО: при любом изменении файлов оболочки (html/css/js) бампать номер версии ниже —
// именно смена sw.js запускает автообновление на телефонах (см. app.js, блок «Автообновление»).
const SHELL_CACHE = 'av-shell-v37'; // v37: 6 дыхательных практик в категории «Практики»
const AUDIO_CACHE = 'av-audio-v2';  // кэш медитаций, переживает бампы оболочки (см. activate)

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
  './covers/moy-novyy-son.png',
  './covers/dengi-razreshit-sebe-bolshe.png',
  './covers/dengi-bez-viny.png',
  './covers/dengi-spokoynye-dengi.png',
  './covers/zdorovie-prinyat-telo.png',
  './covers/zdorovie-otpustit-obidy.png',
  './covers/zdorovie-doveryat-telu.png',
  './legal/legal.css',
  './legal/privacy.html',
  './legal/oferta.html',
  './legal/soglasie.html',
  './legal/kontakty.html',
];

self.addEventListener('install', (e) => {
  // Активируемся быстро: ждём только лёгкую оболочку. Аудио (~21 МБ) НЕ ждём — иначе установка
  // нового SW висела бы на загрузке всех медитаций и обновление не «вставало» бы на устройстве.
  // cache: 'reload' — качаем оболочку с сервера напрямую, минуя HTTP-кэш браузера.
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== AUDIO_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
  // Медитации заранее НЕ качаем — только тот трек, что пользователь запустит (см. respondAudio).
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Чужие домены (видео с GitHub Releases и т.п.) — напрямую в сеть, не перехватываем:
  // потоковое видео просит файл кусками (Range), через respondWith это ломается.
  if (url.origin !== location.origin) return;

  // Аудио: из кэша (с поддержкой Range), иначе стрим из сети + докэш в фоне. См. respondAudio.
  if (url.pathname.includes('/audio/')) {
    e.respondWith(respondAudio(e.request, e));
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

// Раздача аудио. Есть в кэше → отдаём мгновенно (с нарезкой 206 под Range-запросы плеера).
// Нет в кэше → стримим напрямую из сети (исходный Range → 206 от сервера, старт как у видео),
// а полный файл докачиваем в кэш в фоне — следующий запуск и офлайн уже из кэша.
async function respondAudio(request, event) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return sliceIfRange(cached, request);
  cacheAudioOnce(cache, request.url, event); // докэш в фоне (без гонки с плеером)
  return fetch(request); // мгновенный стриминг текущего запуска
}

// 206 из кэшированного полного файла: плеер запрашивает трек кусками (Range) и не умеет
// стартовать/перематывать, если в ответ на Range прилетает целый файл 200. Поэтому режем сами.
async function sliceIfRange(full, request) {
  const range = request.headers.get('range');
  if (!range) return full; // обычный запрос — полный файл (200)
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

// Докэш одного файла целиком, но не больше одной загрузки на URL одновременно: плеер шлёт
// много Range-запросов, без защиты каждый запустил бы отдельную полную скачку того же файла.
const audioCaching = new Set();
function cacheAudioOnce(cache, url, event) {
  if (audioCaching.has(url)) return;
  audioCaching.add(url);
  // Пауза перед докачкой: даём плееру сначала набрать буфер и стартовать мгновенно, чтобы полная
  // загрузка файла в кэш не конкурировала со стримом за канал в первые секунды воспроизведения.
  const job = new Promise((r) => setTimeout(r, 4000))
    .then(() => cache.add(url)) // add качает весь файл (без Range) → в кэше лежит полный 200
    .catch(() => {})
    .finally(() => audioCaching.delete(url));
  if (event && event.waitUntil) event.waitUntil(job); // держим SW живым до конца докэша
}
