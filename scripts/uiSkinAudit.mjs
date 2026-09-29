// UI-KIT-1 gate ① (docs/design/ui-kit.md): the skin audit. Opens every UI state headless and checks each visible
// interactive element's computed style: it passes when its own `border-image-source` or `background-image` is UI art
// (the P0 pieces under /assets/ui-p0/, the Astra UI waves under /assets/wave*/), or — a kit `surface` (a cell, row or
// card of a framed strip or panel, `.ui-btn--surface`) or a kit list option — when a framed ancestor within six levels
// carries that art. Native <select>, <input> (other than the kit slider) and <textarea> are failures too.
// Writes <out>/audit.json (per state: counts and every skinless element) and a capture per state with the skinless
// elements outlined, plus sheet-desktop.jpg (every state) and the gallery at desktop and tablet size (gate ③).
//   PLAYWRIGHT_MODULE=... node scripts/uiSkinAudit.mjs <out-dir> --url <url> --states <dir of scripts/ui5States.ts> [--states6 <dir of scripts/ui6States.ts>]
// Exit 1 when any state has a skinless element or a state could not be opened.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4282/';
const statesDir = flag('states');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, errors: [], states: {}, total: { elements: 0, skinless: 0, native: 0 } };
const load = name => JSON.parse(readFileSync(join(statesDir, `${name}.json`), 'utf8'));
const houseTile = state => { const house = state.buildings.find(building => building.kind === 'house') ?? state.buildings[0]; return [house.tx, house.ty]; };
const captures = [];

/** NAT-1: In the page: every visible floating box and whether it has a 9-slice frame.
 *  A floating box is positioned (fixed/absolute) and matches one of the inventoried selectors.
 *  Returns one row per frameless box found (empty array = audit passes). */
function auditFloatingBoxes() {
  const FLOATING_SELECTORS = [
    '.season-strip-panel', '.event-card', '.steward-bubble:not(.steward-advisor)',
    '.layer-switch-note', '.resource-bar__coin-detail',
    '.settlement-crisis-slot .settlement-crisis',
    '.command-popover', '.build-menu-details', '.slot-panel', '.ui-tooltip',
  ];
  const ART = /url\("?[^")]*\/assets\/(ui-p0|wave\d+[a-z]?)\//i;
  const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
  const hasFrame = element => ART.test(getComputedStyle(element).borderImageSource);
  const rows = [];
  for (const selector of FLOATING_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      if (!visible(element)) continue;
      if (!hasFrame(element)) rows.push({ selector, class: element.className.toString().slice(0, 60) });
    }
  }
  return rows;
}

/** In the page: every visible interactive element and whether it wears the skin. */
function auditPage() {
  const SELECTOR = 'button, summary, [role="button"], [role="tab"], [role="option"], [role="switch"], [role="checkbox"], [role="slider"], a[href], input:not([type="hidden"]), select, textarea';
  const ART = /url\("?[^")]*\/assets\/(ui-p0|wave\d+[a-z]?)\//i;
  const art = element => { const style = getComputedStyle(element); return ART.test(style.borderImageSource) || ART.test(style.backgroundImage); };
  const visible = element => { const box = element.getBoundingClientRect(); const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && (element.checkVisibility?.({ opacityProperty: false }) ?? true); };
  // A framed ancestor, or a frame layer beside it that covers it (a chronicle card's Wave 19 frame is a sibling overlay).
  const covers = (layer, element) => { const outer = layer.getBoundingClientRect(); const inner = element.getBoundingClientRect(); const x = inner.left + inner.width / 2; const y = inner.top + inner.height / 2;
    return x >= outer.left && x <= outer.right && y >= outer.top && y <= outer.bottom; };
  const framedAncestor = element => { let node = element.parentElement; for (let depth = 0; node !== null && depth < 6; depth += 1, node = node.parentElement) {
    if (art(node)) return true;
    if (depth < 2 && [...node.children].some(child => child !== element && !child.contains(element) && art(child) && covers(child, element))) return true;
  } return false; };
  const path = element => { const parts = []; for (let node = element; node !== null && node !== document.body && parts.length < 4; node = node.parentElement) {
    const classes = [...node.classList].filter(name => !name.startsWith('ui-btn')).slice(0, 2).join('.'); parts.unshift(`${node.tagName.toLowerCase()}${classes === '' ? '' : `.${classes}`}`); } return parts.join(' > '); };
  const rows = [];
  for (const element of document.querySelectorAll(SELECTOR)) {
    if (!visible(element)) continue;
    const tag = element.tagName.toLowerCase();
    const native = (tag === 'select' || tag === 'textarea' || (tag === 'input' && !element.classList.contains('ui-slider')));
    const surface = element.classList.contains('ui-btn--surface') || element.classList.contains('ui-select-option');
    const own = art(element);
    const skinned = !native && (own || (surface && framedAncestor(element)));
    rows.push({ skinned, native, surface, own, path: path(element), kit: element.classList.contains('ui-btn') || element.closest('.ui-select, .ui-slider') !== null,
      text: (element.getAttribute('aria-label') ?? element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) });
    if (!skinned) element.setAttribute('data-skin-audit', 'skinless');
  }
  return rows;
}

async function audit(name, page, file) {
  await page.addStyleTag({ content: '[data-skin-audit="skinless"] { outline: 3px solid #e0115f !important; outline-offset: 1px !important; }' });
  const rows = await page.evaluate(auditPage);
  // NAT-1: also check floating boxes for missing 9-slice frames.
  const frameless = await page.evaluate(auditFloatingBoxes);
  const skinless = rows.filter(row => !row.skinned);
  result.states[name] = { elements: rows.length, kit: rows.filter(row => row.kit).length, surfaces: rows.filter(row => row.surface).length,
    skinless: skinless.length, native: rows.filter(row => row.native).length, frameless: frameless.length,
    list: skinless.map(({ path, text, native }) => ({ path, text, native })), framelessList: frameless };
  result.total.elements += rows.length; result.total.skinless += skinless.length; result.total.native += rows.filter(row => row.native).length;
  if (!result.total.frameless) result.total.frameless = 0;
  result.total.frameless += frameless.length;
  if (frameless.length > 0) console.warn(`NAT-1 frameless boxes in ${name}:`, frameless.map(f => f.selector).join(', '));
  await page.screenshot({ path: join(out, file), type: 'jpeg', quality: 70 });
  captures.push({ name, file });
  console.log(`${name}: ${rows.length} elements, ${skinless.length} skinless, ${frameless.length} frameless-boxes`);
}

async function scene(stateName, tile, extra = {}) {
  const opened = await openScene(browser, { state: load(stateName), tile, baseUrl: url, width: extra.width ?? 1280, height: extra.height ?? 800, zoom: extra.zoom ?? 1.4, run: extra.run ?? false,
    initScript: TUTORIAL_OFF, query: extra.query ?? '', hasTouch: extra.hasTouch ?? false, isMobile: extra.isMobile ?? false });
  opened.page.on('pageerror', error => result.errors.push(`${stateName}: ${String(error)}`));
  return opened;
}
/** A story modal: it opens on its own, or from its event chip (the chip is the way in when the card waits). */
async function storyModal(page, selector, file) {
  const card = page.locator(selector);
  if (!await card.waitFor({ timeout: 8_000 }).then(() => true).catch(() => false)) {
    // As a player opens it: the chip, then the event card's [결정하기].
    await page.locator('.event-chip').first().click({ timeout: 20_000 }).catch(() => undefined);
    await page.locator('.event-card-decide').first().click({ timeout: 10_000 }).catch(() => undefined);
    await card.waitFor({ timeout: 30_000 }).catch(async error => { await page.screenshot({ path: join(out, file), type: 'jpeg' }); throw error; });
  }
}
// UI-9b: a paused save's chapter page (or a petition card) does not always open on the DGX (the story never pushes it,
// nothing blocks it; seen on the trunk too); a step that timed out before auditing anything loads its scene again, up
// to three times. A step that audited something is not repeated (nothing is counted twice).
async function step(name, run) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const before = result.total.elements;
    try { await run(); return; } catch (error) {
      const retry = attempt < 3 && result.total.elements === before && String(error).includes('Timeout');
      console.log(`${name}: ${retry ? `attempt ${attempt} timed out, again` : 'FAILED'} ${String(error).slice(0, 200)}`);
      if (!retry) { result.errors.push(`${name}: ${String(error).slice(0, 300)}`); return; }
    }
  }
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Title (a fresh profile: the welcome and the tutorial switch), then the mode screen.
await step('title', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto(url);
  await page.locator('.welcome-parchment').waitFor({ timeout: 60_000 });
  await pause(800);
  await audit('title', page, 's01-title.jpg');
  await context.close();
});

// The town at rest and its drawers (the seed 1 merchant town): each group of states on its own fresh page.
const town = () => load('merchant-town');
await step('town', async () => {
  const { context, page } = await scene('merchant-town', houseTile(town()));
  await pause(800);
  await audit('normal', page, 's02-normal.jpg');
  await page.locator("[data-dock='build']").click(); await pause(400);
  await audit('drawer', page, 's03-build-drawer.jpg');
  await page.locator('button.build-menu-category[data-category]', { hasText: /^생활/ }).click(); await pause(300);
  await page.locator('button[aria-label="오두막"]:visible').first().click(); await pause(500);
  const tile = await page.evaluate(at => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), (([tx, ty]) => ({ tx: tx + 3, ty: ty + 3 }))(houseTile(town())));
  await page.mouse.move(tile.clientX, tile.clientY, { steps: 3 }); await pause(600);
  await audit('placement', page, 's04-placement.jpg');
  await context.close();
});
await step('zone', async () => {
  const { context, page } = await scene('merchant-town', houseTile(town()));
  await pause(600);
  await page.locator('.control-layer', { hasText: '구역' }).first().click(); await pause(600);
  await audit('zone', page, 's05-zone.jpg');
  await context.close();
});
await step('selection', async () => {
  const { context, page } = await scene('merchant-town', houseTile(town()), { zoom: 1.6 });
  await pause(600);
  const house = await page.evaluate(at => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), (([tx, ty]) => ({ tx, ty }))(houseTile(town())));
  await page.mouse.click(house.clientX, house.clientY); await pause(800);
  await audit('selection', page, 's06-selection.jpg');
  const chip = page.locator('.person-chip:visible').first();
  await chip.click(); await pause(700); await audit('person-card', page, 's07-person-card.jpg');
  // The card's [전기 보기]: the biography page of the chronicle.
  await page.locator('.person-card-action', { hasText: '전기' }).click(); await pause(1200);
  await audit('biography', page, 's11-biography.jpg');
  await context.close();
});
await step('ledger', async () => {
  const { context, page } = await scene('merchant-town', houseTile(town()));
  await pause(600);
  await page.locator("[data-dock='ledger']").click(); await pause(600);
  await audit('ledger', page, 's08-ledger.jpg');
  await page.locator('.ledger-tab--chronicle').click(); await pause(1500);
  await audit('chronicle', page, 's09-chronicle.jpg');
  await page.locator('.chronicle-select .ui-select-trigger').first().click(); await pause(400);
  await audit('chronicle-select-open', page, 's10-chronicle-select.jpg');
  await context.close();
});

// The pause menu and its settings (sound, the season card switch).
await step('pause', async () => {
  const state = load('merchant-town');
  const { context, page } = await scene('merchant-town', houseTile(state));
  await pause(500);
  await page.keyboard.press('Escape'); await pause(600);
  await audit('pause-settings', page, 's12-pause-settings.jpg');
  await context.close();
});

// The petition card and the famine decision (seed 2 chapter 1). The story waits 5 s: openScene's opening Escape closes
// a card that opened sooner (as a player's Escape does), and the fallback chip may be another event's.
await step('petition', async () => {
  const state = load('petition-open');
  const { context, page } = await scene('petition-open', houseTile(state), { query: '&story-delay=5000' });
  await storyModal(page, '.petition-card', 'x-petition-timeout.jpg'); await pause(600);
  await audit('petition', page, 's13-petition.jpg');
  await context.close();
});
await step('decision', async () => {
  const state = load('famine-arrival');
  const { context, page } = await scene('famine-arrival', houseTile(state), { query: '&story-delay=5000' });
  await storyModal(page, '.famine-decision', 'x-decision-timeout.jpg'); await pause(800);
  await audit('decision', page, 's14-decision.jpg');
  await context.close();
});
// The season card: the carter state runs at the fastest speed to the season's close.
await step('season', async () => {
  const state = load('carrying');
  const { context, page } = await scene('carrying', houseTile(state), { run: true, query: '&story-delay=600000' });
  await page.keyboard.press('Digit3').catch(() => undefined);
  await page.locator('.season-ledger-card').waitFor({ timeout: 90_000 }); await pause(900);
  await audit('season', page, 's15-season.jpg');
  await context.close();
});
// The chapter's end (the chronicle card with its buttons).
await step('chapter-end', async () => {
  const state = load('chapter-end');
  const { context, page } = await scene('chapter-end', houseTile(state));
  // ECON-UI: the page opens after the story's world-first delay; on a busy DGX that took over 30 s twice (the audit shot
  // the plain map and then waited for .chronicle-full), so the page is awaited before its audit.
  await page.locator('.chronicle-full').waitFor({ timeout: 90_000 }); await pause(1500);
  await audit('chapter-end', page, 's16-chapter-end.jpg');
  // The whole chronicle of a live run (seed 2, 1323: two eras entered, three ahead at their nominal years).
  await page.locator('.chronicle-full').click(); await pause(1500);
  await audit('chronicle-live', page, 's17-chronicle-live.jpg');
  // UI-6: the chronicle's faction tab (the nine factions, the world strip) and one faction's page — the first that
  // remembers something, so its record links (buttons) are audited too.
  await page.getByRole('tab', { name: '세력' }).click(); await pause(1500);
  await audit('chronicle-factions', page, 's18-chronicle-factions.jpg');
  const remembering = page.locator('.chronicle-factions-row:not([data-memory="0"])');
  await (await remembering.count() > 0 ? remembering.first() : page.locator('.chronicle-factions-row').first()).click(); await pause(1500);
  await audit('chronicle-faction-page', page, 's19-chronicle-faction-page.jpg');
  await context.close();
});

// UI-6: chapter 2 (the states of scripts/ui6States.ts, with --states6): two of the war's decision cards (the Crown's
// writ; the bishop's refugees), the ledger's rights tab at a decline (a right lost) and at chapter 2's end, and chapter
// 2's page. The story waits 5 s (as scripts/ui6Captures.ts): the scene's opening Escape (openScene) would close a
// page that opened sooner, as a player's Escape does.
const states6 = flag('states6');
const load6 = name => JSON.parse(readFileSync(join(states6, `${name}.json`), 'utf8'));
const keepTile = state => { const keep = state.buildings.find(building => building.kind === 'keep') ?? state.buildings.find(building => building.kind === 'house'); return [keep.tx, keep.ty]; };
async function scene6(stateName, extra = {}) {
  const state = load6(stateName);
  const opened = await openScene(browser, { state, tile: keepTile(state), baseUrl: url, width: 1280, height: 800, zoom: 1.1, run: false,
    initScript: TUTORIAL_OFF, query: extra.query ?? '' });
  opened.page.on('pageerror', error => result.errors.push(`${stateName}: ${String(error)}`));
  return opened;
}
if (states6 !== undefined) {
  for (const [name, stateName] of [['war-petition-writ', 'wool_payment'], ['war-petition-refugees', 'refugee_admission']]) {
    await step(name, async () => {
      const { context, page } = await scene6(stateName, { query: '&story-delay=5000' });
      await storyModal(page, '.petition-card', `x-${name}-timeout.jpg`); await pause(700);
      await audit(name, page, `s20-${name}.jpg`);
      await context.close();
    });
  }
  for (const [name, stateName] of [['rights-decline', 'decline'], ['rights-chapter2', 'chapter2-end']]) {
    await step(name, async () => {
      const { context, page } = await scene6(stateName, { query: '&story-delay=600000' });
      await pause(1000);
      await page.locator("[data-dock='ledger']").click(); await pause(500);
      await page.locator('.ledger-tab', { hasText: /^권리$/ }).click(); await pause(700);
      await audit(name, page, `s21-${name}.jpg`);
      await context.close();
    });
  }
  await step('chapter2-page', async () => {
    const { context, page } = await scene6('chapter2-end', { query: '&story-delay=5000' });
    await page.locator('.chronicle-page').waitFor({ timeout: 30_000 }); await pause(800);
    await audit('chapter2-page', page, 's22-chapter2-page.jpg');
    await context.close();
  });
}

// UI-8: chapter 3 — the plague's wage ledger in the stock tab and chapter 3's end page. States from --states8.
const states8 = flag('states8');
const load8 = name => JSON.parse(readFileSync(join(states8, `${name}.json`), 'utf8'));
async function scene8(stateName, extra = {}) {
  const state = load8(stateName);
  const opened = await openScene(browser, { state, tile: houseTile(state), baseUrl: url, width: 1280, height: 800, zoom: 1.1, run: false,
    initScript: TUTORIAL_OFF, query: extra.query ?? '' });
  opened.page.on('pageerror', error => result.errors.push(`${stateName}: ${String(error)}`));
  return opened;
}
if (states8 !== undefined) {
  await step('wage-ledger', async () => {
    const { context, page } = await scene8('chapter3-end', { query: '&story-delay=600000' });
    await pause(1000);
    await page.locator("[data-dock='ledger']").click(); await pause(500);
    await audit('wage-ledger', page, 's23-wage-ledger.jpg');
    await context.close();
  });
  await step('chapter3-page', async () => {
    const { context, page } = await scene8('chapter3-end', { query: '&story-delay=5000' });
    await page.locator('.chronicle-page').waitFor({ timeout: 30_000 }); await pause(800);
    await audit('chapter3-page', page, 's24-chapter3-page.jpg');
    await context.close();
  });
}

// UI-9: chapter 4 — a reorganisation card, the faction tab's influence and tug of war, the rights tab (the charter's
// rights, the fee farm, the revolt pressure), the chapter 4 ledger and chapter 4's end page. States from --states9.
const states9 = flag('states9');
if (states9 !== undefined) {
  const scene9 = async (stateName, query) => {
    const state = JSON.parse(readFileSync(join(states9, `${stateName}.json`), 'utf8'));
    const opened = await openScene(browser, { state, tile: houseTile(state), baseUrl: url, width: 1280, height: 800, zoom: 1.1, run: false, initScript: TUTORIAL_OFF, query });
    opened.page.on('pageerror', error => result.errors.push(`${stateName}: ${String(error)}`));
    return opened;
  };
  const dismiss = async page => {
    for (const selector of ['.chronicle-page .chronicle-keep', '.story-modal-later', '.season-ledger-resume']) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await pause(400); }
  };
  await step('reorg-petition', async () => {
    const { context, page } = await scene9('borough_charter', '&story-delay=0');
    await page.locator('.petition-card').waitFor({ timeout: 60_000 }).catch(async () => { await page.locator('.event-chip').first().click(); });
    await page.locator('.petition-card').waitFor({ timeout: 30_000 }); await pause(600);
    await audit('reorg-petition', page, 's25-reorg-petition.jpg');
    await context.close();
  });
  await step('factions-chapter4', async () => {
    const { context, page } = await scene9('rumour-chased', '&story-delay=600000');
    await pause(1000); await dismiss(page);
    await page.locator("[data-dock='ledger']").click(); await pause(500);
    await page.locator('.ledger-tab--chronicle').first().click(); await pause(1200);
    await page.evaluate(() => { for (const tab of document.querySelectorAll('.chronicle-tab')) if (tab.textContent?.trim() === '세력') tab.click(); }); await pause(900);
    await audit('factions-chapter4', page, 's26-factions-chapter4.jpg');
    await context.close();
  });
  for (const [name, tab, file] of [['rights-chapter4', 'rights', 's27-rights-chapter4.jpg'], ['reorg-ledger', 'stock', 's28-reorg-ledger.jpg']]) {
    await step(name, async () => {
      const { context, page } = await scene9('chapter4-end', '&story-delay=600000');
      await pause(1000); await dismiss(page);
      await page.locator("[data-dock='ledger']").click(); await pause(500);
      await page.locator(`[data-ledger-tab='${tab}']`).first().click(); await pause(600);
      await audit(name, page, file);
      await context.close();
    });
  }
  await step('chapter4-page', async () => {
    const { context, page } = await scene9('chapter4-end', '&story-delay=5000');
    await page.locator('.chronicle-page').waitFor({ timeout: 90_000 }); await pause(800);
    await audit('chapter4-page', page, 's29-chapter4-page.jpg');
    await context.close();
  });
}

// Gate ③: the gallery at desktop and tablet size (full page), audited as well.
for (const [name, viewport, touch] of [['gallery-desktop', { width: 1280, height: 800 }, false], ['gallery-tablet', { width: 1180, height: 820 }, true]]) {
  await step(name, async () => {
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    await page.goto(new URL('dev/ui-kit', url).href);
    await page.locator('[data-testid="ui-kit-gallery"]').waitFor({ timeout: 60_000 }); await pause(800);
    await page.locator('.ui-select-trigger').first().click(); await pause(300);
    await audit(name, page, `g-${name}.jpg`);
    const height = await page.evaluate(() => document.querySelector('.ui-kit-gallery').scrollHeight);
    await page.setViewportSize({ width: viewport.width, height: Math.min(height, 4000) }); await pause(400);
    await page.screenshot({ path: join(out, `g-${name}-full.jpg`), type: 'jpeg', quality: 72 });
    await context.close();
  });
}

// The sheet: every state's capture on one page.
await step('sheet', async () => {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const cells = captures.filter(entry => !entry.name.startsWith('gallery')).map(({ name, file }) =>
    `<figure><img src="data:image/jpeg;base64,${readFileSync(join(out, file)).toString('base64')}"><figcaption>${name} · ${result.states[name].skinless} / ${result.states[name].elements}</figcaption></figure>`).join('');
  await page.setContent(`<style>body{margin:8px;background:#222;font:14px sans-serif;color:#eee}main{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}img{width:100%;display:block}figure{margin:0}</style><main>${cells}</main>`);
  await pause(300);
  await page.screenshot({ path: join(out, 'sheet-desktop.jpg'), type: 'jpeg', quality: 70, fullPage: true });
  await context.close();
});

await browser.close();
const expected = ['title', 'normal', 'drawer', 'placement', 'zone', 'selection', 'ledger', 'chronicle', 'biography', 'pause-settings', 'petition', 'decision', 'season', 'chapter-end', 'chronicle-factions', 'chronicle-faction-page', 'gallery-desktop', 'gallery-tablet',
  ...(states6 === undefined ? [] : ['war-petition-writ', 'war-petition-refugees', 'rights-decline', 'rights-chapter2', 'chapter2-page']),
  ...(states8 === undefined ? [] : ['wage-ledger', 'chapter3-page']),
  ...(states9 === undefined ? [] : ['reorg-petition', 'factions-chapter4', 'rights-chapter4', 'reorg-ledger', 'chapter4-page'])];
result.missing = expected.filter(name => result.states[name] === undefined);
// NAT-1: frameless floating boxes are also failures.
result.pass = result.total.skinless === 0 && result.missing.length === 0 && (result.total.frameless ?? 0) === 0;
writeFileSync(join(out, 'audit.json'), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify({ pass: result.pass, total: result.total, missing: result.missing, errors: result.errors.length }));
process.exit(result.pass ? 0 : 1);
