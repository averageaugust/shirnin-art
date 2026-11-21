const TIMING = {
  start: 800,
  typeMin: 70,
  typeSpread: 90,
  hold: 1800,
  holdLast: 3000,
  holdAccent: 4000,
  erase: 45,
  gap: 500,
};

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setupTyper(el) {
  const original = [...el.childNodes].map((n) => n.cloneNode(true));
  const copyOriginal = () => original.map((n) => n.cloneNode(true));
  const words = el.dataset.words.split('|').map((w) => w.trim()).filter(Boolean);
  const accents = (el.dataset.accent ?? '').split('|').map((w) => w.trim()).filter(Boolean);
  const accentOf = (word) => accents.find((a) => word.startsWith(a)) ?? null;

  function render(node, text, accent) {
    if (!accent || !text) {
      node.textContent = text;
      return;
    }
    const bold = document.createElement('b');
    bold.className = 'typer__accent';
    bold.textContent = text.slice(0, accent.length);
    const rest = text.slice(accent.length);
    node.replaceChildren(bold, ...(rest ? [rest] : []));
  }
  let runId = 0;

  function showStatic() {
    el.classList.remove('is-typing');
    el.replaceChildren(...copyOriginal());
  }

  function buildAnimated() {
    const forReaders = document.createElement('span');
    forReaders.className = 'visually-hidden';
    forReaders.append(...copyOriginal());

    const box = document.createElement('span');
    box.className = 'typer__box';
    box.setAttribute('aria-hidden', 'true');

    const ghosts = words.map((word) => {
      const ghost = document.createElement('span');
      ghost.className = 'typer__ghost';
      render(ghost, word, accentOf(word));
      return ghost;
    });

    const line = document.createElement('span');
    line.className = 'typer__line';
    const live = document.createElement('span');
    live.className = 'typer__live';
    const caret = document.createElement('span');
    caret.className = 'typer__caret';
    line.append(live, caret);

    box.append(...ghosts, line);
    el.replaceChildren(forReaders, box);
    return live;
  }

  async function loop(id, live) {
    await sleep(TIMING.start);

    for (let i = 0; ; i = (i + 1) % words.length) {
      const chars = Array.from(words[i]);
      const isLast = i === words.length - 1;
      const accent = accentOf(words[i]);
      const isAccent = accent !== null;

      el.classList.add('is-typing');
      for (let n = 1; n <= chars.length; n++) {
        if (id !== runId) return;
        render(live, chars.slice(0, n).join(''), accent);
        await sleep(TIMING.typeMin + Math.random() * TIMING.typeSpread);
      }
      el.classList.remove('is-typing');

      await sleep(isAccent ? TIMING.holdAccent : isLast ? TIMING.holdLast : TIMING.hold);
      if (id !== runId) return;

      el.classList.add('is-typing');
      for (let n = chars.length - 1; n >= 0; n--) {
        if (id !== runId) return;
        render(live, chars.slice(0, n).join(''), accent);
        await sleep(TIMING.erase);
      }
      el.classList.remove('is-typing');

      await sleep(TIMING.gap);
    }
  }

  function apply() {
    runId += 1;
    if (reduceMotion.matches || words.length === 0) {
      showStatic();
      return;
    }
    loop(runId, buildAnimated());
  }

  apply();
  reduceMotion.addEventListener('change', apply);
}

document.querySelectorAll('.typer[data-words]').forEach(setupTyper);
