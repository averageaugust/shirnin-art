const KEY = 'color-scheme';
const meta = document.querySelector('meta[name="color-scheme"]');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const button = document.querySelector('.theme-toggle');

function save(value) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {}
}

const rendered = () =>
  meta.content === 'dark' || meta.content === 'light' ? meta.content : systemDark.matches ? 'dark' : 'light';

function apply(value) {
  const freeze = document.createElement('style');
  freeze.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.append(freeze);
  meta.content = value;
  getComputedStyle(document.body).color;
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

  addEventListener('storage', (e) => {
    if (e.key === KEY) apply(e.newValue ?? 'light dark');
  });
}
