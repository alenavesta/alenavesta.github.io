// alenavesta — «Спокойный сон». Модель 2026-07-15:
// первый запуск = квиз → результат → оффер 490/1490; бесплатных треков нет.
// Экраны: quiz / today / program / library / access + модалка покупки.

/* ---------- Состояние (localStorage) ---------- */

const store = {
  read() {
    try {
      return JSON.parse(localStorage.getItem('av-state')) || {};
    } catch {
      return {};
    }
  },
  write(patch) {
    const s = { ...store.read(), ...patch };
    localStorage.setItem('av-state', JSON.stringify(s));
    return s;
  },
};

function level() {
  const l = store.read().level;
  return ACCESS_LEVELS.includes(l) ? l : 'none';
}

function quizResult() {
  const q = store.read().quiz;
  return q && q.branch && q.type ? q : null;
}

function recommendedIds() {
  const r = store.read().recommended;
  return Array.isArray(r) ? r.filter((id) => TRACKS[id]) : [];
}

function hasAccess(trackId) {
  if (level() === 'vip') return true; // приватный уровень автора — открыто всё, включая скрытый курс
  if (level() === 'full') return true;
  if (level() === 'my') return recommendedIds().includes(trackId);
  return false;
}

/* ---------- Прослушано и стрик ---------- */

function listenedMap() {
  return store.read().listened || {};
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function markListened(trackId) {
  const listened = { ...listenedMap() };
  if (listened[trackId]) return;
  listened[trackId] = todayISO();
  store.write({ listened });
  render();
  toast('Отмечено: прослушано');
}

function streak() {
  const dates = new Set(Object.values(listenedMap()));
  if (!dates.size) return 0;
  let n = 0;
  const d = new Date();
  // Сегодняшняя практика может быть ещё впереди — стрик не сбрасываем до завтра.
  if (!dates.has(todayISO())) d.setDate(d.getDate() - 1);
  while (true) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!dates.has(iso)) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* ---------- Квиз ---------- */

let quiz = { phase: 'intro', branch: null, step: 0, answers: [] };

// Снимок фазы квиза для истории браузера. Каждый шаг вперёд по квизу пишет такое состояние,
// и свайп/кнопка «назад» шагают по вопросам, а не выходят из приложения (см. popstate).
function quizState() {
  return { screen: 'quiz', qphase: quiz.phase, qbranch: quiz.branch, qstep: quiz.step };
}

function quizStart() {
  quiz = { phase: 'intro', branch: null, step: 0, answers: [] };
  go('quiz');
}

function quizFork() {
  quiz.phase = 'fork';
  render();
  if (navReady) history.pushState(quizState(), '');
}

function quizBranch(branch) {
  quiz.branch = branch;
  quiz.step = 0;
  quiz.answers = [];
  quiz.phase = 'question';
  render();
  if (navReady) history.pushState(quizState(), '');
}

function quizAnswer(qIndex, t) {
  quiz.answers[qIndex] = t;
  const branch = QUIZ_BRANCHES[quiz.branch];
  if (qIndex + 1 < branch.questions.length) {
    quiz.step = qIndex + 1;
    render();
    if (navReady) history.pushState(quizState(), '');
  } else {
    quiz.phase = 'counting';
    render();
    setTimeout(quizFinish, 1500);
  }
}

// Кнопка «← Назад» = тот же шаг назад, что и системный свайп: отдаём управление истории,
// а фактический возврат к прошлой фазе делает обработчик popstate.
function quizBack() {
  history.back();
}

function quizWinner() {
  const score = { A: 0, B: 0, C: 0 };
  quiz.answers.forEach((t) => score[t]++);
  const max = Math.max(score.A, score.B, score.C);
  const tied = ['A', 'B', 'C'].filter((t) => score[t] === max);
  if (tied.length === 1) return tied[0];
  // Равенство: решает ответ на последний вопрос, самый прямой.
  const last = quiz.answers[quiz.answers.length - 1];
  return tied.includes(last) ? last : tied[0];
}

function quizFinish() {
  // Человек мог свайпнуть назад за 1.5 с анимации «Считаю…» — тогда фаза уже не counting,
  // и отложенный таймер не должен перепрыгивать вперёд на результат.
  if (quiz.phase !== 'counting') return;
  const type = quizWinner();
  const key = `${quiz.branch}.${type}`;
  store.write({
    quiz: { branch: quiz.branch, type, at: todayISO() },
    recommended: QUIZ_RECOMMEND[key] || [],
  });
  quiz.phase = 'result';
  render();
  if (navReady) history.pushState(quizState(), '');
}

const QUIZ_TOTAL = 7; // развилка + 6 вопросов

function quizProgress(step) {
  return `
    <div class="progress">
      <div class="label">Вопрос ${step} из ${QUIZ_TOTAL}</div>
      <div class="bar"><i style="width:${Math.round((step / QUIZ_TOTAL) * 100)}%"></i></div>
    </div>`;
}

function renderQuiz() {
  if (quiz.phase === 'intro') {
    return `
      <div class="quiz-intro">
        <img class="quiz-logo" src="icons/logo.svg" alt="" />
        <h1>${esc(QUIZ_INTRO.title)}</h1>
        <p class="dim" style="margin-top:14px">${esc(QUIZ_INTRO.lead)}</p>
        <p class="dim small" style="margin-top:14px;color:var(--ink-faint)">${esc(QUIZ_INTRO.note)}</p>
        <button class="btn" style="margin-top:26px" onclick="quizFork()">${esc(QUIZ_INTRO.button)}</button>
      </div>`;
  }

  if (quiz.phase === 'fork') {
    return `
      ${quizProgress(1)}
      <h2 style="margin-top:18px">${esc(QUIZ_FORK.question)}</h2>
      <p class="dim small" style="margin-top:8px">${esc(QUIZ_FORK.sub)}</p>
      <div class="answers">
        ${QUIZ_FORK.options
          .map(
            (o) => `
          <button class="answer answer-fork" onclick="quizBranch('${o.branch}')">
            <span class="answer-title">${o.emoji} ${esc(o.title)}</span>
            <span class="answer-desc">${esc(o.desc)}</span>
          </button>`
          )
          .join('')}
      </div>`;
  }

  if (quiz.phase === 'question') {
    const item = QUIZ_BRANCHES[quiz.branch].questions[quiz.step];
    return `
      ${quizProgress(quiz.step + 2)}
      <h2 style="margin-top:18px">${esc(item.q)}</h2>
      <div class="answers">
        ${item.a
          .map((ans) => `<button class="answer" onclick="quizAnswer(${quiz.step},'${ans.t}')">${esc(ans.label)}</button>`)
          .join('')}
      </div>
      <button class="backlink" onclick="quizBack()">← Назад</button>`;
  }

  if (quiz.phase === 'counting') {
    return `<div class="counting"><span class="moon">☾</span>Считаю твои ответы…</div>`;
  }

  // Результат: берём сохранённый (после сброса phase='result' наступает только после quizFinish).
  return renderQuizResult();
}

function renderQuizResult() {
  const q = quizResult();
  if (!q) return '';
  const result = QUIZ_BRANCHES[q.branch].result;
  const insert = result.inserts[q.type];
  const p = (x) => (x ? `<p>${esc(x)}</p>` : '');

  return `
    <div class="result">
      <div class="result-card">
        <div class="eyebrow">Твой результат</div>
        <h1>${esc(insert.title)}</h1>
        ${p(insert.lead)}
        <div class="insert">
          <div class="insert-label">Твоё корневое убеждение</div>
          ${p(insert.belief)}
        </div>
        <p class="recognize-lead">${esc(insert.recognizeLead || 'Скорее всего, ты замечала за собой:')}</p>
        <ul class="recognize">${insert.recognize.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>
        ${p(insert.why)}
        ${p(result.relief)}
        ${p(result.sell)}
        ${p(insert.close)}
        ${result.legal ? `<p class="legal">${esc(result.legal)}</p>` : ''}
      </div>
      ${renderOffer(result)}
      ${
        level() === 'my'
          ? `<p class="dim small" style="margin-top:18px">Пройти тест заново и собрать набор под другую сферу можно на тарифе «${esc(PRICING.full.title)}» — там открыты все практики.</p>`
          : `<button class="restart" onclick="quizStart()">Пройти тест ещё раз</button>`
      }
    </div>`;
}

// Оффер под результатом: набор из 5 практик + тарифы + честный FOMO.
// Обе карточки тарифов кликабельны и ведут на свой раздел лендинга.
function renderOffer(result) {
  const recs = recommendedIds();
  const theme = result ? result.theme : '';
  const myUrl = `${BUY_URLS.tariffs}?theme=${theme}#plan-my`;
  const fullUrl = `${BUY_URLS.tariffs}?theme=${theme}#plan-full`;
  return `
    <p class="dim" style="margin-top:26px">${esc(result ? result.bridge : '')}</p>
    <div class="eyebrow" style="margin-top:24px">Твой набор практик</div>
    <p class="dim small" style="margin-top:4px">Подобраны под твоё корневое убеждение — слушать можно в любом порядке.</p>
    ${recs.map((id) => trackRow(TRACKS[id], { showAbout: true })).join('')}
    <div class="offer">
      <a class="offer-tariff" href="${myUrl}">
        <div class="row">
          <div class="grow">
            <div class="track-title">${esc(PRICING.my.title)}</div>
            <div class="track-meta">${esc(PRICING.my.desc)}</div>
          </div>
          <div class="price"><s>${PRICING.my.oldPrice} ₽</s> <b>${PRICING.my.price} ₽</b></div>
        </div>
      </a>
      <a class="offer-tariff best" href="${fullUrl}">
        <div class="row">
          <div class="grow">
            <div class="track-title">${esc(PRICING.full.title)} <span class="badge badge-amber">выгоднее</span></div>
            <div class="track-meta">${esc(PRICING.full.desc)}</div>
          </div>
          <div class="price"><s>${PRICING.full.oldPrice} ₽</s> <b>${PRICING.full.price} ₽</b></div>
        </div>
      </a>
      <p class="fomo">🔥 ${esc(FOMO.launch)}</p>
      <p class="fomo">🎁 ${esc(FOMO.bonusByTheme[theme] || FOMO.bonus)}</p>
      <a class="btn" href="${myUrl}">${esc(result ? result.cta : 'Выбрать тариф и купить')}</a>
      <button class="btn ghost" onclick="go('access')">У меня уже есть пароль</button>
    </div>`;
}

/* ---------- Плеер ---------- */

const audio = new Audio();
audio.preload = 'auto';
const video = document.getElementById('player-video'); // тег в index.html; скрипт подключён в конце body
let media = audio; // текущий носитель: audio (медитации) или video (видео-сублиминалы)
let playingTrack = null;
let playerCollapsed = false; // «← назад» сворачивает плеер, но трек продолжает играть (см. collapsePlayer)
let repeatOn = false; // повтор трека по кругу (переключается в плеере, держится всю сессию)

function play(trackId) {
  const t = TRACKS[trackId];
  if (!t) return;
  // Тап по уже играющему треку (кнопка/строка в списке или большая кнопка «Сегодня») —
  // не рестарт с нуля, а пауза/продолжение прямо на месте.
  if (playingTrack && playingTrack.id === trackId) { togglePlay(); return; }
  if (!hasAccess(trackId)) {
    openPaywall(trackId);
    return;
  }
  if (!media.paused) media.pause();
  playingTrack = t;
  playerCollapsed = false; // новый трек — плеер разворачиваем
  const isVideo = t.media === 'video';
  media = isVideo ? video : audio;
  document.getElementById('player').classList.toggle('video-mode', isVideo);
  media.src = t.file;
  startPlayback(media, isVideo);
  // Трек стримится из сети с мгновенным стартом; service worker докэширует В КЭШ только этот
  // запущенный файл (см. sw.js respondAudio) — со второго раза и офлайн играет из кэша.
  setMediaSession(t);
  openPlayer(t);
  // Плеер живёт на вкладке «Сегодня». Запуск из «Программы»/«Библиотеки» переключает туда.
  // Переключаем напрямую (доступ к треку уже проверен) — минуя редирект go() в квиз.
  if (screen !== 'today') {
    screen = 'today';
    if (navReady) history.pushState({ screen: 'today' }, '');
  }
  render();
  window.scrollTo(0, 0);
}

// Аккуратный старт воспроизведения. play() часто отклоняется, пока ничего ещё не буферизовано —
// это не ошибка, а «данные не готовы». Раньше на это сразу вылезал тост «Аудио пока не загружено».
// Теперь: не удалось стартовать — ждём готовности (canplay) и пробуем снова; тост показываем
// только на реальной ошибке медиа (событие error). Для прекэшированных медитаций старт мгновенный.
function startPlayback(el, isVideo) {
  const onError = () => toast(isVideo ? 'Видео пока не загружено' : 'Аудио пока не загружено');
  el.addEventListener('error', onError, { once: true });
  el.addEventListener('playing', () => el.removeEventListener('error', onError), { once: true });
  el.play().catch(() => {
    el.addEventListener('canplay', () => el.play().catch(() => {}), { once: true });
  });
}

function setMediaSession(t) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: 'alenavesta · Спокойный сон',
    artwork: t.cover
      ? [{ src: t.cover, sizes: '1536x1024', type: 'image/png' }]
      : [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
  });
  navigator.mediaSession.setActionHandler('play', () => media.play());
  navigator.mediaSession.setActionHandler('pause', () => media.pause());
  try {
    navigator.mediaSession.setActionHandler('seekto', (d) => {
      if (d.seekTime != null && media.duration) {
        media.currentTime = d.seekTime;
        updatePositionState();
      }
    });
  } catch {
    /* старые браузеры без seekto — не страшно */
  }
}

// Сообщаем системе позицию трека — тогда ползунок на заблокированном экране
// движется в реальном времени, а не только после паузы.
function updatePositionState() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  const dur = media.duration;
  if (!dur || !isFinite(dur)) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: dur,
      playbackRate: media.playbackRate || 1, // 0 недопустим — иначе setPositionState бросает
      position: Math.min(Math.max(media.currentTime || 0, 0), dur), // кламп в [0, dur]
    });
  } catch {
    /* некритично */
  }
}

function onMediaEnded(e) {
  if (e.target !== media) return;
  if (playingTrack) markListened(playingTrack.id);
  if (repeatOn) {
    // Зациклить: тот же трек с начала, плеер не закрываем.
    media.currentTime = 0;
    media.play().catch(() => {});
    return;
  }
  stopPlayback();
}

function toggleRepeat() {
  repeatOn = !repeatOn;
  updateRepeatButton();
  toast(repeatOn ? 'Повтор включён — трек будет играть по кругу' : 'Повтор выключен');
}

function updateRepeatButton() {
  const b = document.getElementById('player-repeat');
  if (!b) return;
  b.classList.toggle('on', repeatOn);
  b.setAttribute('aria-pressed', repeatOn ? 'true' : 'false');
}

let lastPosSync = 0; // троттлинг обновления позиции для системного медиа-виджета
function onMediaTime(e) {
  if (e.target !== media) return;
  const bar = document.querySelector('.player-bar i');
  const time = document.querySelector('.player-time');
  if (!bar || !media.duration) return;
  bar.style.width = `${(media.currentTime / media.duration) * 100}%`;
  time.textContent = `${fmt(media.currentTime)} · ${fmt(media.duration)}`;
  // Раз в ~секунду шлём системе РЕАЛЬНУЮ позицию: на части устройств ОС не доанимировывает
  // ползунок между «ключевыми» обновлениями, и он замирает. Чаще каждого тика слать нельзя —
  // тогда анимация дёргается; ~1 с — баланс точности и плавности.
  const now = Date.now();
  if (now - lastPosSync > 900) {
    lastPosSync = now;
    updatePositionState();
  }
}

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Заполняет содержимое плеера (заголовок, фото/видео-режим, кнопки). Видимость плеера
// на вкладке «Сегодня» переключает render() → syncPlayer() по наличию playingTrack.
function openPlayer(t) {
  const el = document.getElementById('player');
  el.querySelector('h2').textContent = t.title;
  // Фото трека (если есть): показываем карточкой на экране плеера.
  const cover = document.getElementById('player-cover');
  if (t.cover && t.media !== 'video') {
    cover.src = t.cover;
    cover.alt = t.title;
    el.classList.add('has-cover');
  } else {
    cover.removeAttribute('src');
    cover.alt = '';
    el.classList.remove('has-cover');
  }
  updatePlayerButton();
  updateRepeatButton();
}

// «← назад»: свернуть плеер, НЕ останавливая трек. На «Сегодня» показывается обычный вид,
// а сверху — полоска «Сейчас играет» (см. renderToday), по которой плеер разворачивается обратно.
function collapsePlayer() {
  playerCollapsed = true;
  render(); // syncPlayer() скроет развёрнутый плеер, hero покажет полоску «Сейчас играет»
}

// Развернуть плеер обратно (тап по полоске «Сейчас играет»).
function expandPlayer() {
  if (!playingTrack) return;
  playerCollapsed = false;
  if (screen !== 'today') {
    screen = 'today';
    if (navReady) history.pushState({ screen: 'today' }, '');
  }
  render();
  window.scrollTo(0, 0);
}

// Полная остановка: трек закончился (без повтора). Плеер уходит, «Сегодня» — обычный вид.
function stopPlayback() {
  if (!media.paused) media.pause();
  playingTrack = null;
  media = audio;
  document.getElementById('player').classList.remove('video-mode', 'has-cover');
  render();
}

function togglePlay() {
  if (media.paused) media.play();
  else media.pause();
  updatePlayerButton();
}

function updatePlayerButton() {
  const icon = media.paused ? '▶' : '❚❚';
  const b = document.getElementById('player-toggle');
  if (b) b.textContent = icon;
  // Мини-кнопка играющего трека в списках (Библиотека/Программа/набор) — держим в синхроне,
  // ведь пауза/резюм могут прийти без render() (плеер, локскран, клавиши, медиа-виджет).
  document.querySelectorAll('[data-playing-toggle]').forEach((el) => { el.textContent = icon; });
}

// Одни и те же обработчики на оба носителя; чужие события отсекаются внутри по e.target.
// Позицию шлём в ключевые моменты (старт/пауза/перемотка/смена длительности) И раз в ~секунду
// во время игры (см. onMediaTime) — иначе на части устройств ползунок замирает или уезжает в конец.
for (const el of [audio, video]) {
  el.addEventListener('ended', onMediaEnded);
  el.addEventListener('timeupdate', onMediaTime);
  el.addEventListener('play', updatePlayerButton);
  el.addEventListener('pause', updatePlayerButton);
  el.addEventListener('play', updatePositionState);
  el.addEventListener('pause', updatePositionState);
  el.addEventListener('seeked', updatePositionState);
  el.addEventListener('durationchange', updatePositionState);
  // Явно сообщаем системе play/paused: без этого ОС продолжает «крутить» ползунок при паузе
  // и он уезжает в конец трека.
  el.addEventListener('play', () => setPlaybackState('playing'));
  el.addEventListener('pause', () => setPlaybackState('paused'));
}

function setPlaybackState(s) {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = s;
}

// Тап по самому видео — пауза/продолжить (привычный жест).
video.addEventListener('click', togglePlay);

// Экран погас: браузер принудительно ставит <video> на паузу — перекидываем звук ролика
// в аудио-канал с той же секунды, чтобы сублиминал продолжал звучать. Вернулись — обратно в видео.
document.addEventListener('visibilitychange', () => {
  if (!playingTrack || playingTrack.media !== 'video') return;
  if (document.hidden) {
    if (media !== video || video.paused) return;
    const pos = video.currentTime;
    video.pause();
    media = audio;
    audio.src = playingTrack.file;
    audio.addEventListener('loadedmetadata', () => { audio.currentTime = pos; }, { once: true });
    audio.play().catch(() => {});
    setMediaSession(playingTrack);
  } else {
    if (media !== audio) return;
    const pos = audio.currentTime;
    const wasPlaying = !audio.paused;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    media = video;
    video.currentTime = pos;
    if (wasPlaying) video.play().catch(() => {});
    setMediaSession(playingTrack);
  }
});

/* ---------- Доступ по паролю ---------- */

// Соль для имени скрытого VIP-каталога celo-<vk>.js (vk = sha256(пароль + соль)[:16]).
const VIP_CATALOG_SALT = '::celo-catalog';

async function sha256(text) {
  // Web Crypto доступен только в secure context (HTTPS или localhost).
  // На телефоне по IP-адресу (http://192.168.x.x) его нет — тогда чистый JS.
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const data = new TextEncoder().encode(text);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      /* провалимся в JS-реализацию ниже */
    }
  }
  return sha256Fallback(text);
}

// Чистая JS-реализация SHA-256 (работает на любом адресе, для ASCII-паролей).
// Компактная классическая реализация; сверена в тесте с crypto для luna-9271/nebo-5836.
function sha256Fallback(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return ''; // не-ASCII — пароль всё равно не совпадёт с хэшем
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

async function applyCode(inputId, msgId) {
  const input = document.getElementById(inputId);
  const msg = document.getElementById(msgId);
  const raw = (input.value || '').trim().toLowerCase();
  if (!raw) return;
  let hash;
  try {
    hash = await sha256(raw);
  } catch {
    msg.textContent = 'Не получилось проверить пароль на этом устройстве. Напиши нам — поможем.';
    msg.className = 'msg err';
    return;
  }
  const found = ACCESS_CODES.find((c) => c.hash === hash);
  if (!found) {
    msg.textContent = 'Пароль не подошёл. Проверь письмо: пароль приходит на почту после оплаты.';
    msg.className = 'msg err';
    return;
  }
  const patch = { level: found.level };
  // Для vip имя скрытого каталога = первые 16 hex ОТ sha256(пароль + соль).
  // Соль публична, но сам пароль (raw) — нет; из открытого в data.js sha256(пароль)
  // имя каталога вывести нельзя. Запоминаем vk, чтобы при старте подтянуть курс без пароля.
  if (found.level === 'vip') {
    patch.vk = (await sha256(raw + VIP_CATALOG_SALT)).slice(0, 16);
  }
  store.write(patch);
  if (found.level === 'vip') await loadVipCatalog(patch.vk);
  msg.textContent = 'Готово. Доступ открыт.';
  msg.className = 'msg ok';
  setTimeout(() => {
    // Закрываем напрямую (не через history.back), чтобы не спорить с переходом go('today').
    _closePaywallNow();
    go('today');
  }, 900);
}

// Скрытый VIP-курс: подгружаем каталог celo-<vk>.js динамически и вливаем в TRACKS.
// В обычном коде приложения курс не упоминается — имя файла восстанавливается только из хэша пароля.
let vipCatalogLoaded = false;
function loadVipCatalog(vk) {
  return new Promise((resolve) => {
    if (vipCatalogLoaded || window.VIP_TRACKS) {
      if (window.VIP_TRACKS) Object.assign(TRACKS, window.VIP_TRACKS);
      vipCatalogLoaded = true;
      return resolve();
    }
    if (!vk) return resolve();
    const s = document.createElement('script');
    s.src = `celo-${vk}.js`;
    s.onload = () => {
      if (window.VIP_TRACKS) Object.assign(TRACKS, window.VIP_TRACKS);
      vipCatalogLoaded = true;
      render();
      resolve();
    };
    s.onerror = () => resolve(); // нет файла/сети — просто не показываем курс
    document.head.appendChild(s);
  });
}

/* ---------- Модалка замка (закрытый трек) ---------- */

function openPaywall(trackId) {
  const t = TRACKS[trackId];
  const upgrade = level() === 'my';
  const tariff = upgrade ? PRICING.full : PRICING.my;
  const buyUrl = upgrade ? BUY_URLS.full : BUY_URLS.tariffs;
  const q = quizResult();
  const theme = q ? QUIZ_BRANCHES[q.branch].result.theme : '';
  document.getElementById('modal-body').innerHTML = `
    <h2>🔒 ${esc(t.title)}</h2>
    <p class="dim small" style="margin-top:8px">
      ${upgrade
        ? `Эта практика не входит в твой набор. Тариф «${esc(PRICING.full.title)}» открывает всю библиотеку сразу.`
        : `Практики открываются после оплаты: «${esc(PRICING.my.title)}» — ${PRICING.my.price} ₽, «${esc(PRICING.full.title)}» — ${PRICING.full.price} ₽.`}
    </p>
    <p class="fomo">🔥 ${esc(FOMO.launch)}</p>
    <p class="fomo">🎁 ${esc(FOMO.bonusByTheme[theme] || FOMO.bonus)}</p>
    <input type="text" id="modal-code" placeholder="Пароль из письма" autocomplete="off" />
    <div id="modal-msg" class="msg" role="status"></div>
    <button class="btn ghost" onclick="applyCode('modal-code','modal-msg')">У меня есть пароль</button>
    <a class="btn" href="${buyUrl}${upgrade ? '' : `?theme=${theme}`}">
      Купить${upgrade ? ` за ${PRICING.full.price} ₽` : ''}
    </a>`;
  const modal = document.getElementById('modal');
  const wasOpen = modal.classList.contains('open');
  modal.classList.add('open');
  // Модалка — «шаг» в истории: свайп назад закроет её, а не приложение.
  if (!wasOpen) history.pushState({ layer: 'modal', screen }, '');
}

// Публичное закрытие (крестик, тап по фону) — через шаг назад в истории.
function closePaywall() {
  if (document.getElementById('modal').classList.contains('open')) history.back();
}

// Фактическое закрытие — вызывается обработчиком истории (popstate).
function _closePaywallNow() {
  document.getElementById('modal').classList.remove('open');
}

/* ---------- Сброс прогресса ---------- */

// Снимает отметки «прослушано», стирает результат квиза и запускает квиз заново.
// Оплаченный уровень доступа НЕ трогаем. Для тарифа «Мой набор» НЕ вызывать:
// на 490 ₽ доступ привязан к подобранному набору, повторный тест подменил бы купленное
// (см. resetListened — мягкий сброс для этого тарифа).
function resetProgress(skipConfirm = false) {
  if (!skipConfirm && !confirm('Сбросить отметки «прослушано» и пройти тест заново?')) return;
  store.write({ listened: {}, quiz: null, recommended: [] });
  quizStart();
  toast('Прогресс сброшен');
}

// Мягкий сброс для тарифа «Мой набор»: только галочки «прослушано»,
// набор, результат теста и доступ остаются как есть.
function resetListened() {
  if (!confirm('Снять отметки «прослушано»?')) return;
  store.write({ listened: {} });
  render();
  toast('Отметки сброшены');
}

/* ---------- Установка приложения (PWA) ---------- */

// Chrome и совместимые браузеры отдают событие установки — ловим его,
// чтобы показать свою кнопку «Установить приложение» (одно касание).
let installPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  render();
});

function isInstalled() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    installPrompt = null;
    toast('Приложение устанавливается — иконка появится на главном экране');
    render();
  }
}

// Тап по кнопке «Установить приложение». Если браузер отдал системное окно установки
// (Chrome) — показываем его. Иначе (Mi Браузер, Safari и т.п. системного окна нет) —
// открываем понятную пошаговую инструкцию под конкретный браузер.
function installClick() {
  if (installPrompt) {
    installApp();
  } else {
    openInstallHelp();
  }
}

// Инструкция «как поставить на телефон» в модалке — по браузеру пользователя.
function openInstallHelp() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const isMi = /MiuiBrowser/i.test(ua);
  let steps;
  if (ios) {
    steps = `
      <ol class="install-steps">
        <li>Внизу Safari нажми <b>«Поделиться»</b> — квадрат со стрелкой ↑.</li>
        <li>Пролистай и выбери <b>«На экран „Домой“»</b>.</li>
        <li>Нажми <b>«Добавить»</b> — иконка появится на экране.</li>
      </ol>`;
  } else if (isMi) {
    steps = `
      <ol class="install-steps">
        <li>Внизу справа нажми кнопку меню <b>☰</b> (три полоски).</li>
        <li>Выбери <b>«Добавить на рабочий стол»</b> (или «Добавить на главный экран»).</li>
        <li>Подтверди — иконка появится на экране.</li>
      </ol>
      <p class="dim small" style="margin-top:14px">Чтобы приложение открывалось на весь экран, без строки браузера — открой этот же адрес в <b>Google Chrome</b> и там нажми меню ⋮ → <b>«Установить приложение»</b>.</p>`;
  } else {
    steps = `
      <ol class="install-steps">
        <li>Открой меню браузера — <b>⋮</b> вверху справа.</li>
        <li>Выбери <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.</li>
        <li>Подтверди — иконка появится на экране.</li>
      </ol>`;
  }
  document.getElementById('modal-body').innerHTML = `
    <h2>Установить приложение</h2>
    <p class="dim small" style="margin-top:8px">Иконка на главном экране — запуск в одно касание, как обычное приложение.</p>
    ${steps}`;
  const modal = document.getElementById('modal');
  const wasOpen = modal.classList.contains('open');
  modal.classList.add('open');
  // Модалка — «шаг» в истории: свайп назад закроет её, а не приложение (как у paywall).
  if (!wasOpen) history.pushState({ layer: 'modal', screen }, '');
}

// Карточка установки: кнопка есть всегда (пока приложение не установлено).
// Системное окно установки не у всех браузеров — тогда кнопка открывает инструкцию (installClick).
function installCard() {
  if (isInstalled()) return '';
  return `
    <div class="card soft">
      <p class="dim small">Поставь приложение на телефон: иконка на главном экране, запуск в одно касание.</p>
      <button class="btn" onclick="installClick()">Установить приложение</button>
    </div>`;
}

/* ---------- Экраны ---------- */

let screen = 'today';
let navReady = false; // до первого рендера историю браузера не трогаем

function go(name, opts = {}) {
  // Пока квиз не пройден, «Сегодня» и «Программа» ведут в квиз.
  if ((name === 'today' || name === 'program') && !quizResult()) name = 'quiz';
  screen = name;
  // Вошли в «Библиотеку» (там видео-сублиминалы) — заранее прогреваем соединение к их хостам,
  // чтобы к тапу по ролику DNS/TLS уже стояли и видео стартовало почти сразу.
  if (name === 'library') preconnectMedia();
  // Каждый переход — запись в истории браузера, чтобы свайп назад шагал по экранам.
  // Для квиза несём и его фазу, чтобы возврат в квиз попадал на нужный шаг.
  if (navReady && !opts.fromHistory) history.pushState(name === 'quiz' ? quizState() : { screen: name }, '');
  render();
  window.scrollTo(0, 0);
}

// Прогрев соединения к хостам, откуда стримятся видео-сублиминалы (GitHub Releases редиректит
// на objects.githubusercontent.com). Пересоздаём link'и, т.к. простаивающий сокет мог закрыться —
// так соединение свежее к моменту запуска ролика. Основная часть задержки видео — как раз DNS/TLS.
const MEDIA_HOSTS = ['https://objects.githubusercontent.com', 'https://github.com'];
function preconnectMedia() {
  for (const href of MEDIA_HOSTS) {
    const old = document.head.querySelector(`link[data-media][href="${href}"]`);
    if (old) old.remove();
    const l = document.createElement('link');
    l.rel = 'preconnect';
    l.href = href;
    l.setAttribute('data-media', '');
    document.head.appendChild(l);
  }
}

// Свайп назад / кнопка назад: сначала закрываем верхний слой (модалка, плеер),
// иначе возвращаемся на экран из истории. С самого первого экрана — обычный выход.
window.addEventListener('popstate', (e) => {
  if (document.getElementById('modal').classList.contains('open')) {
    _closePaywallNow();
    return;
  }
  const st = e.state;
  // Возврат внутрь квиза: восстанавливаем сохранённую фазу — шаг назад по вопросам, не выход.
  if (st && st.screen === 'quiz') {
    quiz.phase = st.qphase || 'intro';
    quiz.branch = st.qbranch || null;
    quiz.step = st.qstep || 0;
    screen = 'quiz';
    render();
    window.scrollTo(0, 0);
    return;
  }
  const name = st && st.screen ? st.screen : quizResult() ? 'today' : 'quiz';
  go(name, { fromHistory: true });
});

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* Раскрытые элементы (категории и описания) — живут до перезагрузки страницы.
   Все категории свёрнуты по умолчанию (решение 2026-07-18): с ростом библиотеки
   открытый список медитаций прятал бы сублиминалы и практики за длинной прокруткой. */
const openCats = new Set();
const openAbout = new Set();

function toggleCat(id) {
  openCats.has(id) ? openCats.delete(id) : openCats.add(id);
  render();
}

function toggleAbout(id) {
  openAbout.has(id) ? openAbout.delete(id) : openAbout.add(id);
  render();
}

function trackRow(t, { showAbout = false } = {}) {
  const locked = !hasAccess(t.id);
  const heard = !!listenedMap()[t.id];
  const aboutOpen = openAbout.has(t.id);
  const isCurrent = !!(playingTrack && playingTrack.id === t.id); // трек играет/на паузе прямо сейчас
  // Тап по названию/строке запускает трек (или показывает замок) — не только круглая кнопка.
  const rowAction = locked ? `openPaywall('${t.id}')` : `play('${t.id}')`;
  return `
    <div class="card">
      <div class="row">
        <div class="grow track-click" role="button" tabindex="0" onclick="${rowAction}"
             onkeydown="if(event.key==='Enter')${rowAction}">
          <div class="track-title">${heard ? '<span class="heard">✓</span> ' : ''}${esc(t.title)}</div>
          <div class="track-meta">${esc(t.type)} · ${esc(t.duration)}</div>
          ${t.type === 'сублиминал' ? '<span class="badge">дополнительный фон</span>' : ''}
        </div>
        ${
          locked
            ? `<button class="lock-btn" aria-label="Открыть доступ: ${esc(t.title)}" onclick="openPaywall('${t.id}')">🔒</button>`
            : isCurrent
              ? `<button class="play-mini playing" data-playing-toggle aria-label="Пауза или продолжить: ${esc(t.title)}" onclick="play('${t.id}')">${media.paused ? '▶' : '❚❚'}</button>`
              : `<button class="play-mini" aria-label="Слушать: ${esc(t.title)}" onclick="play('${t.id}')">▶</button>`
        }
      </div>
      ${
        showAbout
          ? `
        <button class="about-toggle" onclick="toggleAbout('${t.id}')">${aboutOpen ? 'Скрыть описание ▴' : 'Для чего эта практика ▾'}</button>
        ${aboutOpen ? `<p class="about-text">${esc(t.about)}</p>` : ''}`
          : ''
      }
    </div>`;
}

function renderToday() {
  const recs = recommendedIds();
  const lvl = level();
  const listened = listenedMap();

  if (lvl === 'none') {
    // Тест пройден, но не куплено: короткое напоминание результата + оффер.
    const q = quizResult();
    const insert = QUIZ_BRANCHES[q.branch].result.inserts[q.type];
    return `
      <div class="eyebrow">alenavesta</div>
      <h1>${greeting()}.</h1>
      <div class="card soft" style="margin-top:18px">
        <div class="eyebrow" style="margin-bottom:6px">Твой результат теста</div>
        <h2>${esc(insert.title)}</h2>
        <p class="dim small" style="margin-top:8px">${esc(insert.lead)}</p>
        <button class="btn ghost" onclick="go('quiz')">Смотреть результат полностью</button>
      </div>
      ${renderOffer(QUIZ_BRANCHES[q.branch].result)}`;
  }

  // Куплено: сегодняшняя практика = первая непрослушанная из набора.
  const next = recs.find((id) => !listened[id]) || recs[0] || Object.keys(TRACKS)[0];
  const t = TRACKS[next];
  const s = streak();
  const doneCount = recs.filter((id) => listened[id]).length;

  // Свёрнутый плеер: трек играет в фоне — показываем полоску, по тапу разворачиваем плеер.
  const nowPlaying = playingTrack
    ? `<button class="nowplaying" onclick="expandPlayer()">
         <span class="np-ico">♪</span>
         <span class="np-text"><b>Сейчас играет</b><span class="np-title">${esc(playingTrack.title)}</span></span>
         <span class="np-open">Открыть ▸</span>
       </button>`
    : '';

  return `
    ${nowPlaying}
    <div class="eyebrow">Твоя практика на сегодня</div>
    <h1>${greeting()}.</h1>
    <div class="tonight">
      <div class="halo-wrap">
        <div class="halo"></div>
        <button class="play-big" aria-label="Слушать практику" onclick="play('${t.id}')">▶</button>
      </div>
      <h2>${esc(t.title)}</h2>
      <p class="dim small" style="margin-top:6px">${esc(t.duration)} · включи и ложись, дальше всё само</p>
      ${s > 0 ? `<p class="streak"><b>${s}</b> ${plural(s, 'день подряд', 'дня подряд', 'дней подряд')}</p>` : ''}
    </div>
    <p class="dim small" style="margin-top:20px">Из твоего набора прослушано: ${doneCount} из ${recs.length}. Порядок свободный — выбрать другую практику можно в «Программе».</p>
    ${lvl === 'my' ? `<div class="card soft"><p class="dim small">В библиотеке ждут ещё практики. Тариф «${esc(PRICING.full.title)}» открывает всё сразу.</p><button class="btn ghost" onclick="go('library')">Посмотреть библиотеку</button></div>` : ''}
    ${installCard()}`;
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function renderProgram() {
  const recs = recommendedIds();
  const listened = listenedMap();
  const doneCount = recs.filter((id) => listened[id]).length;

  return `
    <div class="eyebrow">Программа</div>
    <h1>Мой набор</h1>
    <p class="dim" style="margin-top:12px">Практики, подобранные тестом под твоё корневое убеждение. Слушай в любом порядке — прослушанные отмечаются галочкой.</p>
    <p class="dim small" style="margin-top:10px">Прослушано: ${doneCount} из ${recs.length}</p>
    ${recs.map((id) => trackRow(TRACKS[id], { showAbout: true })).join('')}
    ${level() === 'none' ? `<div class="card soft"><p class="dim small">Набор откроется после оплаты. Пароль придёт на почту.</p><a class="btn" href="${BUY_URLS.tariffs}">Выбрать тариф и купить</a></div>` : ''}
    <hr class="divider" />
    ${
      level() === 'my'
        ? `
    <div class="card soft">
      <p class="dim small">Хочешь практики под другие сферы? «${esc(PRICING.full.title)}» открывает все медитации и сублиминалы, а тест можно проходить заново сколько угодно.</p>
      <a class="btn" href="${BUY_URLS.full}">Открыть всё за ${PRICING.full.price} ₽</a>
    </div>
    <button class="btn ghost" onclick="resetListened()">Сбросить отметки «прослушано»</button>
    <p class="dim small" style="margin-top:10px">Сброс снимет галочки, и программу можно пройти заново. Твой набор и доступ сохраняются.</p>`
        : `
    <button class="btn ghost" onclick="resetProgress()">Сбросить прогресс и пройти тест заново</button>
    <p class="dim small" style="margin-top:10px">Сброс снимет отметки «прослушано» и запустит тест с начала — набор подберётся заново. Купленный доступ сохраняется.</p>`
    }`;
}

function renderLibrary() {
  let html = `<div class="eyebrow">Библиотека</div><h1>Все практики</h1>`;
  for (const cat of CATEGORIES) {
    const ids = Object.keys(TRACKS).filter((id) => TRACKS[id].category === cat.id);
    const open = openCats.has(cat.id);
    html += `
      <button class="cat-head" onclick="toggleCat('${cat.id}')">
        <span>${esc(cat.title)}</span>
        <span class="cat-meta">${ids.length ? ids.length : ''} ${open ? '▴' : '▾'}</span>
      </button>`;
    if (open) {
      html += ids.length
        ? ids.map((id) => trackRow(TRACKS[id], { showAbout: true })).join('')
        : `<p class="dim small" style="padding:8px 4px 4px">${esc(cat.empty || 'Скоро появится.')}</p>`;
    }
  }
  // Скрытые VIP-разделы — видны только автору (level vip) и только когда каталог загружен.
  // Названия и состав берём из каталога, чтобы в публичном коде приложения их не было.
  if (level() === 'vip' && window.VIP_TRACKS) {
    const sections = window.VIP_SECTIONS || [{ id: 'celostnost', title: 'Закрытый раздел' }];
    for (const sec of sections) {
      const ids = Object.keys(window.VIP_TRACKS).filter((id) => window.VIP_TRACKS[id].category === sec.id);
      if (!ids.length) continue;
      const open = openCats.has(sec.id);
      html += `
      <button class="cat-head" onclick="toggleCat('${sec.id}')">
        <span>${esc(sec.title)}</span>
        <span class="cat-meta">${ids.length} ${open ? '▴' : '▾'}</span>
      </button>`;
      if (open) {
        html += ids.map((id) => trackRow(TRACKS[id], { showAbout: false })).join('');
      }
    }
  }
  if (level() === 'my') {
    html += `
    <div class="card soft" style="margin-top:18px">
      <p class="dim small">Хочешь практики под другие сферы? «${esc(PRICING.full.title)}» открывает все медитации и сублиминалы, а тест можно проходить заново сколько угодно.</p>
      <a class="btn" href="${BUY_URLS.full}">Открыть всё за ${PRICING.full.price} ₽</a>
    </div>`;
  } else if (level() === 'none') {
    html += `
    <div class="card soft" style="margin-top:18px">
      <p class="dim small">Практики открываются после оплаты. Пароль придёт на почту.</p>
      <a class="btn" href="${BUY_URLS.tariffs}">Выбрать тариф и купить</a>
    </div>`;
  }
  html += `<p class="dim small" style="margin-top:18px">Аудио сохраняется в телефон при первом прослушивании — дальше играет и без интернета. Видео-сублиминалы играют по интернету.</p>`;
  return html;
}

// 5 тапов по заголовку экрана «Доступ» открывают скрытое поле ввода особого пароля
// (нужно автору, когда уже открыт полный доступ и обычного поля пароля нет).
let _secretTaps = 0;
let _secretTimer = null;
function secretTap() {
  if (level() !== 'full' && level() !== 'vip') return; // на none/my поле и так есть
  if (window._secretCode) return;
  _secretTaps++;
  clearTimeout(_secretTimer);
  _secretTimer = setTimeout(() => { _secretTaps = 0; }, 2000);
  if (_secretTaps >= 5) {
    _secretTaps = 0;
    window._secretCode = true;
    render();
    toast('Введите особый пароль');
  }
}

function renderAccess() {
  const lvl = level();
  const names = { none: 'Доступ не открыт', my: `Тариф «${PRICING.my.title}»`, full: `Тариф «${PRICING.full.title}»`, vip: 'VIP-доступ' };
  const codeForm = `
      <input type="text" id="code-input" placeholder="Пароль из письма" autocomplete="off" />
      <div id="code-msg" class="msg" role="status"></div>`;
  // Скрытый ввод особого пароля: на «полных» уровнях поля пароля нет (всё уже открыто),
  // поэтому автору некуда ввести VIP-код. Появляется после 5 тапов по заголовку (secretTap),
  // чтобы обычные покупатели 1490 его не видели.
  const secretBlock = window._secretCode
    ? `
      <hr class="divider" />
      <p class="dim small" style="margin-top:12px">Особый пароль:</p>
      ${codeForm}
      <button class="btn ghost" onclick="applyCode('code-input','code-msg')">Открыть доступ</button>`
    : '';
  let body;
  if (lvl === 'vip') {
    body = '<p class="dim" style="margin-top:12px">Открыто всё, включая закрытый курс. Хорошего вечера.</p>' + secretBlock;
  } else if (lvl === 'full') {
    body = '<p class="dim" style="margin-top:12px">Открыто всё. Хорошего вечера.</p>' + secretBlock;
  } else if (lvl === 'my') {
    // Набор уже куплен — не предлагаем «выбрать тариф», только апгрейд до полной библиотеки.
    body = `
      <p class="dim" style="margin-top:12px">Твой набор открыт — он с тобой навсегда. Хочешь больше — «${esc(PRICING.full.title)}» открывает все практики: медитации и сублиминалы всех тем, включая будущие обновления.</p>
      <a class="btn" href="${BUY_URLS.full}">Открыть всё за ${PRICING.full.price} ₽</a>
      <p class="fomo" style="margin-top:18px">🔥 ${esc(FOMO.launch)}</p>
      <p class="dim small" style="margin-top:18px">После оплаты на почту придёт новый пароль — введи его здесь:</p>
      ${codeForm}
      <button class="btn ghost" onclick="applyCode('code-input','code-msg')">Открыть доступ</button>`;
  } else {
    body = `
      <p class="dim" style="margin-top:12px">Пароль приходит на почту после оплаты. Введи его — и практики откроются на этом телефоне.</p>
      ${codeForm}
      <button class="btn" onclick="applyCode('code-input','code-msg')">Открыть доступ</button>
      <p class="fomo" style="margin-top:18px">🔥 ${esc(FOMO.launch)}</p>
      <a class="btn ghost" href="${BUY_URLS.tariffs}">Выбрать тариф и купить</a>`;
  }
  return `
    <div class="eyebrow">Доступ</div>
    <h1 onclick="secretTap()" style="cursor:default">${names[lvl]}</h1>
    ${body}
    ${installCard()}
    <hr class="divider" />
    <p class="dim small">Вопросы и возврат — <a href="legal/kontakty.html">напиши нам</a>, отвечает живой человек. Гарантия возврата 14 дней.</p>
    <p class="dim small" style="margin-top:14px">Это практики для спокойствия и сна. Они не заменяют врача и не лечат болезни.</p>
    <p class="dim small" style="margin-top:14px">
      <a href="legal/oferta.html">Оферта</a> ·
      <a href="legal/privacy.html">Политика</a> ·
      <a href="legal/soglasie.html">Согласие</a> ·
      <a href="legal/kontakty.html">Контакты</a>
    </p>`;
}

/* ---------- Рендер ---------- */

const SCREENS = {
  quiz: renderQuiz,
  today: renderToday,
  program: renderProgram,
  library: renderLibrary,
  access: renderAccess,
};

function render() {
  document.getElementById('screen').innerHTML = SCREENS[screen]();
  syncPlayer();
  // Во время прохождения квиза нижнее меню прячем, чтобы не отвлекать.
  const inQuizFlow = screen === 'quiz' && quiz.phase !== 'result';
  document.querySelector('nav').style.display = inQuizFlow ? 'none' : '';
  document.querySelectorAll('nav button').forEach((b) => {
    b.classList.toggle('active', b.dataset.screen === screen || (screen === 'quiz' && b.dataset.screen === 'today'));
  });
}

// Плеер — главный экран вкладки «Сегодня»: показываем его вместо hero, когда играет трек.
// На других вкладках плеер скрыт, но звук продолжается (audio/video играют в фоне).
function syncPlayer() {
  const showPlayer = screen === 'today' && !!playingTrack && !playerCollapsed;
  document.getElementById('player').classList.toggle('open', showPlayer);
  document.getElementById('screen').style.display = showPlayer ? 'none' : '';
}

function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------- Старт ---------- */

document.querySelectorAll('nav button').forEach((b) => {
  b.addEventListener('click', () => go(b.dataset.screen));
});

document.querySelector('.player-close').addEventListener('click', collapsePlayer);
document.getElementById('player-toggle').addEventListener('click', togglePlay);
document.getElementById('player-repeat').addEventListener('click', toggleRepeat);
document.getElementById('modal-close').addEventListener('click', closePaywall);
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') closePaywall();
});

/* ---------- Клавиатура не должна перекрывать поля ---------- */
// Выехавшая клавиатура уменьшает visual-viewport, но фиксированная модалка привязана к
// layout-viewport и остаётся под клавиатурой. Пишем высоту клавиатуры в --kb — CSS модалки
// поднимает нижний лист над ней (style.css: #modal / .modal-card).
(function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return; // старые браузеры без API — остаёмся как было, без регресса
  const update = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', kb + 'px');
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
})();

// Тап по полю пароля в модалке: докручиваем поле в центр видимой зоны (над клавиатурой).
document.getElementById('modal').addEventListener('focusin', (e) => {
  if (e.target.tagName !== 'INPUT') return;
  setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
});

/* ---------- Автообновление приложения ---------- */
// Новая версия сайта = новый sw.js (бамп av-shell-vN). Браузер скачивает её в фоне,
// а человеку показываем плашку «Вышло обновление» — сам решает, обновить сейчас или позже.
// Посреди практики или теста плашку не показываем — предложим на паузе или после.

let updateReady = false;
let updateSnoozed = false; // нажал «Позже» — молчим до следующего возвращения в приложение

function offerUpdate() {
  if (!updateReady || updateSnoozed) return;
  const midQuiz = screen === 'quiz' && quiz.phase !== 'intro' && quiz.phase !== 'result';
  if (!media.paused || midQuiz) return;
  document.getElementById('update-banner').classList.add('show');
}

document.getElementById('update-now').addEventListener('click', () => location.reload());
document.getElementById('update-later').addEventListener('click', () => {
  updateSnoozed = true;
  document.getElementById('update-banner').classList.remove('show');
});

audio.addEventListener('pause', offerUpdate);
audio.addEventListener('ended', offerUpdate);
video.addEventListener('pause', offerUpdate);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      // Проверяем новую версию при каждом возвращении в приложение и раз в час.
      const checkUpdate = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          checkUpdate();
          updateSnoozed = false; // человек вернулся — можно предложить снова
          offerUpdate();
        }
      });
      setInterval(checkUpdate, 60 * 60 * 1000);
    })
    .catch(() => {});

  // Смена активного воркера = новая версия скачана и готова.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; } // самая первая установка — не предлагаем
    updateReady = true;
    offerUpdate();
  });
}

// VIP-автор: если уровень vip и сохранён ключ каталога — подтягиваем скрытый курс молча.
if (level() === 'vip') {
  const vk = store.read().vk;
  if (vk) loadVipCatalog(vk);
}

// Первый запуск (нет результата квиза) → квиз. Иначе — «Сегодня».
if (!quizResult()) {
  quizStart();
} else {
  quiz.phase = 'result'; // чтобы «Смотреть результат полностью» показывал сохранённый результат
  go('today');
}
// Стартовый экран — первая запись в истории; дальше go() добавляет по записи на переход.
// Для квиза несём и фазу, чтобы первый шаг назад из квиза был корректным.
history.replaceState(screen === 'quiz' ? quizState() : { screen }, '');
navReady = true;
