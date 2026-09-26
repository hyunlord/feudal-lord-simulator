// Touch target / text size audit (B9, design master 13.1 rule 5): every visible interactive element must be at least
// 44x44 CSS px and every visible text at least 12px (Steam Deck recommendation). Opens the game at 1280x800 in a
// few UI states and measures the DOM (canvas-drawn text is covered by tests/touchTargets.test.ts).
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/touchTargetAudit.mjs <out.json> [--url http://127.0.0.1:4241/]
// States (UX-3): welcome screen, HUD, build drawer, zone chip armed, ledger drawer and its tabs, population drawer,
// goal log (+ settlement disclosure), settings, pause menu, and the diagnostic card (a house selected).
import { writeFile } from 'node:fs/promises';
import { loadChromium, sceneStates } from './renderCommitProbe.mjs';

const [target] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4241/';
const WIDTH = 1280, HEIGHT = 800;
const MIN_TARGET = 44, MIN_TEXT = 12;

/** Measures the page as it is now. Runs in the browser. */
function measure({ minTarget, minText }) {
  const visible = element => {
    if (!(element instanceof Element)) return false;
    if (typeof element.checkVisibility === 'function' && !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return false; // visually-hidden helpers
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth || rect.top >= innerHeight) return false;
    if (element.closest('[inert]')) return false;
    return true;
  };
  const describe = element => {
    const classes = typeof element.className === 'string' ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const text = (element.getAttribute('aria-label') ?? element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
    return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}${text ? ` "${text}"` : ''}`;
  };
  const interactive = [...document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"]')]
    .filter(visible);
  const targets = interactive.map(element => {
    const rect = element.getBoundingClientRect();
    return { element: describe(element), width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10 };
  });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const texts = new Map();
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.textContent.trim() === '') continue;
    const parent = node.parentElement;
    if (parent === null || !visible(parent)) continue;
    const size = parseFloat(getComputedStyle(parent).fontSize);
    const key = describe(parent);
    if (!texts.has(key)) texts.set(key, { element: key, fontSize: size });
  }
  return {
    targets: targets.length, texts: texts.size,
    smallTargets: targets.filter(item => item.width < minTarget || item.height < minTarget),
    smallText: [...texts.values()].filter(item => item.fontSize < minText),
  };
}

// The tutorial off (UX-1: a fresh profile starts it and locks the zone layer), so every state below is reachable.
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;

async function open(browser, state, dismiss) {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await context.addInitScript(TUTORIAL_OFF);
  const page = await context.newPage();
  await page.routeWebSocket('**', socket => socket.close());
  if (state !== null) {
    const source = JSON.stringify(state);
    await page.route('**/src/state/gameStore.ts*', async route => {
      const response = await route.fetch(); const text = await response.text(); const anchor = 'useState(DEFAULT_GAME_STATE)';
      if (!text.includes(anchor)) throw new Error('State injection anchor changed');
      await route.fulfill({ response, body: text.replace(anchor, `useState(${source})`) });
    });
  }
  await page.goto(`${url}?phase10-proof=1`);
  await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  if (dismiss) {
    if (await page.locator('.welcome-dismiss-layer').count()) await page.locator('.welcome-dismiss-layer').click({ position: { x: 20, y: 20 } });
    await page.keyboard.press('Escape');
    // UX-3 S-31: Esc on the normal screen opens the pause menu; the audit starts without it.
    if (await page.locator('.pause-menu').count()) await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  return { context, page };
}

const clickIfPresent = async (page, selector) => {
  const locator = page.locator(selector).first();
  if (await locator.count() === 0) return false;
  await locator.click(); await page.waitForTimeout(300);
  return true;
};

async function main() {
  const states = await sceneStates();
  const city = states.lots24;
  const house = city.buildings.find(building => building.kind === 'house');
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  const record = async (name, page, note = '') => { rows.push({ state: name, note, ...(await page.evaluate(measure, { minTarget: MIN_TARGET, minText: MIN_TEXT })) }); };

  { const { context, page } = await open(browser, null, false); await record('welcome', page); await context.close(); }

  const { context, page } = await open(browser, city, true);
  await record('hud', page);
  // UX-3: the build drawer from the dock, its first category; the zone layer with a zone chip armed.
  await clickIfPresent(page, "[data-dock='build']"); await clickIfPresent(page, '.build-menu-category[data-category]'); await record('build-menu', page, 'build drawer, first category open');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await clickIfPresent(page, ".control-layer[data-layer='zone']"); await clickIfPresent(page, '.zone-tool'); await record('zone-brush', page, 'zone chip armed');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await clickIfPresent(page, ".control-layer[data-layer='direct']");
  // The ledger drawer (dock) and each of its tabs; the population drawer and the goal log from the pill / the goal chip.
  await clickIfPresent(page, "[data-dock='ledger']"); await record('ledger', page, 'ledger drawer, resources tab');
  for (const tab of ['알림', '보기', '지도']) {
    const button = page.locator('.ledger-tab', { hasText: tab });
    if (await button.count()) { await button.click(); await page.waitForTimeout(300); await record(`ledger-${tab}`, page); }
  }
  await clickIfPresent(page, "[data-dock='ledger']");
  await clickIfPresent(page, '.status-pill-cell[aria-label="인구 기록 열기"]'); await record('population', page, 'population drawer open');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await clickIfPresent(page, '.goal-drawer-toggle'); await record('goal-log', page, 'goal log in the panel slot');
  if (await clickIfPresent(page, '.slot-panel details > summary')) await record('settlement', page);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  if (await clickIfPresent(page, '.settings-disclosure > summary')) { await record('settings', page); await clickIfPresent(page, '.settings-disclosure > summary'); }
  // The pause menu (Esc on the normal screen) and the steward dock bubble.
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); await record('pause-menu', page);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await context.close();

  if (house !== undefined) {
    // Centre the camera on a house and click it (the same camera injection as renderCommitProbe openScene).
    const tile = [house.tx, house.ty];
    const camera = { zoom: 1, panX: WIDTH / 2 - (tile[0] - tile[1]) * 32, panY: HEIGHT / 2 - (tile[0] + tile[1]) * 16 };
    const card = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await card.addInitScript(TUTORIAL_OFF);
    const cardPage = await card.newPage();
    await cardPage.routeWebSocket('**', socket => socket.close());
    const source = JSON.stringify(city);
    await cardPage.route('**/src/state/gameStore.ts*', async route => {
      const response = await route.fetch(); const text = await response.text();
      await route.fulfill({ response, body: text.replace('useState(DEFAULT_GAME_STATE)', `useState(${source})`) });
    });
    await cardPage.route('**/src/render/canvasRuntime.ts*', async route => {
      const response = await route.fetch(); const text = await response.text(); const anchor = 'const house = startingHouse(state.buildings);';
      await route.fulfill({ response, body: text.replace(anchor, `return ${JSON.stringify(camera)};` + anchor) });
    });
    await cardPage.goto(`${url}?phase10-proof=1`);
    await cardPage.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
    await cardPage.waitForTimeout(800);
    if (await cardPage.locator('.welcome-dismiss-layer').count()) await cardPage.locator('.welcome-dismiss-layer').click({ position: { x: 20, y: 20 } });
    await cardPage.keyboard.press('Escape'); await cardPage.waitForTimeout(600);
    if (await cardPage.locator('.pause-menu').count()) { await cardPage.keyboard.press('Escape'); await cardPage.waitForTimeout(300); }
    let opened = false;
    for (const [dx, dy] of [[0, 0], [0, -12], [0, -24], [8, -8], [-8, -8], [0, 8]]) {
      await cardPage.mouse.click(WIDTH / 2 + dx, HEIGHT / 2 + dy); await cardPage.waitForTimeout(400);
      if (await cardPage.locator('.diagnostic-card').count()) { opened = true; break; }
    }
    await record('diagnostic-card', cardPage, opened ? `house ${house.id} selected` : 'card did not open');
    await card.close();
  }
  await browser.close();
  const summary = {
    smallTargets: rows.reduce((total, row) => total + row.smallTargets.length, 0),
    smallText: rows.reduce((total, row) => total + row.smallText.length, 0),
    uniqueSmallTargets: new Set(rows.flatMap(row => row.smallTargets.map(item => item.element))).size,
    uniqueSmallText: new Set(rows.flatMap(row => row.smallText.map(item => item.element))).size,
  };
  await writeFile(target, `${JSON.stringify({ url, viewport: `${WIDTH}x${HEIGHT}`, minTarget: MIN_TARGET, minText: MIN_TEXT, summary, rows }, null, 2)}\n`);
  console.log(JSON.stringify({ summary, perState: rows.map(row => ({ state: row.state, note: row.note, targets: row.targets, small: row.smallTargets.length, text: row.smallText.length })) }));
}

await main();
