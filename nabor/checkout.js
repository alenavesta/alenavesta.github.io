'use strict';
/*
  Своя форма оплаты (модалка) → ЮMoney. Общий файл для index.html и full.html.
  Подключается тегом <script src="checkout.js"></script>. Сам вставляет на страницу
  разметку модалки и её стили, и открывается вызовом window.openCheckout(тариф, тема).

  Поток: кнопка «Купить» → модалка (имя+email) → «Перейти к оплате» →
  экран «Готовим ссылку…» → заявка уходит в backend (Apps Script, база+письмо) →
  переадресация на ЮMoney quickpay с label=orderId.
*/
(function () {

  /* ==========================================================================
     НАСТРОЙКИ — заполни эти три строки.
     ========================================================================== */

  // 1) Номер твоего кошелька ЮMoney (вид 4100XXXXXXXXX). Обязательно.
  var YOOMONEY_WALLET = '410012436978849';

  // 2) Адрес Google Apps Script (backend: база заявок + письмо владельцу).
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwl4nd0PfY0HdkcgVJ-W1J5XOURlRc-lAf11AFRm3xRcbDM32kieDurH8EjWESdFqQqOQ/exec';

  // 3) Куда вернуть человека после оплаты (страница «спасибо»).
  var SUCCESS_URL = 'https://alenavesta.github.io/nabor/spasibo.html';

  /* ========================================================================== */

  var TARIFFS = {
    490:  { title: 'Мой набор',      price: 490,  target: 'Практики Алёны Весты — «Мой набор»' },
    1490: { title: 'Вся библиотека', price: 1490, target: 'Практики Алёны Весты — «Вся библиотека»' }
  };

  var currentTariff = 490;
  var currentTheme = 'son';

  /* ---- стили модалки (используем токены лендинга, с запасными значениями) ---- */
  var CSS = [
    '.co-overlay{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;',
    'padding:20px;background:rgba(7,11,18,.74);backdrop-filter:blur(4px);}',
    '.co-overlay.open{display:flex;}',
    '.co-card{position:relative;width:100%;max-width:420px;background:var(--surface,#131c2b);',
    'border:1px solid var(--line,#223048);border-radius:var(--radius,20px);padding:26px 22px;',
    'color:var(--ink,#f0e7da);font-family:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif;',
    'max-height:92vh;overflow-y:auto;}',
    '.co-close{position:absolute;top:12px;right:14px;background:none;border:none;color:var(--ink-faint,#67728a);',
    'font-size:22px;line-height:1;cursor:pointer;padding:4px;}',
    '.co-eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint,#67728a);margin-bottom:8px;}',
    '.co-title{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:23px;color:var(--amber,#d9a868);margin-bottom:8px;}',
    '.co-sub{color:var(--ink-dim,#9ba4b3);font-size:14.5px;margin-bottom:20px;}',
    '.co-label{display:block;font-size:13.5px;color:var(--ink-dim,#9ba4b3);margin-bottom:16px;}',
    '.co-label input{display:block;width:100%;margin-top:7px;padding:14px 14px;font-size:16px;',
    'font-family:inherit;color:var(--ink,#f0e7da);background:var(--surface-2,#182335);',
    'border:1px solid var(--line,#223048);border-radius:12px;}',
    '.co-label input:focus{outline:none;border-color:var(--amber,#d9a868);}',
    '.co-error{color:#c98872;font-size:14px;margin-bottom:14px;}',
    '.co-btn{display:block;width:100%;padding:16px 20px;font-size:17px;font-weight:600;cursor:pointer;',
    'text-align:center;color:#1a1408;background:var(--amber,#d9a868);border:none;border-radius:16px;',
    'font-family:inherit;transition:background .15s ease;}',
    '.co-btn:hover{background:#e4b87c;}',
    '.co-btn:disabled{opacity:.6;cursor:default;}',
    '.co-legal{margin-top:14px;text-align:center;font-size:12.5px;color:var(--ink-faint,#67728a);}',
    '.co-consent{display:flex;gap:10px;align-items:flex-start;margin-bottom:16px;',
    'font-size:12.5px;line-height:1.5;color:var(--ink-faint,#67728a);text-align:left;cursor:pointer;}',
    '.co-consent input{flex:0 0 auto;width:18px;height:18px;margin-top:1px;accent-color:var(--amber,#d9a868);cursor:pointer;}',
    '.co-consent a{color:var(--amber,#d9a868);}',
    '.co-loading{text-align:center;padding:34px 6px;}',
    '.co-loading p{color:var(--ink-dim,#9ba4b3);margin-top:8px;}',
    '.co-spinner{width:40px;height:40px;margin:0 auto 18px;border:3px solid var(--line,#223048);',
    'border-top-color:var(--amber,#d9a868);border-radius:50%;animation:co-spin .8s linear infinite;}',
    '@keyframes co-spin{to{transform:rotate(360deg);}}'
  ].join('');

  /* ---- разметка модалки ---- */
  var HTML =
    '<div class="co-card" role="dialog" aria-modal="true" aria-label="Оформление">' +
      '<button class="co-close" type="button" aria-label="Закрыть">✕</button>' +
      '<div class="co-step-form">' +
        '<div class="co-eyebrow">Оформление</div>' +
        '<div class="co-title"></div>' +
        '<p class="co-sub">Впиши имя и почту — на неё придёт пароль доступа после оплаты.</p>' +
        '<form class="co-form" novalidate>' +
          '<label class="co-label">Имя' +
            '<input class="co-name" type="text" name="name" autocomplete="name" required>' +
          '</label>' +
          '<label class="co-label">Email' +
            '<input class="co-email" type="email" name="email" autocomplete="email" inputmode="email" required>' +
          '</label>' +
          '<div class="co-error" hidden></div>' +
          '<label class="co-consent"><input type="checkbox" class="co-agree">' +
            '<span>Соглашаюсь на <a href="../app-v2/legal/soglasie.html" target="_blank" rel="noopener">обработку персональных данных</a> ' +
            'и принимаю <a href="../app-v2/legal/oferta.html" target="_blank" rel="noopener">оферту</a> ' +
            'и <a href="../app-v2/legal/privacy.html" target="_blank" rel="noopener">политику конфиденциальности</a>.</span></label>' +
          '<button class="co-btn co-submit" type="submit">Перейти к оплате</button>' +
        '</form>' +
      '</div>' +
      '<div class="co-step-loading co-loading" hidden>' +
        '<div class="co-spinner"></div>' +
        '<p>Готовим твою ссылку на оплату…</p>' +
      '</div>' +
    '</div>';

  /* ---- собираем модалку в DOM один раз ---- */
  var overlay, elTitle, elFormStep, elLoadStep, elForm, elName, elEmail, elError, elSubmit, elAgree;

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.className = 'co-overlay';
    overlay.innerHTML = HTML;
    document.body.appendChild(overlay);

    elTitle = overlay.querySelector('.co-title');
    elFormStep = overlay.querySelector('.co-step-form');
    elLoadStep = overlay.querySelector('.co-step-loading');
    elForm = overlay.querySelector('.co-form');
    elName = overlay.querySelector('.co-name');
    elEmail = overlay.querySelector('.co-email');
    elError = overlay.querySelector('.co-error');
    elSubmit = overlay.querySelector('.co-submit');
    elAgree = overlay.querySelector('.co-agree');

    overlay.querySelector('.co-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    elForm.addEventListener('submit', onSubmit);
  }

  /* ---- открыть / закрыть ---- */
  function open(tariff, theme) {
    if (!overlay) build();
    currentTariff = TARIFFS[tariff] ? tariff : 490;
    currentTheme = theme || 'son';
    elTitle.textContent = TARIFFS[currentTariff].title + ' — ' + TARIFFS[currentTariff].price + ' ₽';
    elError.hidden = true;
    elFormStep.hidden = false;
    elLoadStep.hidden = true;
    elSubmit.disabled = false;
    elAgree.checked = false;
    overlay.classList.add('open');
    setTimeout(function () { try { elName.focus(); } catch (e) {} }, 60);
  }

  function close() {
    if (overlay) overlay.classList.remove('open');
  }

  /* ---- orderId: AV-ГГГГММДД-XXXXXX (генерим в браузере до отправки) ---- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function makeOrderId() {
    var d = new Date();
    var ymd = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return 'AV-' + ymd + '-' + s;
  }

  /* ---- ссылка на оплату ЮMoney (личный кошелёк, форма-кнопка) ---- */
  function yoomoneyUrl(tariff, orderId) {
    var p = new URLSearchParams();
    p.set('receiver', YOOMONEY_WALLET);
    p.set('quickpay-form', 'button');
    p.set('sum', String(TARIFFS[tariff].price));
    p.set('label', orderId);
    p.set('targets', TARIFFS[tariff].target);
    p.set('successURL', SUCCESS_URL);
    return 'https://yoomoney.ru/quickpay/confirm.xml?' + p.toString();
  }

  /* ---- отправка заявки в backend. Никогда не «падает»: даже если не ушло,
         редирект всё равно делаем (email сохранит серверный обработчик). ---- */
  function saveLead(lead) {
    if (!APPS_SCRIPT_URL) return Promise.resolve();
    return fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      // text/plain → «простой» запрос без CORS-preflight (Apps Script не отвечает на OPTIONS)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(lead)
    }).then(function () {}, function () {});
  }

  function showError(msg) {
    elError.textContent = msg;
    elError.hidden = false;
  }

  function onSubmit(e) {
    e.preventDefault();
    var name = elName.value.trim();
    var email = elEmail.value.trim();
    if (name.length < 2) { showError('Впиши, пожалуйста, имя'); elName.focus(); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showError('Проверь адрес почты'); elEmail.focus(); return; }
    if (!elAgree.checked) { showError('Отметь согласие на обработку данных'); return; }
    elError.hidden = true;
    elSubmit.disabled = true;

    var orderId = makeOrderId();
    var payUrl = yoomoneyUrl(currentTariff, orderId);
    var lead = {
      name: name,
      email: email,
      tariff: TARIFFS[currentTariff].price,
      theme: currentTheme,
      orderId: orderId,
      page: location.pathname,
      consent: true,
      consentAt: new Date().toISOString()
    };

    // экран «Готовим ссылку…»
    elFormStep.hidden = true;
    elLoadStep.hidden = false;

    // ждём и отправку заявки, и минимум ~1.6 с (чтобы человек увидел экран и запрос успел уйти)
    var minWait = new Promise(function (r) { setTimeout(r, 1600); });
    Promise.all([saveLead(lead), minWait]).then(function () {
      location.href = payUrl;
    });
  }

  window.openCheckout = open;
})();
