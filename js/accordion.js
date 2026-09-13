/**
 * FAQ. Нативный <details> раскрывается мгновенно, поэтому закрытие
 * приходится придержать: снимаем open только после того, как отыграет
 * переход высоты.
 *
 * Высота — единственное место в проекте, где анимируется не transform
 * и не opacity: смысл аккордеона в изменении размера, подменить его
 * нечем. Строка одна, соседей мало, пересчёт дешёвый.
 */

function setup(details) {
  const summary = details.querySelector('summary');
  const body = details.querySelector('.qa__body');
  if (!summary || !body) return;

  let closing = false;

  summary.addEventListener('click', (event) => {
    event.preventDefault();

    if (details.open && !closing) {
      closing = true;
      details.setAttribute('data-closing', '');
      const done = () => {
        details.open = false;
        details.removeAttribute('data-closing');
        closing = false;
      };
      const onEnd = (e) => {
        if (e.target !== body) return;
        body.removeEventListener('transitionend', onEnd);
        done();
      };
      body.addEventListener('transitionend', onEnd);
      // страховка, если перехода не было (reduced motion, display:none).
      // Срок берём из самого перехода с запасом: зашитое число совпало
      // бы с длительностью и обрывало анимацию на последнем кадре.
      setTimeout(() => {
        if (closing) {
          body.removeEventListener('transitionend', onEnd);
          done();
        }
      }, closeMs(body) + 100);
      return;
    }

    if (!details.open) {
      // Аккордеон: открытый вопрос закрывается сразу, без придержки —
      // его уводит нативная группировка по атрибуту name
      details.open = true;
    }
  });
}

// Длительность закрытия, как её посчитал браузер
function closeMs(el) {
  const raw = getComputedStyle(el).transitionDuration.split(',')[0].trim();
  const value = parseFloat(raw) || 0;
  return raw.endsWith('ms') ? value : value * 1000;
}

export function initAccordion(root = document) {
  root.querySelectorAll('.qa').forEach(setup);
}
