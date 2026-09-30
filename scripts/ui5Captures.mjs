// UI-5 gates ①–③ in the browser (JPEG captures and one JSON of what each showed), on the states of scripts/ui5States.ts:
//  ① the petition card with its petitioners (a chip opens that person's card; closing it returns to the petition), the
//    famine decision modal with the steward (the fixed portrait's look of concern and the name; the chip opens the
//    steward's card with the lord's arms, and [전기 보기] the steward's biography in the chronicle), the map's house card
//    with its members (head first; a chip opens the card, and time stops while it is up), a merchant's card with the
//    household's mark, the walker card (who, and verb + what + where + progress) and the steward's bubble with the name
//  ② the portraits on screen: how many are drawn with a matching portrait (`data-portrait-exact`, one per person)
//  ③ the same seed gives the same arms (the composite's pixel digest on two fresh loads, and composed directly from the
//    seed), other seeds other arms; the same merchant household the same mark on two loads; the compose times
//  + the aging crossfade (a member's portrait moving to the next picture of the chain while the house card is open, 5x)
//  + a touch tablet (1180 x 820): the person card's and chips' targets ≥ 48 px, text ≥ 12 px
//   PLAYWRIGHT_MODULE=... node scripts/ui5Captures.mjs <out-dir> --url <url> --states <dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/ui5Captures.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node scripts/ui5Captures.mjs …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4282/';
const baseUrl = flag('base');
const statesDir = flag('states');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, errors: [], gates: {}, shown: {} };
const moments = JSON.parse(readFileSync(join(statesDir, 'moments.json'), 'utf8'));
const load = name => JSON.parse(readFileSync(join(statesDir, `${name}.json`), 'utf8'));
const shot = (page, file, clip) => page.screenshot({ path: join(out, file), type: 'jpeg', quality: 72, ...(clip ? { clip } : {}) });
const around = async (locator, pad = 16) => { const box = await locator.boundingBox(); return box === null ? undefined : { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + 2 * pad, height: box.height + 2 * pad }; };
const tick = page => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick);
const houseTile = (state, id) => { const building = state.buildings.find(entry => entry.id === id); return [building.tx, building.ty]; };
const chapel = state => { const building = state.buildings.find(entry => entry.kind === 'keep' || entry.kind === 'church' || entry.kind === 'chapel') ?? state.buildings[0]; return [building.tx, building.ty + 1]; };

/** ② every portrait on screen that belongs to a person (chips, the card, the walker line), one per person. */
async function collect(page, where) {
  const seen = await page.evaluate(() => [...document.querySelectorAll('[data-person][data-portrait-exact]')].map(element => ({ person: element.getAttribute('data-person'), exact: element.getAttribute('data-portrait-exact') === 'true' })));
  for (const entry of seen) result.shown[entry.person] = { exact: entry.exact, where: result.shown[entry.person]?.where ?? where };
  return seen.length;
}

async function open(name, stateName, tile, extra = {}) {
  const opened = await openScene(browser, { state: stateName === null ? null : load(stateName), tile, baseUrl: extra.baseUrl ?? url, width: extra.width ?? 1280, height: extra.height ?? 800,
    zoom: extra.zoom ?? 1.4, run: false, initScript: extra.initScript === undefined ? TUTORIAL_OFF : extra.initScript, hasTouch: extra.hasTouch ?? false, isMobile: extra.isMobile ?? false });
  opened.page.on('pageerror', error => result.errors.push(`${name}: ${String(error)}`));
  opened.page.on('console', message => { if (message.type() === 'error') result.errors.push(`${name} console: ${message.text()}`); });
  return opened;
}

const card = page => page.locator('.person-card');
/** The open person card: what it says, and its emblem once composed (the digest of its pixels). */
async function cardFacts(page) {
  await card(page).waitFor({ timeout: 10_000 });
  const kind = await page.locator('.person-card-emblem').getAttribute('data-emblem-kind');
  if (kind !== 'none') await page.locator('.person-card img.emblem-image').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const section = document.querySelector('.person-card');
    const image = section.querySelector('img.emblem-image');
    const layer = section.querySelector('.person-card-portrait .person-portrait-layer');
    const face = layer === null ? null : /url\("?([^")]+)"?\)/.exec(getComputedStyle(layer).backgroundImage)?.[1] ?? null;
    return { person: section.getAttribute('data-person'), portrait: section.getAttribute('data-portrait'), exact: section.getAttribute('data-portrait-exact'),
      face, name: section.querySelector('h2')?.textContent ?? null, lines: [...section.querySelectorAll('.person-card-text p')].map(p => p.textContent),
      emblemKind: section.querySelector('.person-card-emblem')?.getAttribute('data-emblem-kind') ?? null,
      emblem: image?.getAttribute('data-emblem') ?? null, digest: image?.getAttribute('data-digest') ?? null, emblemLoaded: image === null ? null : image.complete && image.naturalWidth > 0,
      frame: getComputedStyle(section).backgroundImage.includes('frame_person_card-v1') };
  });
}
const closeCard = async page => { await page.locator('.person-card-action', { hasText: '닫기' }).click(); await page.waitForTimeout(300); };
/** Which of the petition card's answers (and [나중에 정하기]) show inside its frame without scrolling. */
const petitionFit = page => page.evaluate(() => {
  const body = document.querySelector('.petition-body').getBoundingClientRect();
  const inside = element => { const box = element.getBoundingClientRect(); return box.top >= body.top - 1 && box.bottom <= body.bottom + 1; };
  return { options: [...document.querySelectorAll('.petition-option')].map(inside), later: inside(document.querySelector('.story-modal-later')), bodyHeight: Math.round(body.height),
    contentHeight: document.querySelector('.petition-body').scrollHeight };
});

// ① The petition card: its petitioners, one opened.
try {
  const state = load('petition-open');
  const { context, page } = await open('petition', 'petition-open', chapel(state));
  await page.locator('.petition-card').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await shot(page, 'u01-petition-card.jpg');
  const petitioners = await page.evaluate(() => [...document.querySelectorAll('.petition-people .person-chip')].map(chip => ({ person: chip.getAttribute('data-person'), text: chip.innerText.replace(/\n+/g, ' | '),
    portrait: chip.querySelector('.person-portrait')?.getAttribute('data-portrait') ?? null })));
  await collect(page, 'petition');
  const fit = await petitionFit(page);
  await page.locator('.petition-people .person-chip').first().click();
  const opened = await cardFacts(page);
  await shot(page, 'u02-petitioner-card.jpg', await around(card(page), 24));
  await collect(page, 'petition card');
  await closeCard(page);
  const back = { petition: await page.locator('.petition-card').count() === 1, card: await card(page).count() };
  await context.close();
  // The trunk before UI-5 on the same state: what fitted in the frame then.
  let baseFit = null;
  if (baseUrl !== undefined) {
    const base = await open('petition-base', 'petition-open', chapel(state), { baseUrl });
    await base.page.locator('.petition-card').waitFor({ timeout: 15_000 });
    await base.page.waitForTimeout(600);
    baseFit = await petitionFit(base.page);
    await shot(base.page, 'u01-base-petition-card.jpg');
    await base.context.close();
  }
  result.gates.petition = { moment: moments['petition-open'], petitioners, opened, back, fit, baseFit };
} catch (error) { result.errors.push(`petition section: ${String(error)}`); }

// ① The famine decision with the steward; the steward's card (the lord's arms) and biography. ③ the arms' digest (load 1).
try {
  const state = load('famine-arrival');
  const { context, page } = await open('famine', 'famine-arrival', chapel(state));
  await page.locator('.famine-decision').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await shot(page, 'u03-famine-modal.jpg');
  const steward = await page.evaluate(() => { const block = document.querySelector('.decision-steward'); const chip = block?.querySelector('.person-chip');
    return { person: block?.getAttribute('data-steward') ?? null, text: chip?.innerText.replace(/\n+/g, ' | ') ?? null, portrait: chip?.querySelector('.person-portrait')?.getAttribute('data-portrait') ?? null,
      advice: block?.querySelector('.decision-steward-advice')?.textContent ?? null }; });
  await shot(page, 'u03b-famine-steward.jpg', await around(page.locator('.decision-steward'), 12));
  await page.locator('.decision-steward .person-chip').click();
  const stewardCard = await cardFacts(page);
  await shot(page, 'u04-steward-card-arms.jpg', await around(card(page), 24));
  await collect(page, 'steward card');
  await page.locator('.person-card-action', { hasText: '전기 보기' }).click();
  await page.locator('.chronicle-biography').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await shot(page, 'u05-steward-biography.jpg');
  const biography = await page.evaluate(() => { const page = document.querySelector('.chronicle-biography'); return { person: page?.getAttribute('data-person'), portrait: page?.getAttribute('data-portrait'),
    match: document.querySelector('.chronicle-biography-match')?.textContent ?? null }; });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const back = { chronicle: await page.locator('.chronicle-screen').count(), famine: await page.locator('.famine-decision').count() === 1 };
  result.gates.famine = { moment: moments['famine-arrival'], steward, stewardCard, biography, back };
  await context.close();
} catch (error) { result.errors.push(`famine section: ${String(error)}`); }

// ③ The same seed, a fresh load: the same arms, pixel for pixel. The arms composed straight from seeds 1–8 (seed 2 is the
// town's), and the compose times: masks cold (the first) and warm.
try {
  const state = load('famine-arrival');
  const { context, page } = await open('famine-again', 'famine-arrival', chapel(state));
  await page.locator('.famine-decision').waitFor({ timeout: 15_000 });
  await page.locator('.decision-steward .person-chip').click();
  const again = await cardFacts(page);
  const direct = await page.evaluate(async () => {
    const { composedEmblem } = await import('/src/ui/heraldry/EmblemImage.tsx');
    const { armsKey, armsRecipe, merchantKey, merchantRecipe } = await import('/src/ui/heraldry/heraldry.ts');
    const seeds = [];
    for (let seed = 1; seed <= 8; seed += 1) { const recipe = armsRecipe(seed, 'manor'); seeds.push({ seed, key: armsKey(recipe), digest: (await composedEmblem({ kind: 'arms', recipe })).digest }); }
    return { seeds };
  });
  const first = result.gates.famine?.stewardCard ?? null;
  const seed2 = direct.seeds.find(entry => entry.seed === state.seed);
  result.gates.determinism = { stateSeed: state.seed, firstLoad: first?.digest ?? null, secondLoad: again.digest, sameAcrossLoads: first?.digest === again.digest && again.digest !== null,
    directSeedMatchesCard: seed2?.digest === again.digest, seeds: direct.seeds, distinctDigests: new Set(direct.seeds.map(entry => entry.digest)).size,
    distinctRecipes: new Set(direct.seeds.map(entry => entry.key)).size };
  await context.close();
} catch (error) { result.errors.push(`determinism section: ${String(error)}`); }

// ③ The caches' measurements (EmblemImage): a fresh page, nothing composed yet. The seed's arms with every mask cold;
// the same recipe again (the composite cache); the same masks in ten other tinctures (masks warm: the pixel walk and
// the PNG alone). A merchant mark cold and again; then, with every mark mask loaded, ten combinations not composed yet.
try {
  const state = load('famine-arrival');
  const { context, page } = await open('compose', 'famine-arrival', chapel(state));
  result.gates.compose = await page.evaluate(async seed => {
    const { composedEmblem } = await import('/src/ui/heraldry/EmblemImage.tsx');
    const { armsKey, armsRecipe, COLOURS, MERCHANT_BRANCHES, MERCHANT_FRAMES, MERCHANT_STAFFS, merchantRecipe } = await import('/src/ui/heraldry/heraldry.ts');
    const time = async spec => { const started = performance.now(); await composedEmblem(spec); return Math.round((performance.now() - started) * 10) / 10; };
    const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const arms = armsRecipe(seed, 'manor');
    const armsCold = await time({ kind: 'arms', recipe: arms });
    const armsCached = await time({ kind: 'arms', recipe: arms });
    const armsWarm = []; const seen = new Set([armsKey(arms)]);
    for (const field of COLOURS) for (const shift of [0, 1, 2]) {
      const partition = arms.partition === null ? null : { ...arms.partition, tincture: COLOURS[(COLOURS.indexOf(field) + 1 + shift) % COLOURS.length] };
      const variant = { ...arms, field, partition, charge: arms.charge === null ? null : { ...arms.charge, tincture: shift === 2 ? 'argent' : 'or' } };
      if (armsWarm.length >= 10 || seen.has(armsKey(variant))) continue;
      seen.add(armsKey(variant));
      armsWarm.push(await time({ kind: 'arms', recipe: variant }));
    }
    const mark = merchantRecipe(seed, 'house-1');
    const markCold = await time({ kind: 'merchant', recipe: mark });
    const markCached = await time({ kind: 'merchant', recipe: mark });
    const combos = MERCHANT_FRAMES.flatMap(frame => MERCHANT_STAFFS.flatMap(staff => MERCHANT_BRANCHES.map(branch => ({ frame, staff, branch }))))
      .filter(combo => combo.frame !== mark.frame || combo.staff !== mark.staff || combo.branch !== mark.branch);
    // Load every mark mask first (one mark per branch covers all frames, staffs and branches), untimed.
    for (const [index, branch] of MERCHANT_BRANCHES.entries()) await composedEmblem({ kind: 'merchant', recipe: { frame: MERCHANT_FRAMES[index % 2], staff: MERCHANT_STAFFS[index % 4], branch } });
    const composedAlready = new Set(MERCHANT_BRANCHES.map((branch, index) => `${MERCHANT_FRAMES[index % 2]}.${MERCHANT_STAFFS[index % 4]}.${branch}`));
    const markWarm = [];
    for (const combo of combos) {
      if (markWarm.length >= 10 || composedAlready.has(`${combo.frame}.${combo.staff}.${combo.branch}`)) continue;
      markWarm.push(await time({ kind: 'merchant', recipe: combo }));
    }
    return { seed, arms: { cold: armsCold, cached: armsCached, warm: armsWarm, warmMedian: median(armsWarm) },
      mark: { cold: markCold, cached: markCached, warm: markWarm, warmMedian: median(markWarm) } };
  }, state.seed);
  await context.close();
} catch (error) { result.errors.push(`compose section: ${String(error)}`); }

// ① The merchant town (seed 1): a merchant's house card with its members, the merchant's card with the household's
// mark; time stops while the card is up (1x); ③ the mark's digest on a second load.
async function merchantCard(name, running) {
  const state = load('merchant-town');
  const { merchantId, householdId } = moments['merchant-town'];
  const { context, page } = await open(name, 'merchant-town', houseTile(state, householdId), { zoom: 1.6 });
  const target = await page.evaluate(tile => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), (() => { const [tx, ty] = houseTile(state, householdId); return { tx, ty }; })());
  await page.mouse.click(target.clientX, target.clientY);
  await page.locator('.diagnostic-card .inspector-members').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  const facts = { members: await page.evaluate(() => [...document.querySelectorAll('.diagnostic-card .inspector-members .person-chip')].map(chip => ({ person: chip.getAttribute('data-person'), text: chip.innerText.replace(/\n+/g, ' | ') }))) };
  if (running) {
    // The first four, and the rest behind the toggle.
    await page.locator('.diagnostic-card .inspector-members').scrollIntoViewIfNeeded();
    await shot(page, 'u06-house-card-members.jpg', await around(page.locator('.diagnostic-card'), 20));
    facts.toggle = await page.locator('.diagnostic-card .person-list-toggle').textContent().catch(() => null);
    await page.locator('.diagnostic-card .person-list-toggle').click();
    facts.expanded = await page.locator('.diagnostic-card .inspector-members .person-chip').count();
    await collect(page, 'house card (all members)');
    await page.locator('.diagnostic-card .person-list-toggle').click();
    facts.collapsedAgain = await page.locator('.diagnostic-card .inspector-members .person-chip').count();
    await page.getByRole('button', { name: '1배속', exact: true }).click();
    await page.waitForTimeout(1_000);
    facts.running = [await tick(page)]; await page.waitForTimeout(800); facts.running.push(await tick(page));
  }
  await page.locator(`.diagnostic-card .person-chip[data-person="${merchantId}"]`).click();
  facts.card = await cardFacts(page);
  if (running) {
    facts.held = [await tick(page)]; await page.waitForTimeout(1_500); facts.held.push(await tick(page));
    await shot(page, 'u07-merchant-card-mark.jpg', await around(card(page), 24));
    await collect(page, 'merchant card');
    await closeCard(page);
    await page.waitForTimeout(1_000);
    facts.resumed = await tick(page);
    facts.cardClosedHouseCardKept = await page.locator('.diagnostic-card .inspector-members').count() === 1;
    facts.timeStopped = facts.running[1] > facts.running[0] && facts.held[1] === facts.held[0] && facts.resumed > facts.held[1];
  }
  await context.close();
  return facts;
}
try {
  const first = await merchantCard('merchant', true);
  const second = await merchantCard('merchant-again', false);
  result.gates.merchant = { moment: moments['merchant-town'], ...first, secondLoad: second.card.digest, sameAcrossLoads: first.card.digest === second.card.digest && first.card.digest !== null };
} catch (error) { result.errors.push(`merchant section: ${String(error)}`); }

// ① A seed 2 family (chapter end, after 계속): the house card and the head's card (no arms or mark: a commoner house).
try {
  const state = load('chapter-end');
  const house = state.houses.map(entry => ({ id: entry.buildingId, count: state.persons.people.filter(person => person.householdId === entry.buildingId).length })).sort((a, b) => b.count - a.count)[0];
  const { context, page } = await open('family', 'chapter-end', houseTile(state, house.id), { zoom: 1.6 });
  await page.getByRole('button', { name: '계속 (샌드박스)' }).click().catch(() => undefined);
  await page.waitForTimeout(400);
  const [tx, ty] = houseTile(state, house.id);
  const target = await page.evaluate(tile => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx, ty });
  await page.mouse.click(target.clientX, target.clientY);
  await page.locator('.diagnostic-card .inspector-members').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await shot(page, 'u08-family-house-card.jpg', await around(page.locator('.diagnostic-card'), 20));
  // Every member (the toggle opens the rest): the portraits on screen for gate ②.
  await page.locator('.diagnostic-card .person-list-toggle').click().catch(() => undefined);
  const members = await page.evaluate(() => [...document.querySelectorAll('.diagnostic-card .inspector-members .person-chip')].map(chip => ({ person: chip.getAttribute('data-person'), text: chip.innerText.replace(/\n+/g, ' | ') })));
  await collect(page, 'family house card (all members)');
  await page.locator('.diagnostic-card .inspector-members .person-chip').first().click();
  const head = await cardFacts(page);
  await shot(page, 'u09-family-head-card.jpg', await around(card(page), 24));
  result.gates.family = { house: house.id, members, head };
  await context.close();
} catch (error) { result.errors.push(`family section: ${String(error)}`); }

// ① The walker card: a carter loaded for a building site.
try {
  const state = load('carrying');
  const { walkerId, tile } = moments.carrying;
  const { context, page } = await open('walker', 'carrying', [tile.tx, tile.ty], { zoom: 2 });
  const point = await page.evaluate(at => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), tile);
  await page.mouse.click(point.clientX, point.clientY);
  await page.locator(`.diagnostic-card [data-walker-headline="${walkerId}"]`).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  const box = await page.locator('.diagnostic-card').boundingBox();
  await shot(page, 'u10-walker-card.jpg', { x: Math.max(0, Math.min(point.clientX, box.x) - 60), y: Math.max(0, Math.min(point.clientY, box.y) - 60),
    width: Math.min(1280, Math.max(point.clientX, box.x + box.width) - Math.min(point.clientX, box.x) + 120), height: Math.min(800, Math.max(point.clientY, box.y + box.height) - Math.min(point.clientY, box.y) + 120) });
  const walker = await page.evaluate(id => { const line = document.querySelector(`[data-walker-headline="${id}"]`); const cardElement = line.closest('.diagnostic-card');
    return { line: line.textContent, person: line.getAttribute('data-person'), exact: line.getAttribute('data-portrait-exact'), title: cardElement.querySelector('h2, .inspector-title, strong')?.textContent ?? null,
      portrait: cardElement.querySelector('.person-portrait')?.getAttribute('data-portrait') ?? null, text: cardElement.innerText.replace(/\n+/g, ' | ').slice(0, 400) }; }, walkerId);
  const look = await page.evaluate(id => window.__FEUDAL_PHASE10_PROOF__.walkerLooks().find(entry => entry.id === id), walkerId);
  await collect(page, 'walker card');
  result.gates.walker = { moment: moments.carrying, state: state.tick, walker, look };
  await context.close();
} catch (error) { result.errors.push(`walker section: ${String(error)}`); }

// + The aging crossfade: the house card open at 5x until the member's picture moves on.
try {
  const state = load('aging-eve');
  const { houseId, personId } = moments['aging-eve'];
  const { context, page } = await open('aging', 'aging-eve', houseTile(state, houseId), { zoom: 1.6 });
  const [tx, ty] = houseTile(state, houseId);
  const target = await page.evaluate(tile => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx, ty });
  await page.mouse.click(target.clientX, target.clientY);
  await page.locator('.diagnostic-card .inspector-members').waitFor({ timeout: 10_000 });
  const chip = page.locator(`.diagnostic-card .person-chip[data-person="${personId}"]`);
  const before = await chip.locator('.person-portrait').getAttribute('data-portrait');
  await shot(page, 'u11-aging-before.jpg', await around(page.locator('.diagnostic-card'), 20));
  await page.getByRole('button', { name: '5배속', exact: true }).click();
  const started = Date.now(); let during = null;
  while (Date.now() - started < 20_000) {
    during = await chip.evaluate(element => { const layers = [...element.querySelectorAll('.person-portrait-layer')]; return layers.length === 2 ? { out: layers[0].className, in: layers[1].className,
      shown: element.querySelector('.person-portrait').getAttribute('data-portrait'), opacity: layers.map(layer => Number(getComputedStyle(layer).opacity).toFixed(2)) } : null; }).catch(() => null);
    if (during !== null) break;
    await page.waitForTimeout(40);
  }
  // Mid-fade (the 600 ms crossfade, about 300 ms in): both pictures, the new one coming up over the old.
  if (during !== null) {
    await page.waitForTimeout(280);
    during.midOpacity = await chip.evaluate(element => [...element.querySelectorAll('.person-portrait-layer')].map(layer => Number(getComputedStyle(layer).opacity).toFixed(2))).catch(() => null);
    await shot(page, 'u12-aging-crossfade.jpg', await around(chip, 30));
  }
  await page.getByRole('button', { name: '일시 정지', exact: true }).click().catch(() => undefined);
  await page.waitForTimeout(900);
  const after = await chip.locator('.person-portrait').getAttribute('data-portrait').catch(() => null);
  const layersAfter = await chip.locator('.person-portrait-layer').count().catch(() => null);
  await shot(page, 'u13-aging-after.jpg', await around(page.locator('.diagnostic-card'), 20));
  result.gates.aging = { moment: moments['aging-eve'], before, during, after, layersAfter, waitedMs: Date.now() - started, crossfaded: during !== null && before !== after && layersAfter === 1 };
  await context.close();
} catch (error) { result.errors.push(`aging section: ${String(error)}`); }

// ① The steward's bubble with the name: a new campaign with the tutorial on (the steward's greeting), the bubble opened.
try {
  // A fresh profile from the welcome, as the tutorial replay starts (openScene would dismiss the welcome first).
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => result.errors.push(`bubble: ${String(error)}`));
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto(`${url}?phase10-proof=1`);
  await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
  await page.locator('.welcome-parchment [data-scenario]').first().click();
  await page.locator('.steward-advisor').waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: '1배속', exact: true }).click().catch(() => undefined);
  await page.waitForTimeout(1_200);
  await page.locator('[data-dock="steward"]').click();
  await page.locator('.steward-name').waitFor({ timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  const bubble = await page.evaluate(() => ({ name: document.querySelector('.steward-name')?.textContent ?? null, label: document.querySelector('.steward-advisor')?.getAttribute('aria-label') ?? null,
    dock: document.querySelector('[data-dock="steward"]')?.getAttribute('aria-label') ?? null, line: document.querySelector('.steward-advisor .steward-line')?.textContent ?? null,
    face: getComputedStyle(document.querySelector('.action-dock-portrait')).backgroundImage.includes('advisor_steward_portrait') }));
  const dock = await page.locator('.steward-advisor').boundingBox();
  await shot(page, 'u14-steward-bubble.jpg', dock === null ? undefined : { x: Math.max(0, dock.x - 40), y: Math.max(0, dock.y - 40), width: Math.min(1280 - Math.max(0, dock.x - 40), dock.width + 360), height: Math.min(800 - Math.max(0, dock.y - 40), dock.height + 240) });
  result.gates.bubble = bubble;
  await context.close();
} catch (error) { result.errors.push(`bubble section: ${String(error)}`); }

// + A touch tablet: the famine modal's chip and the steward's card.
try {
  const state = load('famine-arrival');
  const { context, page } = await open('tablet', 'famine-arrival', chapel(state), { width: 1180, height: 820, hasTouch: true, isMobile: true });
  await page.locator('.famine-decision').waitFor({ timeout: 15_000 });
  await page.locator('.decision-steward .person-chip').tap();
  await cardFacts(page);
  await shot(page, 'u15-tablet-steward-card.jpg');
  result.gates.tablet = await page.evaluate(() => {
    const scope = [...document.querySelectorAll('.person-card button, .decision-steward button')];
    const small = scope.filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && (box.height < 48 || box.width < 48); })
      .map(element => `${element.className} ${Math.round(element.getBoundingClientRect().width)}x${Math.round(element.getBoundingClientRect().height)}`);
    const text = [...document.querySelectorAll('.person-card *, .decision-steward *')].filter(element => [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim() !== ''))
      .map(element => ({ size: parseFloat(getComputedStyle(element).fontSize), text: element.textContent.slice(0, 20) })).filter(entry => entry.size < 12);
    return { coarse: matchMedia('(pointer: coarse)').matches, targets: scope.length, targetsUnder48: small, textUnder12: text };
  });
  await context.close();
} catch (error) { result.errors.push(`tablet section: ${String(error)}`); }

await browser.close();
const shown = Object.values(result.shown);
result.gates.shownMatch = { people: shown.length, exact: shown.filter(entry => entry.exact).length, percent: shown.length === 0 ? null : Math.floor(shown.filter(entry => entry.exact).length / shown.length * 1000) / 10 };
writeFileSync(join(out, 'captures.json'), `${JSON.stringify(result, null, 1)}\n`);
console.log(JSON.stringify({ errors: result.errors.length, shownMatch: result.gates.shownMatch, determinism: result.gates.determinism?.sameAcrossLoads, merchant: result.gates.merchant?.sameAcrossLoads,
  aging: result.gates.aging?.crossfaded, time: result.gates.merchant?.timeStopped, compose: result.gates.compose }));
