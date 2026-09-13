/**
 * Буквы заголовков.
 *
 * Заголовок разбирается на буквы: каждая влетает крупнее, повёрнутой
 * и цветной, перебирая символы, потом садится в нормальный размер
 * и обычный цвет. При наведении то же повторяет одна буква — та,
 * на которую навели.
 *
 * Разбор делает JS, а не разметка: в исходном HTML заголовки остаются
 * обычным текстом, и без JS страница читается как ни в чём не бывало.
 *
 * Запуск — по появлению заголовка в кадре, тем же порогом, что и у
 * остального появления на странице. Заголовок первого экрана виден
 * сразу, поэтому он и стартует сразу, отдельного случая для него нет.
 */

// Тот же порог, что в reveal.js: start: "t - 85vh" у StaggeredFadeIn
const OPTIONS = { rootMargin: '0px 0px -15% 0px', threshold: 0 };

// Набор для перебора: знаки, из которых обычно набирают ascii-арт.
// Кириллицы здесь нет намеренно — иначе перебор читается как опечатки
// в тексте, а не как машинный перебор.
//
// Широкие знаки ($ & @ % —) выкинуты: знак висит поверх буквы по
// центру и вне потока, поэтому тот, что шире своего бокса, наезжает
// на соседей. На крупном кегле это выглядит поломкой, а не помехами.
const GLYPHS = '01<>[]{}/\\|=+*#?!:;';
const SCRAMBLE_MS = 380;   // короче подскока: знак должен успеть встать
const SWAP_MS = 130;       // около трёх смен за перебор

const PALETTE = 5;

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Разброс считаем от номера буквы, а не через Math.random: картинка
// должна быть одной и той же при каждой загрузке — иначе её не сверить
// на скриншотах и не воспроизвести баг.
function noise(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function decorate(letter, i) {
  letter.style.setProperty('--letter-index', String(i));
  letter.style.setProperty('--letter-color', `var(--c-letter-${Math.floor(noise(i + 3) * PALETTE)})`);
  letter.style.setProperty('--letter-scale', (1.25 + noise(i) * 0.6).toFixed(3));
  letter.style.setProperty('--letter-tilt', `${((noise(i + 7) * 2 - 1) * 12).toFixed(2)}deg`);
  letter.style.setProperty('--letter-rise', `${((noise(i + 13) * 2 - 1) * 0.18).toFixed(3)}em`);
}

/* ------------------------------------------------------------------
   Перебор символов

   Одна общая петля кадров на все буквы страницы, а не таймер на каждую:
   букв под сотню, и столько же независимых таймеров дали бы столько же
   несогласованных пробуждений на кадр.
   ------------------------------------------------------------------ */

const scrambling = new Map();
let frame = 0;

function tick(now) {
  frame = 0;
  scrambling.forEach((state, letter) => {
    if (now >= state.until) {
      letter.removeAttribute('data-scrambling');
      letter.removeAttribute('data-glyph');
      scrambling.delete(letter);
      return;
    }
    if (now >= state.next) {
      letter.dataset.glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      state.next = now + SWAP_MS;
    }
  });
  if (scrambling.size) frame = requestAnimationFrame(tick);
}

function scramble(letter) {
  letter.setAttribute('data-scrambling', '');
  scrambling.set(letter, { until: performance.now() + SCRAMBLE_MS, next: 0 });
  if (!frame) frame = requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------
   Разбор
   ------------------------------------------------------------------ */

function split(title) {
  const text = title.textContent.trim();

  // Обходим все текстовые узлы, а не только верхние: внутри заголовков
  // есть маркеры («Факты.», «вопросы?») и стикеры. Буквы должны попасть
  // внутрь маркера, а картинку трогать нельзя — обход её не увидит.
  const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  let i = 0;
  nodes.forEach((node) => {
    if (!node.textContent.trim()) return;

    const out = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        out.append(part);
        return;
      }
      const word = document.createElement('span');
      word.className = 'letters__word';
      for (const ch of part) {
        const letter = document.createElement('span');
        letter.className = 'letters__letter';
        // Настоящий знак живёт во вложенном span: во время перебора он
        // прячется, но продолжает держать ширину буквы.
        const glyph = document.createElement('span');
        glyph.className = 'letters__glyph';
        glyph.textContent = ch;
        letter.append(glyph);
        decorate(letter, i);
        i += 1;
        word.append(letter);
      }
      out.append(word);
    });
    node.replaceWith(out);
  });

  // Маркер заезжает вместе со своей первой буквой, иначе его подложка
  // висит пустой, пока буквы на ней ещё не пришли.
  title.querySelectorAll('.marker').forEach((marker) => {
    const first = marker.querySelector('.letters__letter');
    if (first) marker.style.setProperty('--letter-index', first.style.getPropertyValue('--letter-index'));
  });

  // Заголовок теперь набран отдельными кусками. Программе чтения с
  // экрана это читать не нужно — отдаём ей исходную строку целиком.
  title.setAttribute('aria-label', text);
  title.setAttribute('data-letters', '');
}

function listen(title) {
  // Перебор запускаем по началу самой анимации, а не своим таймером:
  // animationstart приходит уже после задержки, поэтому перебор сам
  // попадает в такт каскаду и в подскок по наведению — и остаётся
  // в такте, если поменять задержку в CSS.
  title.addEventListener(
    'animationstart',
    (event) => {
      const letter = event.target;
      if (!(letter instanceof Element) || !letter.classList.contains('letters__letter')) return;
      scramble(letter);
    },
    true
  );

  // Отыграла — помечаем. Снять data-bounce мало: без этой пометки
  // буква возвращалась бы к letter-in с его задержкой и пропадала
  // на время этой задержки.
  title.addEventListener(
    'animationend',
    (event) => {
      const letter = event.target;
      if (!(letter instanceof Element) || !letter.classList.contains('letters__letter')) return;
      letter.removeAttribute('data-bounce');
      letter.setAttribute('data-settled', '');
    },
    true
  );

  // Повтор по наведению — только там, где есть настоящий курсор.
  // На тач-экране pointerover приходит по касанию, и буквы прыгали бы
  // от попытки прокрутить страницу.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  title.addEventListener('pointerover', (event) => {
    const letter = event.target.closest('.letters__letter');
    if (!letter || !title.contains(letter)) return;
    // Пока буква прыгает — новых запусков не принимаем. Во время
    // подскока она меняет размер и положение, курсор из-за этого то
    // выходит из неё, то входит обратно, и pointerover прилетает
    // снова и снова. Без защёлки буква перезапускалась бы бесконечно,
    // пока на ней держат мышь.
    if (letter.hasAttribute('data-bounce')) return;
    letter.setAttribute('data-bounce', '');
  });
}

export function initLetters(root = document) {
  const titles = [...root.querySelectorAll('[data-letters-split]')];
  if (!titles.length || reducedMotion()) return;

  titles.forEach((title) => {
    split(title);
    listen(title);
  });

  const play = (title) => title.setAttribute('data-letters-play', '');

  // Без наблюдателя показываем сразу: заголовок спрятан до запуска,
  // и оставить его спрятанным нельзя ни при каких обстоятельствах.
  if (!('IntersectionObserver' in window)) {
    titles.forEach(play);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      play(entry.target);
      observer.unobserve(entry.target);
    });
  }, OPTIONS);

  titles.forEach((title) => observer.observe(title));

  // Заголовок, мимо которого прокрутили, наблюдатель не заметит —
  // у него состояние не менялось. Та же беда, что была в reveal.js.
  const sweep = () => {
    titles.forEach((title) => {
      if (title.hasAttribute('data-letters-play')) return;
      if (title.getBoundingClientRect().bottom < 0) {
        play(title);
        observer.unobserve(title);
      }
    });
    if (titles.every((t) => t.hasAttribute('data-letters-play'))) {
      window.removeEventListener('scroll', onScroll);
    }
  };

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      sweep();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  sweep();
}
