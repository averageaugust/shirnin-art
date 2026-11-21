// Снимок сайта для превью при наведении.
// Запуск: node tools/preview-shot.mjs <адрес> <имя> [текст из подписи слайда]
// Пример: node tools/preview-shot.mjs https://vipclinic.vip vipclinic "Черная пятница"
// Третий аргумент нужен для сайтов со слайдером: скрипт найдёт слайд, у картинки которого
// в подписи (alt) есть этот текст, остановит слайдер и покажет этот слайд
// Результат: previews/<имя>.webp, 800×420 (пропорция 40:21, двойная плотность для карточки 400 px).
//
// Как работает: запускает отдельный Chrome без окна (свой временный профиль, ваш Chrome не трогает),
// открывает страницу в окне 1440×756, прячет всё, что висит поверх страницы ниже шапки
// (баннер cookie, кнопки мессенджеров, боковые вкладки), снимает экран и сжимает в webp через cwebp.

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [url, name, slideAlt] = process.argv.slice(2);
if (!url || !name) {
  console.error('Нужно: node tools/preview-shot.mjs <адрес> <имя>');
  process.exit(1);
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEW = { width: 1440, height: 756, dpr: 1.5 };
const OUT_W = 800, OUT_H = 420;
const PORT = 9300 + Math.floor(Math.random() * 400);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'previews');
const profile = mkdtempSync(join(tmpdir(), 'preview-shot-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`,
  `--window-size=${VIEW.width},${VIEW.height}`, 'about:blank',
], { stdio: 'ignore' });

async function waitForTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Chrome не запустился');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      events.push(msg.method);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  return new Promise((resolve) => { ws.onopen = () => resolve({ ws, send, events }); });
}

// Показывает нужный слайд в слайдере Owl Carousel (на нём сделан vipclinic.vip) и останавливает его.
// Прямой переход «к слайду N» в версии Owl на этом сайте падает, поэтому листаем вперёд,
// пока активным не станет слайд с нужной подписью
const SHOW_SLIDE = (alt) => `(async () => {
  const want = ${JSON.stringify(alt.toLowerCase())};
  const match = (el) => [...el.querySelectorAll('img')].some((i) => (i.alt || '').toLowerCase().includes(want));
  const target = [...document.querySelectorAll('.owl-item:not(.cloned)')].find(match);
  if (!target) return 'слайд с такой подписью не найден';
  const carousel = window.jQuery && window.jQuery(target.closest('.owl-carousel'));
  if (!carousel) return 'на странице нет jQuery, слайд не переключить';
  const total = target.parentElement.querySelectorAll('.owl-item:not(.cloned)').length;
  carousel.trigger('stop.owl.autoplay');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let step = 0; step <= total; step++) {
    const active = carousel[0].querySelector('.owl-item.active');
    if (active && match(active)) {
      carousel.trigger('stop.owl.autoplay');
      return 'показан нужный слайд, листал ' + step + ' раз';
    }
    carousel.trigger('next.owl.carousel');
    await wait(900);
  }
  return 'не удалось долистать до слайда';
})()`;

// Прячет то, что висит поверх страницы: fixed и sticky элементы ниже шапки (верх ниже 120 px),
// узкие вкладки у правого края и всплывающие окна выше половины экрана (квизы, попапы).
// Шапка сайта (fixed, сверху, невысокая) остаётся
const HIDE_OVERLAYS = `(() => {
  let hidden = 0;
  for (const el of document.querySelectorAll('[class*="marquiz"], iframe[src*="marquiz"]')) {
    el.style.setProperty('visibility', 'hidden', 'important');
    hidden++;
  }
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.top > 120 || (r.left > innerWidth * 0.85 && r.width < innerWidth * 0.2) || r.height > innerHeight * 0.5) {
      el.style.setProperty('visibility', 'hidden', 'important');
      hidden++;
    }
  }
  return hidden;
})()`;

try {
  const { ws, send, events } = await connect(await waitForTarget());
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.dpr, mobile: false,
  });
  await send('Page.navigate', { url });
  for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(150);
  await sleep(2500); // даём догрузиться шрифтам, картинкам и первому кадру слайдера

  if (slideAlt) {
    const slide = await send('Runtime.evaluate', { expression: SHOW_SLIDE(slideAlt), returnByValue: true, awaitPromise: true });
    console.log(`Слайдер: ${slide.result.value ?? slide.exceptionDetails?.exception?.description ?? 'нет ответа'}`);
    await sleep(1200);
  }

  // Прячем дважды: часть попапов появляется с задержкой
  const first = await send('Runtime.evaluate', { expression: HIDE_OVERLAYS, returnByValue: true });
  await sleep(1500);
  const second = await send('Runtime.evaluate', { expression: HIDE_OVERLAYS, returnByValue: true });
  const result = { value: first.result.value + second.result.value };
  await sleep(300);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(outDir, { recursive: true });
  const png = join(profile, 'shot.png');
  writeFileSync(png, Buffer.from(shot.data, 'base64'));
  const webp = join(outDir, `${name}.webp`);
  execFileSync('cwebp', ['-quiet', '-q', '82', '-resize', String(OUT_W), String(OUT_H), png, '-o', webp]);
  console.log(`Готово: previews/${name}.webp (${OUT_W}×${OUT_H}), спрятано поверх страницы: ${result.value}`);
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
