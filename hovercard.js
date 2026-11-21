// Карточка-превью при наведении на ссылку или слово с атрибутом interestfor.
// Chrome и Edge открывают её сами. В остальных браузерах этот файл повторяет то же поведение:
// наведение мышью или фокус с клавиатуры, открытие через 0,7 с, закрытие через 0,1 с, Escape закрывает.
// Если браузер не умеет привязывать карточку к ссылке средствами CSS, координаты считает скрипт.
// Своё описание для экранного диктора ссылка получает во всех браузерах.

const OPEN_DELAY = 700;   // как interest-delay в index.html
const CLOSE_DELAY = 100;
const GAP = 8;

const hasPopover = Object.hasOwn(HTMLElement.prototype, 'popover');
const nativeInterest = 'interestForElement' in HTMLButtonElement.prototype;
const nativeAnchor = CSS.supports('position-area: block-end');

const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const isOpen = (el) => el.matches(':popover-open');

// Кнопки, которые сами открывают карточку по нажатию (popovertarget), и чьё aria-expanded ведёт этот файл
const ownedExpanded = new Set();
const opensOnClick = (trigger, hint) => trigger.getAttribute('popovertarget') === hint.id;

// Диктор. Ссылка: карточка становится её описанием (role="tooltip" + aria-describedby),
// aria-expanded не ставим, потому что Enter по ссылке переходит на сайт.
// Кнопка, которая открывает карточку по нажатию: role="tooltip" + aria-expanded, синхронно с карточкой
function wireAria(trigger, hint) {
  const name = trigger.getAttribute('aria-label') || trigger.textContent;
  if (norm(hint.textContent) === norm(name)) return;
  if (!hint.hasAttribute('role')) hint.setAttribute('role', 'tooltip');
  if (opensOnClick(trigger, hint)) {
    if (!trigger.hasAttribute('aria-expanded')) {
      trigger.setAttribute('aria-expanded', String(hasPopover && isOpen(hint)));
      ownedExpanded.add(trigger);
    }
  } else if (!trigger.hasAttribute('aria-describedby')) {
    trigger.setAttribute('aria-describedby', hint.id);
  }
}

// toggle не всплывает, поэтому слушаем на фазе перехвата
document.addEventListener('toggle', (e) => {
  for (const trigger of ownedExpanded) {
    if (trigger.getAttribute('interestfor') === e.target.id) {
      trigger.setAttribute('aria-expanded', String(e.newState === 'open'));
    }
  }
}, true);

// Запасная привязка: под первой строкой ссылки, а если внизу не помещается — над ней
function place(trigger, hint) {
  if (nativeAnchor || !isOpen(hint)) return;
  const r = trigger.getClientRects()[0] ?? trigger.getBoundingClientRect();
  const w = hint.offsetWidth;
  const h = hint.offsetHeight;
  let top = r.bottom + GAP;
  if (top + h > innerHeight - GAP && r.top - GAP - h > GAP) top = r.top - GAP - h;
  const left = Math.max(GAP, Math.min(r.left, innerWidth - GAP - w));
  Object.assign(hint.style, { inset: 'auto', margin: '0', top: `${top}px`, left: `${left}px` });
}

function setup(trigger) {
  const hint = document.getElementById(trigger.getAttribute('interestfor'));
  if (!hint || hint.getAttribute('popover') !== 'hint') return;

  wireAria(trigger, hint);
  if (!hasPopover) return;

  hint.addEventListener('toggle', () => place(trigger, hint));
  if (!nativeAnchor) {
    addEventListener('scroll', () => place(trigger, hint), { passive: true });
    addEventListener('resize', () => place(trigger, hint));
  }

  if (nativeInterest) return;

  let openTimer;
  let closeTimer;
  const show = () => {
    clearTimeout(closeTimer);
    clearTimeout(openTimer);
    openTimer = setTimeout(() => { if (!isOpen(hint)) hint.showPopover(); }, OPEN_DELAY);
  };
  const hide = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { if (isOpen(hint)) hint.hidePopover(); }, CLOSE_DELAY);
  };

  trigger.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(); });
  trigger.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  // Мышь перешла на саму карточку или фокус ушёл в ссылку внутри неё — карточка остаётся (WCAG 1.4.13)
  hint.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  hint.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  hint.addEventListener('focusin', () => clearTimeout(closeTimer));
  hint.addEventListener('focusout', (e) => { if (!hint.contains(e.relatedTarget) && e.relatedTarget !== trigger) hide(); });
  trigger.addEventListener('focus', () => { if (trigger.matches(':focus-visible')) show(); });
  trigger.addEventListener('blur', hide);
  // По ссылке нажатие уводит на сайт, карточку закрываем. Кнопка с popovertarget по нажатию сама её показывает
  if (!opensOnClick(trigger, hint)) {
    trigger.addEventListener('click', () => { clearTimeout(openTimer); if (isOpen(hint)) hint.hidePopover(); });
  } else {
    trigger.addEventListener('click', () => clearTimeout(closeTimer));
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen(hint)) hint.hidePopover();
  });
}

document.querySelectorAll('[interestfor]').forEach(setup);
