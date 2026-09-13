/**
 * Панель поверх страницы для блока «Больше, чем просто факты».
 *
 * Механика .modal из overview.built.css: панель выезжает снизу
 * за 0.8s по cubic-bezier(.65,0,.35,1), подложка гаснет вдвое быстрее,
 * visibility снимается только по окончании — иначе панель пропала бы
 * рывком посреди движения.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

let modal;
let panel;
let scrim;
let closeBtn;
let elEyebrow;
let elTitle;
let elBody;
let elPage;
let lastTrigger = null;
let hideTimer = 0;
let scrollLocked = false;

function lockScroll() {
  if (scrollLocked) return;
  const root = document.documentElement;
  const bar = window.innerWidth - root.clientWidth;
  root.style.paddingRight = bar + 'px';
  root.style.overflow = 'hidden';
  scrollLocked = true;
}

function unlockScroll() {
  if (!scrollLocked) return;
  const root = document.documentElement;
  root.style.paddingRight = '';
  root.style.overflow = '';
  scrollLocked = false;
}

function slideMs() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  const raw = getComputedStyle(modal).getPropertyValue('--modal-dur').trim();
  const value = parseFloat(raw) || 0;
  return raw.endsWith('ms') ? value : value * 1000;
}

function trapFocus(event) {
  const items = [...panel.querySelectorAll(FOCUSABLE)];
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
  } else if (event.key === 'Tab') {
    trapFocus(event);
  }
}

// Общая часть открытия: замок прокрутки, выезд панели, фокус.
function show(trigger) {
  lastTrigger = trigger;
  clearTimeout(hideTimer);
  lockScroll();
  modal.hidden = false;
  // Чтение геометрии фиксирует закрытое состояние, чтобы движение
  // стартовало с него, а не перескочило. Через requestAnimationFrame
  // было бы ненадёжно: в фоновой вкладке кадры не идут.
  void modal.offsetWidth;
  modal.setAttribute('data-open', '');
  // preventScroll обязателен: в этот момент панель ещё сдвинута на 100vh
  // вниз, и обычный focus() уводил бы страницу под ней на экран вниз.
  closeBtn.focus({ preventScroll: true });
  document.addEventListener('keydown', onKeydown);
}

// Короткий текст с самой карточки
function open(card, trigger) {
  const eyebrow = card.querySelector('.story__eyebrow');
  const title = card.querySelector('.story__title');
  const detail = card.querySelector('[data-card-detail]');

  elEyebrow.textContent = eyebrow ? eyebrow.textContent.trim() : '';
  elTitle.textContent = title ? title.textContent.trim() : '';
  elBody.innerHTML = detail ? detail.innerHTML : '';
  modal.dataset.theme = card.dataset.theme || 'dark';
  modal.removeAttribute('data-page');
  elPage.hidden = true;
  modal.querySelector('.modal__inner').hidden = false;
  panel.removeAttribute('aria-label');
  panel.setAttribute('aria-labelledby', 'modal-title');

  show(trigger);
}

/* ------------------------------------------------------------------
   Отдельная страница внутри панели

   Файл кейса самодостаточен: шрифт и картинки в нём встроены, разметка
   и стили изолированы в .nlc, а его скрипт сам находит свой корень.
   Поэтому достаточно перенести содержимое <body> как есть.
   ------------------------------------------------------------------ */

let loaded = null;   // разобранный документ, чтобы не тянуть его дважды

function runScripts(host) {
  // Скрипты, вставленные через innerHTML, не выполняются: браузер
  // намеренно их не запускает. Пересоздаём узел — копия уже исполнится.
  host.querySelectorAll('script').forEach((old) => {
    const fresh = document.createElement('script');
    [...old.attributes].forEach((attr) => fresh.setAttribute(attr.name, attr.value));
    fresh.textContent = old.textContent;
    old.replaceWith(fresh);
  });
}

async function openPage(url, trigger) {
  modal.dataset.theme = 'dark';
  modal.setAttribute('data-page', '');
  modal.querySelector('.modal__inner').hidden = true;
  elPage.hidden = false;
  // Заголовок панели в этом режиме берём с карточки прямо в aria-label:
  // ссылаться на .modal__title нельзя — вместе с .modal__inner он скрыт.
  panel.removeAttribute('aria-labelledby');
  panel.setAttribute('aria-label', trigger.querySelector('.story__title')?.textContent.trim() || 'Кейс');

  if (!loaded) {
    elPage.setAttribute('data-loading', '');
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    loaded = new DOMParser().parseFromString(await response.text(), 'text/html');
    elPage.removeAttribute('data-loading');
  }

  elPage.replaceChildren(...[...loaded.body.childNodes].map((node) => node.cloneNode(true)));
  runScripts(elPage);
  show(trigger);
}

function close() {
  if (modal.hidden || !modal.hasAttribute('data-open')) return;
  modal.removeAttribute('data-open');
  document.removeEventListener('keydown', onKeydown);
  if (lastTrigger) {
    lastTrigger.focus({ preventScroll: true });
    lastTrigger = null;
  }
  clearTimeout(hideTimer);
  // Замок снимается вместе с hidden, а не сразу: вернуть полосу прокрутки
  // посреди уезжающей панели — значит дёрнуть страницу вбок на её ширину.
  hideTimer = setTimeout(() => {
    modal.hidden = true;
    modal.scrollTop = 0;
    unlockScroll();
    // Страница кейса тяжёлая, и её анимации продолжали бы жить
    // в скрытой панели. Разбор остаётся в памяти, разметка — нет.
    if (elPage) elPage.replaceChildren();
  }, slideMs());
}

export function initModal(root = document) {
  modal = root.querySelector('[data-modal]');
  if (!modal) return;

  panel = modal.querySelector('[data-modal-panel]');
  scrim = modal.querySelector('[data-modal-scrim]');
  closeBtn = modal.querySelector('[data-modal-close]');
  elEyebrow = modal.querySelector('[data-modal-eyebrow]');
  elTitle = modal.querySelector('[data-modal-title]');
  elBody = modal.querySelector('[data-modal-body]');
  elPage = modal.querySelector('[data-modal-page]');

  closeBtn.addEventListener('click', close);
  scrim.addEventListener('click', close);

  root.querySelectorAll('[data-card]').forEach((card) => {
    const trigger = card.querySelector('[data-card-open]');
    if (!trigger) return;
    trigger.addEventListener('click', () => open(card, trigger));
  });

  // Карточка остаётся ссылкой на страницу: без JS она туда и уводит,
  // а с JS страница открывается панелью поверх сайта. Если загрузить
  // не удалось — не молчим, а отдаём переход по той же ссылке.
  root.querySelectorAll('[data-card-page]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      openPage(link.dataset.cardPage, link).catch(() => {
        window.location.href = link.href;
      });
    });
  });
}

export { close as closeModal };
