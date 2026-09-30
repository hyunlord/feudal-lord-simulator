// UX-0b method ⑤: the desktop cold start script replayed by touch on a 1180×820 tablet (DGX).
// The desktop run's input log (scripts/coldStartDriver.mjs) says, for every press, which control was under the pointer
// (goal card button, layer button, card button …) or where on the canvas relative to its centre. Here each press is a
// tap on the same control found again by its data attribute or label, or a tap at the same canvas offset; a placement
// tap is followed by the tablet confirm bar's ✓. Page time runs on Playwright's clock by the desktop run's own human
// clock, so the game is at the same moment when each tap lands. A hover has no touch form and is counted; Esc and
// Space become the on-screen cancel, close and pause controls when there is one, otherwise "keyboard only".
//   node scripts/coldStartTouchReplay.mjs <desktop actions.jsonl> <out-dir> --url <game> [--from-new 1]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/coldStartTouchReplay.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node scripts/coldStartTouchReplay.mjs …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [logPath, out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4300/';
const fromNew = Number(flag('from-new') ?? 0);
mkdirSync(out, { recursive: true });
const rows = readFileSync(logPath, 'utf8').trim().split('\n').map(line => JSON.parse(line));
const starts = rows.map((row, index) => row.op === 'new' ? index : -1).filter(index => index >= 0);
const script = rows.slice(starts[fromNew] ?? 0).filter((row, index) => index === 0 || row.op !== 'new');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, hasTouch: true, locale: 'ko-KR' });
await context.clock.install({ time: new Date('2026-09-27T09:00:00Z') });
const page = await context.newPage();
await page.routeWebSocket('**', socket => socket.close());
const errors = [];
// The clock flows naturally while the page boots; stop it a little ahead of the page's own now (a slow machine may pass
// a short margin before the call lands, which Playwright refuses as a jump into the past).
const pauseClock = async target => {
  for (const margin of [250, 1000, 4000]) {
    try { await target.clock.pauseAt(await target.evaluate(ms => Date.now() + ms, margin)); return; } catch (error) { if (!String(error).includes('past')) throw error; }
  }
  throw new Error('could not pause the page clock');
};
page.on('pageerror', error => errors.push(String(error).slice(0, 300)));
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('canvas, .welcome-parchment', { timeout: 90_000 });
await page.waitForTimeout(4000);
await pauseClock(page);

const visible = async selector => {
  const locator = page.locator(selector).first();
  return (await locator.count()) > 0 && await locator.isVisible() ? locator : null;
};
const tapLocator = async locator => {
  const box = await locator.boundingBox();
  if (box === null) return false;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), w: Math.round(box.width), h: Math.round(box.height) };
};
const canvasCentre = () => page.evaluate(() => { const box = document.querySelector('canvas.game-canvas').getBoundingClientRect(); return [box.x + box.width / 2, box.y + box.height / 2]; });
// One CDP session for every touch: a touchMove must follow its touchStart on the same session.
const cdp = await context.newCDPSession(page);
const cdpTouch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y]) => ({ x, y })) });
// The control under the desktop pointer, as a selector on this page: data attributes first, then the label.
const selectorFor = control => {
  const data = control?.data ?? {};
  for (const key of ['data-tutorial-cta', 'data-scenario', 'data-layer', 'data-confirm', 'data-tab', 'data-category', 'data-building', 'data-intent', 'data-drawer']) {
    if (data[key] !== undefined) return `[${key}="${data[key]}"]`;
  }
  if (control?.aria) return `[aria-label="${control.aria}"]`;
  const named = (control?.classes ?? []).find(name => /resume|close|dock|crisis|cta|tab|card|speed/.test(name));
  return named === undefined ? null : `.${named}`;
};
const goalStep = () => page.evaluate(() => document.querySelector('[data-tutorial-cta]')?.getAttribute('data-tutorial-cta') ?? null);
// A desktop click on the map during a placing step went to the marked spot the player saw; the tablet's camera frames
// the world a little differently, so the tap goes to the same mark (the tutorial's target, read from its module on the
// dev server) rather than to the same offset. Outside those steps the offset from the canvas centre is used.
const PLACING_STEPS = new Set(['well', 'road', 'house', 'food_chain', 'granary', 'sawmill']);
const markerPoint = () => page.evaluate(() => import('/src/ui/tutorial/tutorialMapChannel.ts')
  .then(module => { const point = module.tutorialTargetCanvasPoint(); if (point === null) return null;
    const box = document.querySelector('canvas.game-canvas').getBoundingClientRect(); return [box.x + point.x, box.y + point.y]; })
  .catch(() => null));

const results = [];
let human = script[0]?.human ?? 0;
let shots = 0;
let lastStep = await goalStep();
for (const row of script) {
  if (row.human > human) { await page.clock.runFor(row.human - human); human = row.human; }
  const at = row.at ?? {};
  const entry = { clock: row.clock, op: row.op };
  if (row.op === 'click' || row.op === 'tap') {
    if (at.canvas !== null && at.canvas !== undefined) {
      const [cx, cy] = await canvasCentre();
      const marker = PLACING_STEPS.has(await goalStep() ?? '') ? await markerPoint() : null;
      const [tx, ty] = marker ?? [cx + at.canvas.dx, cy + at.canvas.dy];
      entry.onMarker = marker !== null;
      await page.touchscreen.tap(tx, ty);
      await page.clock.runFor(120);
      const confirm = await visible('.placement-confirm-bar [data-confirm="ok"]');
      entry.result = confirm === null ? 'canvas tap' : 'canvas tap + ✓';
      if (confirm !== null) entry.confirm = await tapLocator(confirm);
    } else if ((at.element?.classes ?? []).some(name => name.endsWith('backdrop'))) {
      entry.result = 'desktop press landed on a modal backdrop (skipped)';
    } else {
      const selector = selectorFor(at.control ?? at.element);
      let locator = selector === null ? null : await visible(selector);
      if (locator === null && at.control?.text) locator = await visible(`button:has-text("${at.control.text.replace(/"/g, '\\"')}")`);
      if (locator === null) entry.result = `not found (${selector ?? at.control?.text ?? 'no label'})`;
      else { entry.target = await tapLocator(locator); entry.result = 'tap'; entry.selector = selector; }
    }
  } else if (row.op === 'move') {
    entry.result = 'hover — no touch form';
  } else if (row.op === 'drag') {
    const [cx, cy] = await canvasCentre();
    const from = at.canvas ?? { dx: row.x1 - 640, dy: row.y1 - 400 };
    const to = row.to?.canvas ?? { dx: row.x2 - 640, dy: row.y2 - 400 };
    await cdpTouch('touchStart', [[cx + from.dx, cy + from.dy]]);
    for (let step = 1; step <= 12; step += 1) {
      await cdpTouch('touchMove', [[cx + from.dx + (to.dx - from.dx) * step / 12, cy + from.dy + (to.dy - from.dy) * step / 12]]);
      await page.clock.runFor(16);
    }
    await cdpTouch('touchEnd', []);
    entry.result = 'touch drag';
  } else if (row.op === 'key') {
    const onScreen = row.k === 'Escape'
      ? await visible('.placement-confirm-bar [data-confirm="cancel"]') ?? await visible('[aria-label="닫기"]')
      : row.k === 'Space' ? await visible('[aria-label="일시정지"]') : null;
    if (onScreen === null) entry.result = `keyboard only (${row.k})`;
    else { entry.target = await tapLocator(onScreen); entry.result = `${row.k} → on-screen control`; }
  } else if (row.op === 'wheel') {
    entry.result = 'wheel — pinch not replayed';
  } else continue;
  await page.clock.runFor(200);
  human += 200;
  const step = await goalStep();
  if (step !== lastStep) {
    shots += 1;
    await page.screenshot({ path: join(out, `${String(shots).padStart(2, '0')}-${step ?? 'none'}.jpg`), type: 'jpeg', quality: 70 });
    entry.goalStep = step;
    lastStep = step;
  }
  results.push(entry);
}
await page.screenshot({ path: join(out, 'end.jpg'), type: 'jpeg', quality: 70 });
const count = pattern => results.filter(entry => pattern.test(entry.result ?? '')).length;
const summary = {
  presses: results.filter(entry => entry.op === 'click' || entry.op === 'tap').length,
  tapped: count(/^tap$/), canvasTaps: count(/^canvas tap/), confirmed: count(/✓/), notFound: count(/^not found/),
  hoverOnly: count(/^hover/), keyboardOnly: count(/^keyboard only/), keysOnScreen: count(/on-screen control/),
  goalSteps: results.filter(entry => entry.goalStep !== undefined).map(entry => entry.goalStep), finalGoalStep: lastStep, errors,
};
writeFileSync(join(out, 'touch-replay.json'), `${JSON.stringify({ summary, results }, null, 1)}\n`);
console.log(JSON.stringify(summary, null, 1));
await browser.close();
