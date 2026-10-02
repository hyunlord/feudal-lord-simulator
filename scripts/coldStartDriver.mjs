// UX-0b cold start audit: a browser the auditor steers one step at a time over HTTP (DGX). The auditor sees only the
// screenshot a step returns, decides from what is on screen, and sends mouse, touch and key input.
// Page time is Playwright's clock. It stands still while the auditor thinks and runs only for the human time a step
// is given (`advance`), so a slow agent is not a slow player; the human clock is the sum of those advances.
// Every input is logged with the element under the pointer (the tablet replay finds the same control again) and the
// human clock. The log is not returned to the auditor.
//   node scripts/coldStartDriver.mjs <outDir> --url <game url> --port <driver port>
// POST a JSON array of ops; the answer is {human, results}. Ops:
//   {op:'new', w, h, touch, storage?}  fresh profile (or a saved storage state) · {op:'goto', query?}
//   {op:'advance', ms} · {op:'shot', name} → base64 JPEG · {op:'click', x, y, button?, n?} · {op:'move', x, y}
//   {op:'drag', x1, y1, x2, y2, steps?, button?} · {op:'wheel', x, y, dy} · {op:'key', k} · {op:'tap', x, y}
//   {op:'touchdrag', x1, y1, x2, y2, steps?} · {op:'save', name} storage state to <outDir>/storage · {op:'errors'}
//   {op:'note', text} · {op:'scene', state, w?, h?, touch?} a saved state from <states dir> (the chapter moments of
//   scripts/ui4ChapterStates.ts), opened as a returning player would: welcome dismissed, tutorial done · {op:'quit'}
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/coldStartDriver.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node scripts/coldStartDriver.mjs …", entry: import.meta.url });
import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { routeSceneState } from './sceneInjection.mjs';

const [outDir] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4300/';
const port = Number(flag('port') ?? 4350);
const statesDir = flag('states') ?? '.remote/states';
for (const dir of ['shots', 'storage']) mkdirSync(join(outDir, dir), { recursive: true });
const logFile = join(outDir, 'actions.jsonl');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const START = new Date('2026-09-27T09:00:00Z');
// The clock flows naturally while the page boots; stop it a little ahead of the page's own now (a slow machine may pass
// a short margin before the call lands, which Playwright refuses as a jump into the past).
const pauseClock = async target => {
  for (const margin of [250, 1000, 4000]) {
    try { await target.clock.pauseAt(await target.evaluate(ms => Date.now() + ms, margin)); return; } catch (error) { if (!String(error).includes('past')) throw error; }
  }
  throw new Error('could not pause the page clock');
};
const session = { context: null, page: null, human: 0, seq: 0, errors: [], viewport: null, touch: false };
const clockText = ms => `${String(Math.floor(ms / 60_000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const log = entry => appendFileSync(logFile, `${JSON.stringify({ human: session.human, clock: clockText(session.human), ...entry })}\n`);

// What is under the pointer, for the replay: the nearest control and its labels, or the canvas point relative to the
// canvas centre (the camera is centred, so the same world point sits at the same offset on another viewport).
const target = (x, y) => session.page.evaluate(([px, py]) => {
  const element = document.elementFromPoint(px, py);
  if (element === null) return null;
  const control = element.closest('button, a, summary, input, select, [role="button"], [role="tab"], [role="slider"], [data-intent], [tabindex]');
  const describe = node => node === null ? null : {
    tag: node.tagName.toLowerCase(), classes: [...node.classList].slice(0, 6), aria: node.getAttribute('aria-label'),
    title: node.getAttribute('title'), text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 48),
    data: Object.fromEntries([...node.attributes].filter(attribute => attribute.name.startsWith('data-')).slice(0, 6).map(attribute => [attribute.name, attribute.value.slice(0, 40)])),
    box: (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(node.getBoundingClientRect()),
  };
  const canvas = element.tagName === 'CANVAS' ? element.getBoundingClientRect() : null;
  return { element: describe(element), control: describe(control), canvas: canvas === null ? null : { dx: Math.round(px - canvas.x - canvas.width / 2), dy: Math.round(py - canvas.y - canvas.height / 2) } };
}, [x, y]).catch(error => ({ error: String(error).slice(0, 200) }));

// One CDP session per page for every touch: a touchMove must follow its touchStart on the same session.
const cdpSessions = new WeakMap();
const cdpTouch = async (type, points) => {
  if (!cdpSessions.has(session.page)) cdpSessions.set(session.page, await session.page.context().newCDPSession(session.page));
  await cdpSessions.get(session.page).send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y]) => ({ x, y })) });
};

async function run(op) {
  const page = session.page;
  switch (op.op) {
    case 'new': {
      if (session.context !== null) await session.context.close();
      const storage = op.storage === undefined ? undefined : join(outDir, 'storage', `${op.storage}.json`);
      session.viewport = { width: op.w ?? 1280, height: op.h ?? 800 };
      session.touch = op.touch === true;
      session.context = await browser.newContext({ viewport: session.viewport, deviceScaleFactor: 1, hasTouch: session.touch, locale: 'ko-KR',
        storageState: storage !== undefined && existsSync(storage) ? storage : undefined });
      await session.context.clock.install({ time: START });
      session.page = await session.context.newPage();
      await session.page.routeWebSocket('**', socket => socket.close());
      session.page.on('pageerror', error => session.errors.push(`[pageerror] ${String(error).slice(0, 300)}`));
      session.page.on('console', message => { if (message.type() === 'error') session.errors.push(`[console] ${message.text().slice(0, 300)}`); });
      session.human = op.human ?? 0;
      log({ op: 'new', viewport: session.viewport, touch: session.touch, storage: op.storage ?? null });
      return 'ok';
    }
    case 'scene': {
      // A save to continue from: the state goes in through the same module rewrite as scripts/renderCommitProbe.mjs
      // (no save slot holds a bot game), the tutorial is marked done and the welcome is dismissed like a returning player.
      if (session.context !== null) await session.context.close();
      session.viewport = { width: op.w ?? 1280, height: op.h ?? 800 };
      session.touch = op.touch === true;
      session.context = await browser.newContext({ viewport: session.viewport, deviceScaleFactor: 1, hasTouch: session.touch, locale: 'ko-KR' });
      await session.context.addInitScript(() => { try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; } });
      await session.context.clock.install({ time: START });
      session.page = await session.context.newPage();
      await session.page.routeWebSocket('**', socket => socket.close());
      session.page.on('pageerror', error => session.errors.push(`[pageerror] ${String(error).slice(0, 300)}`));
      session.page.on('console', message => { if (message.type() === 'error') session.errors.push(`[console] ${message.text().slice(0, 300)}`); });
      const source = readFileSync(join(statesDir, `${op.state}.json`), 'utf8');
      await routeSceneState(session.page, source);
      // NAT-4: the welcome opens on a random map number; pinned to map 1 its dismissal keeps the injected scene.
      await session.page.goto(`${url}${url.includes('?') ? '&' : '?'}new-game-seed=1`, { waitUntil: 'load' });
      await session.page.waitForSelector('canvas', { timeout: 90_000 });
      await session.page.waitForTimeout(4000);
      if (await session.page.locator('.welcome-dismiss-layer').count()) await session.page.locator('.welcome-dismiss-layer').click();
      await session.page.waitForTimeout(500);
      await pauseClock(session.page);
      session.human = op.human ?? 0;
      log({ op: 'scene', state: op.state, viewport: session.viewport, touch: session.touch });
      return 'ok';
    }
    case 'goto': {
      await page.goto(`${url}${op.query ?? ''}`, { waitUntil: 'load' });
      // The page boots on the natural clock (images, fonts); the audit clock stops once a canvas or the welcome shows.
      await page.waitForSelector('canvas, .welcome-parchment', { timeout: 90_000 });
      await page.waitForTimeout(op.settle ?? 4000);
      await pauseClock(page);
      log({ op: 'goto', query: op.query ?? '' });
      return 'ok';
    }
    case 'advance': {
      await page.clock.runFor(op.ms);
      session.human += op.ms;
      return `+${op.ms}`;
    }
    case 'shot': {
      session.seq += 1;
      const name = `${String(session.seq).padStart(3, '0')}-${op.name ?? 'shot'}.jpg`;
      const buffer = await page.screenshot({ type: 'jpeg', quality: op.quality ?? 72 });
      writeFileSync(join(outDir, 'shots', name), buffer);
      log({ op: 'shot', name });
      return { name, jpeg: buffer.toString('base64') };
    }
    case 'click': case 'move': case 'tap': {
      const at = await target(op.x, op.y);
      if (op.op === 'click') await page.mouse.click(op.x, op.y, { button: op.button ?? 'left', clickCount: op.n ?? 1 });
      else if (op.op === 'move') await page.mouse.move(op.x, op.y, { steps: op.steps ?? 4 });
      else await page.touchscreen.tap(op.x, op.y);
      log({ op: op.op, x: op.x, y: op.y, button: op.button ?? 'left', n: op.n ?? 1, at });
      return 'ok';
    }
    case 'drag': {
      const at = await target(op.x1, op.y1);
      const to = await target(op.x2, op.y2);
      await page.mouse.move(op.x1, op.y1);
      await page.mouse.down({ button: op.button ?? 'left' });
      const steps = op.steps ?? 12;
      for (let step = 1; step <= steps; step += 1) {
        await page.mouse.move(op.x1 + (op.x2 - op.x1) * step / steps, op.y1 + (op.y2 - op.y1) * step / steps);
        await page.clock.runFor(16);
      }
      await page.mouse.up({ button: op.button ?? 'left' });
      log({ op: 'drag', x1: op.x1, y1: op.y1, x2: op.x2, y2: op.y2, button: op.button ?? 'left', at, to });
      return 'ok';
    }
    case 'touchdrag': {
      const at = await target(op.x1, op.y1);
      const steps = op.steps ?? 12;
      await cdpTouch('touchStart', [[op.x1, op.y1]]);
      for (let step = 1; step <= steps; step += 1) {
        await cdpTouch('touchMove', [[op.x1 + (op.x2 - op.x1) * step / steps, op.y1 + (op.y2 - op.y1) * step / steps]]);
        await page.clock.runFor(16);
      }
      await cdpTouch('touchEnd', []);
      log({ op: 'touchdrag', x1: op.x1, y1: op.y1, x2: op.x2, y2: op.y2, at });
      return 'ok';
    }
    case 'wheel': {
      await page.mouse.move(op.x, op.y);
      await page.mouse.wheel(0, op.dy);
      log({ op: 'wheel', x: op.x, y: op.y, dy: op.dy, at: await target(op.x, op.y) });
      return 'ok';
    }
    case 'key': {
      await page.keyboard.press(op.k);
      log({ op: 'key', k: op.k });
      return 'ok';
    }
    case 'save': {
      const file = join(outDir, 'storage', `${op.name}.json`);
      await session.context.storageState({ path: file });
      log({ op: 'save', name: op.name });
      return file;
    }
    case 'errors': { const errors = session.errors.splice(0); return errors; }
    case 'note': { log({ op: 'note', text: op.text }); return 'ok'; }
    case 'quit': { log({ op: 'quit' }); setTimeout(async () => { await browser.close(); process.exit(0); }, 100); return 'bye'; }
    default: return `unknown op ${op.op}`;
  }
}

createServer((request, response) => {
  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', async () => {
    const results = [];
    try {
      for (const op of [].concat(JSON.parse(body))) {
        try { results.push(await run(op)); } catch (error) { results.push(`ERR ${String(error).slice(0, 400)}`); break; }
      }
    } catch (error) { results.push(`ERR bad request ${String(error).slice(0, 200)}`); }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ human: clockText(session.human), humanMs: session.human, results }));
  });
}).listen(port, '127.0.0.1', () => console.log(`driver on 127.0.0.1:${port} → ${url}`));
