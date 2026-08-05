// Service worker: оболочка приложения работает офлайн, аудио-медитации стримятся из сети при первом
// запуске (мгновенный старт, как видео). В кэш запущенный трек кладёт САМА СТРАНИЦА (app.js
// saveForOffline) — дальше он играет из кэша и офлайн. Раньше докэшировал сам SW в фоне, но телефон
// выгружал воркер на середине большой загрузки, и офлайн не работал. Остальные треки заранее не
// качаются: сохраняется только то, что человек включил.

// ВАЖНО: при любом изменении файлов оболочки (html/css/js) бампать номер версии ниже —
// именно смена sw.js запускает автообновление на телефонах (см. app.js, блок «Автообновление»).
const SHELL_CACHE = 'av-shell-v45'; // v45: бесплатная пробная медитация после квиза (трек podarok, free)
// БАМП AUDIO_CACHE (v2→v3): при активации старый кэш аудио удаляется, устройства перекачивают
// исправленные файлы. Делать при ЛЮБОЙ замене содержимого уже залитого .m4a — иначе телефоны
// продолжают отдавать старую копию из кэша, а серверный фикс до них не доходит.
const AUDIO_CACHE = 'av-audio-v4';  // кэш медитаций, переживает бампы оболочки (см. activate). v3→v4: пересжатые дыхательные практики

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
  './covers/otnosheniya-prostit-sebya.png',
  './covers/otnosheniya-pravo-poluchat.png',
  './covers/otnosheniya-bezopasnaya-blizost.png',
  './covers/snyat-trevogu.png',
  './covers/perezagruzka.png',
  './covers/vernut-pokoy.png',
  './covers/podarok-besplatnaya-meditaciya.png',
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

  // Аудио: из кэша (с поддержкой Range), иначе стрим из сети. Кэшированием ведает страница. См. respondAudio.
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

// Раздача аудио. Есть в кэше → отдаём мгновенно (с нарезкой 206 под Range-запросы плеера) — играет
// офлайн. Нет в кэше → стримим напрямую из сети (Range → 206 от сервера, старт как у видео).
// В КЭШ кладёт САМА СТРАНИЦА (app.js saveForOffline), а не воркер: телефон убивает SW вскоре после
// ответа, и фоновая докачка большого файла обрывалась — поэтому здесь только чтение из кэша.
async function respondAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return sliceIfRange(cached, request);
  return fetch(request); // мгновенный стриминг из сети; сохранит страница
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

