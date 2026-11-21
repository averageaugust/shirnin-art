// Печатает слова из data-words по очереди, стирает и начинает заново, бесконечно.
// Без JavaScript и при настройке «уменьшить движение» остаётся полная фраза из HTML.
// Экранный диктор всегда читает полную фразу: она лежит в скрытом тексте,
// а печатающаяся коробка спрятана от него через aria-hidden.

const TIMING = {
  start: 800,          // пауза перед первым словом
  typeMin: 70,       // задержка между буквами при печати: от typeMin
  typeSpread: 90,      // до typeMin + typeSpread, чтобы ритм был человеческим
  hold: 1800,          // слово напечатано и стоит
  holdLast: 3000,      // последнее слово стоит дольше
  holdAccent: 4000,    // выделенное слово (data-accent) стоит ещё дольше
  erase: 45,           // задержка между буквами при стирании
  gap: 500,            // пустая строка перед следующим словом
};

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setupTyper(el) {
  // Копия исходной разметки: в ней может быть <span lang="en">, чтобы диктор читал английское по-английски
  const original = [...el.childNodes].map((n) => n.cloneNode(true));
  const copyOriginal = () => original.map((n) => n.cloneNode(true));
  const words = el.dataset.words.split('|').map((w) => w.trim()).filter(Boolean);
  // Выделение (data-accent): начало слова, которое печатается полужирным. Слово с выделением стоит дольше.
  // Окончание после выделения, например «’ом» в «problem solver’ом», остаётся обычным
  const accents = (el.dataset.accent ?? '').split('|').map((w) => w.trim()).filter(Boolean);
  const accentOf = (word) => accents.find((a) => word.startsWith(a)) ?? null;

  // Печатает text в node: выделенная часть в <b class="typer__accent">, остальное обычным текстом
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
  let runId = 0; // каждый новый запуск получает номер; старый цикл видит чужой номер и выходит

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

    // Невидимые копии всех слов в одной ячейке: коробка берёт ширину самого широкого из них.
    // Считать по числу букв нельзя: латиница уже кириллицы
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
  // Настройку движения можно поменять, не закрывая страницу
  reduceMotion.addEventListener('change', apply);
}

document.querySelectorAll('.typer[data-words]').forEach(setupTyper);
