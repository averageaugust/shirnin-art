const OPEN_DELAY = 700;
const CLOSE_DELAY = 100;
const GAP = 8;

const hasPopover = Object.hasOwn(HTMLElement.prototype, 'popover');
const nativeInterest = 'interestForElement' in HTMLButtonElement.prototype;
const nativeAnchor = CSS.supports('position-area: block-end');

const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const isOpen = (el) => el.matches(':popover-open');

const ownedExpanded = new Set();
const opensOnClick = (trigger, hint) => trigger.getAttribute('popovertarget') === hint.id;

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

document.addEventListener('toggle', (e) => {
  for (const trigger of ownedExpanded) {
    if (trigger.getAttribute('interestfor') === e.target.id) {
      trigger.setAttribute('aria-expanded', String(e.newState === 'open'));
    }
  }
}, true);

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
  hint.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  hint.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  hint.addEventListener('focusin', () => clearTimeout(closeTimer));
  hint.addEventListener('focusout', (e) => { if (!hint.contains(e.relatedTarget) && e.relatedTarget !== trigger) hide(); });
  trigger.addEventListener('focus', () => { if (trigger.matches(':focus-visible')) show(); });
  trigger.addEventListener('blur', hide);
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
