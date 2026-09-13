/**
 * Появление при скролле — перенос StaggeredFadeIn из main.built.js.
 *
 * Главное в оригинале: наблюдают за группой, а не за элементами.
 * Компонент висит на контейнере ([data-component-list*=StaggeredFadeIn]),
 * внутри собирает querySelectorAll("[data-staggered-item]") и при
 * срабатывании (start: "t - 85vh") заводит одну шкалу времени, где
 * у элемента с номером i сдвиг начинается в i * DELAY.
 *
 * Своих наблюдателей у элементов нет — и это важно для каруселей:
 * карточка, уехавшая вбок за край экрана, для наблюдателя невидима,
 * и с поэлементным слежением она появлялась бы не вместе с блоком,
 * а в момент, когда её пролистают стрелкой.
 */

// start: "t - 85vh" — группа стартует, когда её верх доходит до 85vh.
// Для наблюдателя это то же самое, что ужать нижнюю границу на 15%.
const OPTIONS = { rootMargin: '0px 0px -15% 0px', threshold: 0 };

// Страховка. Появление — украшение, и оно не имеет права скрыть текст
// насовсем. Если наблюдатель по любой причине не завёлся (страница
// в чужом фрейме, прокрутку ведёт родитель, ошибка в другом модуле) —
// через это время всё показывается принудительно.
//
// Снимается по первому вызову наблюдателя: IntersectionObserver зовёт
// колбэк сразу после observe(), с начальным состоянием целей, поэтому
// сам факт вызова доказывает, что он жив.
const FAILSAFE_MS = 1600;

export function initReveal(root = document) {
  const items = [...root.querySelectorAll('[data-reveal]')];
  if (!items.length) return;

  // Без поддержки — просто показать, ничего не пряча
  if (!('IntersectionObserver' in window)) return;

  // Группа → её элементы. Элемент вне групп — сам себе группа.
  const groups = new Map();
  items.forEach((el, i) => {
    const anchor = el.closest('[data-reveal-group]') || el;
    if (!groups.has(anchor)) groups.set(anchor, []);
    const list = groups.get(anchor);
    // Номер внутри группы, а не сквозной по странице
    el.style.setProperty('--reveal-index', String(anchor === el ? 0 : list.length));
    list.push(el);
  });

  const pending = new Set(groups.keys());
  let observer;

  function reveal(anchor) {
    const list = groups.get(anchor);
    if (!list || !pending.delete(anchor)) return;
    if (observer) observer.unobserve(anchor);
    list.forEach((el) => {
      el.setAttribute('data-revealed', '');
      // will-change снимаем по прозрачности: она длиннее сдвига,
      // снять раньше — получить перерисовку посреди анимации
      const done = (e) => {
        if (e.propertyName !== 'opacity') return;
        el.removeEventListener('transitionend', done);
        el.style.willChange = 'auto';
      };
      el.addEventListener('transitionend', done);
    });
  }

  function showAll() {
    [...pending].forEach(reveal);
  }

  // Наблюдатель ловит только вошедшее в кадр. Мимо прокрученное он не
  // заметит: у такого элемента состояние не менялось — он и был,
  // и остался за кадром. Без этого прыжок по якорю или в самый низ
  // оставлял пройденные секции пустыми навсегда.
  function sweepPassed() {
    [...pending].forEach((anchor) => {
      if (anchor.getBoundingClientRect().bottom < 0) reveal(anchor);
    });
    if (!pending.size) window.removeEventListener('scroll', onScroll);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      sweepPassed();
    });
  }

  // Прятать можно только теперь, когда есть кому показать обратно
  document.documentElement.classList.add('reveal-ready');
  const failsafe = setTimeout(showAll, FAILSAFE_MS);

  observer = new IntersectionObserver((entries) => {
    clearTimeout(failsafe);
    entries.forEach((entry) => {
      if (entry.isIntersecting) reveal(entry.target);
    });
  }, OPTIONS);

  groups.forEach((_, anchor) => observer.observe(anchor));

  window.addEventListener('scroll', onScroll, { passive: true });
  // Страница могла открыться уже прокрученной: возврат по истории,
  // переход сразу на #якорь.
  sweepPassed();
}
