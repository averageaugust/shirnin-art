// Переключатель темы — точка справа вверху.
// По умолчанию тема как в системе: meta color-scheme = "light dark", CSS сам выбирает цвета.
// Нажатие включает тему, противоположную той, что видна сейчас. Если она совпадает с системной,
// сохранённый выбор удаляется и сайт снова следует системе; иначе выбор запоминается в localStorage.
// Без JavaScript точка не показывается, а тема просто следует системе.

const KEY = 'color-scheme';
const meta = document.querySelector('meta[name="color-scheme"]');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const button = document.querySelector('.theme-toggle');

function save(value) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // Хранилище закрыто (приватный режим, запрет cookie): тема сменится, но не запомнится
  }
}

const rendered = () =>
  meta.content === 'dark' || meta.content === 'light' ? meta.content : systemDark.matches ? 'dark' : 'light';

// Пока тема меняется, переходы выключены, иначе все цвета поплывут разом
function apply(value) {
  const freeze = document.createElement('style');
  freeze.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.append(freeze);
  meta.content = value;
  getComputedStyle(document.body).color; // заставляет браузер применить новые цвета сразу
  requestAnimationFrame(() => requestAnimationFrame(() => freeze.remove()));
}

if (meta && button) {
  button.hidden = false;

  button.addEventListener('click', () => {
    const target = rendered() === 'dark' ? 'light' : 'dark';
    const system = systemDark.matches ? 'dark' : 'light';
    const stored = target === system ? null : target;
    save(stored);
    apply(stored ?? 'light dark');
  });

  // Тему переключили в соседней вкладке
  addEventListener('storage', (e) => {
    if (e.key === KEY) apply(e.newValue ?? 'light dark');
  });
}
