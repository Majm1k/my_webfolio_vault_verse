/**
 * Карусель. Прокрутка нативная — JS отвечает только за стрелки
 * и за их блокировку на краях.
 *
 * Стрелки листают своей анимацией, а не scrollTo({ behavior: 'smooth' }).
 * Внутри контейнера с обязательной привязкой (scroll-snap-type: x mandatory)
 * встроенная плавная прокрутка ненадёжна: браузер доводит её до ближайшей
 * точки привязки и гасит, а Safari к элементам её долго не применял вовсе —
 * стрелки просто не работали. Свой tween ведёт себя одинаково везде.
 */

const EDGE = 1; // запас на дробные пиксели scrollLeft
const SLIDE_MS = 520;

// Примерно cubic-bezier(.4, 0, .6, 1) — кривая переходов состояний проекта
function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setup(carousel) {
  const track = carousel.querySelector('[data-carousel-track]');
  const prev = carousel.querySelector('[data-carousel-prev]');
  const next = carousel.querySelector('[data-carousel-next]');
  if (!track || !prev || !next) return;

  // Позиции прокрутки, при которых карточка встаёт к левому полю
  function stops() {
    const pad = parseFloat(getComputedStyle(track).paddingInlineStart) || 0;
    return [...track.querySelectorAll('.carousel__item')].map((el) => el.offsetLeft - pad);
  }

  // Предел прокрутки меряем на ресайзе, а не на каждом событии:
  // scrollWidth форсирует пересчёт раскладки, scrollLeft — нет.
  let maxScroll = 0;
  let frame = 0;

  function measure() {
    maxScroll = track.scrollWidth - track.clientWidth;
    carousel.toggleAttribute('data-carousel-static', maxScroll <= EDGE);
    sync();
  }

  function sync() {
    prev.disabled = track.scrollLeft <= EDGE;
    next.disabled = track.scrollLeft >= maxScroll - EDGE;
  }

  function stopSlide() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
    // Привязку возвращаем на месте: где отпустили, туда и притянет.
    track.style.scrollSnapType = '';
  }

  function slideTo(target) {
    stopSlide();
    const from = track.scrollLeft;
    const distance = target - from;
    if (reducedMotion() || Math.abs(distance) < EDGE) {
      track.scrollLeft = target;
      sync();
      return;
    }

    // Привязку снимаем инлайновым стилем, а не классом: он применяется
    // сразу, до первого кадра, и обязательная привязка не успевает
    // перехватить движение.
    track.style.scrollSnapType = 'none';
    const started = performance.now();

    const step = (now) => {
      const progress = Math.min((now - started) / SLIDE_MS, 1);
      track.scrollLeft = from + distance * ease(progress);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      frame = 0;
      track.style.scrollSnapType = '';
      sync();
    };

    frame = requestAnimationFrame(step);
  }

  function go(direction) {
    const now = track.scrollLeft;
    const list = stops();
    let target =
      direction > 0
        ? list.find((x) => x > now + EDGE)
        : [...list].reverse().find((x) => x < now - EDGE);
    if (target === undefined) target = direction > 0 ? maxScroll : 0;
    slideTo(Math.max(0, Math.min(target, maxScroll)));
  }

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));

  // Тронули колесом или пальцем — листание уступает: тянуть ленту
  // к своей цели, пока её крутят руками, некрасиво.
  track.addEventListener('wheel', stopSlide, { passive: true });
  track.addEventListener('pointerdown', stopSlide, { passive: true });

  track.addEventListener('scroll', sync, { passive: true });

  if ('ResizeObserver' in window) {
    new ResizeObserver(measure).observe(track);
  } else {
    window.addEventListener('resize', measure, { passive: true });
  }

  measure();
}

export function initCarousels(root = document) {
  root.querySelectorAll('[data-carousel]').forEach(setup);
}
