// UX-1 gate 1: cold-start replay. A fresh browser profile opens the game, starts the campaign from the welcome with the
// tutorial on, then presses ONLY the goal card buttons (`[data-tutorial-cta]`) until the 13-step first-session script
// is done. One capture per step (the card it shows), the step order, the press count and the game state at the end.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/tutorialReplay.mjs <outDir> [--url ...] [--width 1280 --height 800] [--audit 1]
// UX-2 gate 1 (`--audit 1`): at every step, and with each build category open at the end, a DOM audit of development-UI
// remnants: emoji / symbol glyphs standing in for icons, visible buttons without the P0 frame (default browser look),
// near-black flat bars, and line-drawn SVG icons.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4213/';
const width = Number(flags.width ?? 1280); const height = Number(flags.height ?? 800);
const STEPS = ['greet', 'well', 'well_done', 'road', 'house', 'arable', 'arable_limits', 'food_chain', 'granary', 'zone_unlock', 'burgage', 'burgage_done', 'wrap_up'];

// Gate 2: what the script (work order section 2, research E) opens at each step, written out independently of the model.
const OPEN_BY_STEP = (step) => {
  const at = STEPS.indexOf(step);
  const reached = id => at >= STEPS.indexOf(id);
  return {
    categories: { living: true, paths: true, trade: reached('arable'), storage: reached('granary'), public: false, defense: false },
    layers: { direct: true, zone: reached('zone_unlock'), direction: false },
  };
};
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.routeWebSocket('**', socket => socket.close());
await page.goto(`${url}?phase10-proof=1`);
await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
const startedAt = Date.now();
// New game from the welcome: the tutorial toggle is on by default; the campaign mode button starts it.
const AUDIT = flags.audit === '1';
const audit = () => page.evaluate(() => {
  // Glyphs standing in for icons: these symbols anywhere, or a lone ×, ⌄, i or the steward monogram 청 as a whole label
  // (a × inside a sentence is the arithmetic sign of the road cost line, not an icon).
  const GLYPHS = /[🔒▲◆✓✗⌂⌫⌁≡△]/u;
  const LONE = /^(?:×|⌄|i|청)$/u;
  const shown = element => {
    for (let node = element; node !== null && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.05) return false;
    }
    const box = element.getBoundingClientRect();
    return box.width > 1 && box.height > 1 && box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
  };
  const name = element => `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`;
  const roots = [...document.querySelectorAll('.app-interaction-layer, .welcome-parchment')];
  const glyphs = [];
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent !== null && !parent.closest('.visually-hidden') && (GLYPHS.test(node.textContent ?? '') || LONE.test((node.textContent ?? '').trim())) && shown(parent)) glyphs.push(`${name(parent)}: ${node.textContent.trim().slice(0, 40)}`);
    }
  }
  const controls = roots.flatMap(root => [...root.querySelectorAll('button, summary')])
    // A control with no P0 frame that still paints its own field (a flat or browser-default button); a transparent
    // control inside a framed strip (the resource cells, the minimap) wears the strip's frame.
    .filter(element => {
      if (element.closest('.visually-hidden') || !shown(element)) return false;
      const style = getComputedStyle(element);
      const field = style.backgroundColor.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/);
      return style.borderImageSource === 'none' && field !== null && Number(field[4] ?? 1) > 0.05;
    }).map(name);
  const dark = roots.flatMap(root => [...root.querySelectorAll('*')]).filter(element => {
    if (element.tagName === 'CANVAS' || !shown(element)) return false;
    const match = getComputedStyle(element).backgroundColor.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/);
    if (match === null || Number(match[4] ?? 1) < 0.6) return false;
    const luminance = (0.2126 * match[1] + 0.7152 * match[2] + 0.0722 * match[3]) / 255;
    const box = element.getBoundingClientRect();
    return luminance < 0.2 && box.width * box.height > 1200;
  }).map(name);
  // Line-drawn icons: small SVGs (the minimap is a map drawing, larger than any icon).
  const svgs = roots.flatMap(root => [...root.querySelectorAll('svg')]).filter(element => {
    const box = element.getBoundingClientRect();
    return shown(element) && box.width <= 48 && box.height <= 48;
  }).map(element => name(element.parentElement ?? element));
  return { glyphs, controls: [...new Set(controls)], dark: [...new Set(dark)], svgs: [...new Set(svgs)] };
});
const welcomeAudit = flags.audit === '1' ? await audit() : null;
if (flags.audit === '1') await writeFile(join(outDir, '00-welcome.jpg'), await page.screenshot({ type: 'jpeg', quality: 62 }));
await page.locator('.welcome-parchment [data-scenario]').first().click();
await page.waitForTimeout(1_200);
const stepOf = () => page.evaluate(() => document.querySelector('[data-tutorial-cta]')?.getAttribute('data-tutorial-cta') ?? null);
const rows = []; const seen = new Set(); let presses = 0; let last = null;
for (let guard = 0; guard < 80; guard += 1) {
  const step = await stepOf();
  if (step === null || !STEPS.includes(step)) break;
  if (!seen.has(step)) {
    seen.add(step);
    await page.waitForTimeout(400);
    const file = `${String(seen.size).padStart(2, '0')}-${step}.jpg`;
    await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 62 }));
    const card = await page.locator('.goal-card:not(.goal-card--done):not(.goal-card--already)').last().innerText();
    const categories = await page.$$eval('.build-menu-category[data-category]', buttons => buttons.map(button => `${button.getAttribute('data-category')}:${button.getAttribute('aria-disabled') === 'true' ? 'locked' : 'open'}`));
    const layers = await page.$$eval('.control-layer', buttons => buttons.map(button => `${button.getAttribute('data-layer')}:${button.getAttribute('aria-disabled') === 'true' ? 'locked' : 'open'}`));
    const advisor = await page.locator('.steward-line').count() ? await page.locator('.steward-line').innerText() : null;
    const expected = OPEN_BY_STEP(step);
    const expectedCategories = Object.entries(expected.categories).map(([key, open]) => `${key}:${open ? 'open' : 'locked'}`);
    const expectedLayers = Object.entries(expected.layers).map(([key, open]) => `${key}:${open ? 'open' : 'locked'}`);
    const locksMatch = JSON.stringify(categories) === JSON.stringify(expectedCategories) && JSON.stringify(layers) === JSON.stringify(expectedLayers);
    const remnants = AUDIT ? await audit() : undefined;
    rows.push({ step, locksMatch, ...(remnants === undefined ? {} : { remnants }), file, atSeconds: Math.round((Date.now() - startedAt) / 100) / 10, card: card.replace(/\n+/g, ' | '), categories, layers, advisor, pressesBefore: presses });
  }
  const label = await page.locator(`[data-tutorial-cta="${step}"]`).innerText();
  await page.locator(`[data-tutorial-cta="${step}"]`).click();
  presses += 1;
  rows[rows.length - 1].presses = [...(rows[rows.length - 1].presses ?? []), label];
  await page.waitForTimeout(700);
  if (step === last && presses > 70) break;
  last = step;
}
await page.waitForTimeout(1_600);
await writeFile(join(outDir, '14-after.jpg'), await page.screenshot({ type: 'jpeg', quality: 62 }));
const state = await page.evaluate(() => {
  const s = window.__FEUDAL_PHASE10_PROOF__.state();
  return { tick: s.tick, speed: document.querySelector('.speed-seal[aria-pressed="true"]')?.getAttribute('aria-label') ?? null,
    sites: s.constructionSites.map(site => `${site.kind}@${site.tx},${site.ty}`), zones: (s.zones ?? []).map(zone => `${zone.kind}:${zone.membership.length}`),
    buildings: s.buildings.length };
});
// UX-2: every category and the zone layer open once more at the end (the replay only opens the ones the script uses).
const menuAudit = [];
if (AUDIT) {
  await page.locator('.control-layer[data-layer="direct"]').click(); await page.waitForTimeout(300);
  for (const key of ['living', 'paths', 'trade', 'storage', 'public', 'defense']) {
    await page.locator(`.build-menu-category[data-category="${key}"]`).click({ force: true }); await page.waitForTimeout(300);
    await writeFile(join(outDir, `menu-${key}.jpg`), await page.screenshot({ type: 'jpeg', quality: 62 }));
    menuAudit.push({ view: `category ${key}`, ...(await audit()) });
  }
  await page.locator('.control-layer[data-layer="zone"]').click(); await page.waitForTimeout(300);
  await writeFile(join(outDir, 'menu-zone.jpg'), await page.screenshot({ type: 'jpeg', quality: 62 }));
  menuAudit.push({ view: 'zone layer', ...(await audit()) });
  await page.locator('.control-layer[data-layer="direct"]').click(); await page.waitForTimeout(200);
  for (const [view, summary] of [['settings', '.settings-disclosure > summary'], ['map', '.ledger-recess .command-disclosure:not(.ledger-stack) > summary'], ['view', '.ledger-stack > summary']]) {
    await page.locator(summary).first().click(); await page.waitForTimeout(300);
    await writeFile(join(outDir, `popover-${view}.jpg`), await page.screenshot({ type: 'jpeg', quality: 62 }));
    menuAudit.push({ view: `popover ${view}`, ...(await audit()) });
    await page.locator(summary).first().click(); await page.waitForTimeout(200);
  }
  if (await page.locator('.alert-stack-inspect').count() > 0) {
    await page.locator('.alert-stack-inspect').first().click(); await page.waitForTimeout(600);
    await writeFile(join(outDir, 'alert-inspector.jpg'), await page.screenshot({ type: 'jpeg', quality: 62 }));
    menuAudit.push({ view: 'warning row [보기] → inspector', ...(await audit()) });
  }
  if (welcomeAudit !== null) menuAudit.unshift({ view: 'welcome', ...welcomeAudit });
}
const cardsAfter = await page.$$eval('.goal-card', cards => cards.map(card => card.innerText.replace(/\n+/g, ' | ')));
const remnantCount = [...rows.map(row => row.remnants), ...menuAudit].filter(Boolean)
  .reduce((total, item) => total + item.glyphs.length + item.controls.length + item.dark.length + item.svgs.length, 0);
const result = { url, viewport: { width, height }, ...(AUDIT ? { remnantCount, menuAudit } : {}), stepsCompleted: rows.length, allSteps: STEPS.every(step => seen.has(step)), locksMatch: rows.every(row => row.locksMatch), presses, seconds: Math.round((Date.now() - startedAt) / 1000), rows, state, cardsAfter };
await writeFile(join(outDir, 'replay.json'), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify({ ...(AUDIT ? { remnantCount } : {}), steps: rows.map(row => row.step), presses, allSteps: result.allSteps, locksMatch: result.locksMatch, mismatched: rows.filter(row => !row.locksMatch).map(row => row.step), state: result.state, cardsAfter }, null, 1));
await browser.close();
