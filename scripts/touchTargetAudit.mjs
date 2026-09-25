// Touch target / text size audit (B9, design master 13.1 rule 5): every visible interactive element must be at least
// 44x44 CSS px and every visible text at least 12px (Steam Deck recommendation). Opens the game at 1280x800 in a
// few UI states and measures the DOM (canvas-drawn text is covered by tests/touchTargets.test.ts).
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/touchTargetAudit.mjs <out.json> [--url http://127.0.0.1:4241/]
// States: welcome screen, HUD, build menu open (houses), zone brush armed, diagnostic card (a house selected), ledger
// panel, and the disclosures (map, view, settings, resource detail, settlement, population drawer).
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

async function open(browser, state, dismiss) {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
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
  await clickIfPresent(page, '.build-menu-category'); await record('build-menu', page, 'first category open');
  const zoneCategory = page.locator('.build-menu-category', { hasText: '구역' });
  if (await zoneCategory.count()) { await zoneCategory.click(); await page.waitForTimeout(300); await clickIfPresent(page, '.zone-tool'); }
  await record('zone-brush', page, 'zone card armed');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await clickIfPresent(page, '.resource-bar__coin'); await record('ledger', page, 'finance cell open');
  await clickIfPresent(page, '.resource-bar__coin');
  await clickIfPresent(page, '.resource-bar__population'); await record('population', page, 'population drawer open');
  await clickIfPresent(page, '.resource-bar__population');
  for (const [name, selector] of [['resource-detail', '.resource-bar__more > summary'], ['settlement', '.right-info-rail details > summary'],
    ['map', '.map-recess summary'], ['view', '.ledger-stack > summary'], ['settings', '.settings-disclosure > summary']]) {
    if (await clickIfPresent(page, selector)) { await record(name, page); await clickIfPresent(page, selector); }
  }
  await context.close();

  if (house !== undefined) {
    // Centre the camera on a house and click it (the same camera injection as renderCommitProbe openScene).
    const tile = [house.tx, house.ty];
    const camera = { zoom: 1, panX: WIDTH / 2 - (tile[0] - tile[1]) * 32, panY: HEIGHT / 2 - (tile[0] + tile[1]) * 16 };
    const card = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
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
