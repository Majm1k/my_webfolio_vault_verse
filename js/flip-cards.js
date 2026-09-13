/**
 * Карточки блока «Факты». Переворот по оси Y на месте, в карусели.
 * Несколько карточек могут быть перевёрнуты одновременно.
 */

function setup(card) {
  const front = card.querySelector('.fact__face--front');
  const back = card.querySelector('.fact__face--back');
  const open = card.querySelector('[data-flip-open]');
  const close = card.querySelector('[data-flip-close]');
  if (!front || !back || !open || !close) return;

  function apply(flipped, moveFocus) {
    card.toggleAttribute('data-flipped', flipped);
    open.setAttribute('aria-expanded', String(flipped));
    // Скрытая грань не должна ловить фокус и клики
    front.inert = flipped;
    back.inert = !flipped;
    if (moveFocus) (flipped ? close : open).focus();
  }

  open.addEventListener('click', () => apply(true, true));
  close.addEventListener('click', () => apply(false, true));

  apply(false, false);
}

export function initFlipCards(root = document) {
  root.querySelectorAll('[data-flip]').forEach(setup);
}
