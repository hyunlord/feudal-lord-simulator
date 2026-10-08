// PLAY-2 (Astra's second lord-mode play, the screen's part) in the browser, on the DGX, at 1280 × 800 (JPEG, the whole
// view unless said), each on a real scene:
//  - ledger-claim: the lord's claim in 약속·소송 (lmr2 states) — the file-suit button with its cost, the hearing's two
//    sides; every lmr2 state is read for whether its claim shows them (the geometry rows' `requires`);
//  - famine-lord: the Great Famine answered by the lord bot (scripts/play2States.ts) — its chip's card: the bottleneck
//    left and the next lever, then its [조언];
//  - famine-campaign: chapter 1's famine (ui5 famine-arrival) answered on screen (방관) — the card's bottleneck line (the
//    geometry row's path);
//  - year-chronicle: 1300's year card (deccard2 year-loaded) → [연대기에서 보기]: the chronicle on 1300 only;
//  - chronicle-titles: the chronicle's decisions (play2 chronicle-cards) — a card answer's line names the event and
//    the answer (the lines the states script expects);
//  - time-cluster: the speed seals at 1×, 5× and 10× (a crop) and the time cluster's box on this tree and on the base
//    commit (BASE_URL), at 1280 × 800 and the tablet (1180 × 820, touch).
// Each: its smallest text (≥ 12 px), its box inside the view, no title=. results.json beside them.
//   scripts/remote/run.sh render-PLAY2-captures-<sha7> --light -- bash scripts/play2Captures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/play2Captures.mjs)", { remote: "scripts/remote/run.sh render-PLAY2-captures-<sha7> --light -- bash scripts/play2Captures.sh", entry: import.meta.url });
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const base = flags.base ?? null;
const sceneAt = (dir, name) => { const path = join(dir, `${name}.json`); return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null; };
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
const QUALITY = 50;
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const open = (state, options = {}) => openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  query: '&story-delay=600000', loadTimeout: 90_000, zoom: 1.1, ...options });
const visible = (page, selector) => page.locator(`${selector} >> visible=true`).count().then(count => count > 0);
const waitFor = (page, selector, timeout) => page.locator(`${selector} >> visible=true`).first().waitFor({ timeout }).then(() => true, () => false);
const click = (page, selector) => page.locator(`${selector} >> visible=true`).first().click({ timeout: 10_000 }).then(() => true, () => false);
/** The surface as shown: its text, its smallest text, its box and its buttons. */
const measure = (page, selector) => page.evaluate(sel => {
  const root = [...document.querySelectorAll(sel)].find(el => el.getBoundingClientRect().width > 0) ?? null;
  if (root === null) return null;
  const box = root.getBoundingClientRect();
  const texts = [...root.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== ''));
  return { text: root.innerText.slice(0, 1600), buttons: [...root.querySelectorAll('button')].map(button => button.textContent).slice(0, 12),
    smallestText: texts.length === 0 ? null : Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))), titles: root.querySelectorAll('[title]').length,
    box: { left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height), right: Math.round(box.right), bottom: Math.round(box.bottom),
      inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight } };
}, selector);
const shoot = async (page, name, clip) => { const path = join(out, `${name}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: QUALITY, ...(clip ? { clip } : {}) }); return statSync(path).size; };
const ok = row => row.card !== null && row.card !== undefined && (row.card.smallestText ?? 12) >= 12 && row.card.box.inside && row.card.titles === 0;
const rows = {}; let bytes = 0; const errors = [];
const report = (name, row, extra = true) => { row.pass = ok(row) && extra; rows[name] = row; console.log(`${row.pass ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify(row)}`); };
const watch = (page, name) => page.on('pageerror', error => errors.push(`${name}: ${String(error).slice(0, 300)}`));
const OPEN_LORD_LEDGER = ["[data-dock='ledger']", "[data-ledger-tab='lord']", "[data-lord-open]", "[data-lord-nav='ledger']"];

// 1. The lord's claim: the file-suit button with its cost and the hearing's two sides (every lmr2 state read).
{
  const claims = {};
  for (const name of ['offer-countered', 'promises', 'contested', 'marriage-contracted', 'will-change', 'inherited', 'neighbour-suit']) {
    const state = sceneAt(flags.lord2, name);
    if (state === null) { claims[name] = 'missing'; continue; }
    const { context, page } = await open(state);
    watch(page, `ledger ${name}`);
    for (const selector of OPEN_LORD_LEDGER) { await click(page, selector); await page.waitForTimeout(500); }
    const shown = await waitFor(page, '.lord-ledger-claim', 10_000);
    const claim = shown ? await page.evaluate(() => [...document.querySelectorAll('.lord-ledger-claim')].map(li => ({ button: li.querySelector('.lord-ledger-file')?.textContent ?? null,
      cost: li.querySelector('.lord-ledger-file')?.getAttribute('data-cost') === 'true', disabled: li.querySelector('.lord-ledger-file')?.hasAttribute('disabled') ?? null,
      hearing: li.querySelector('.lord-ledger-claim-hearing')?.textContent ?? null, refusal: li.querySelector('[data-refusal]')?.textContent ?? null }))) : [];
    claims[name] = claim;
    if (rows['ledger-claim'] === undefined && claim.some(entry => entry.cost && entry.hearing !== null)) {
      await page.locator('.lord-ledger-claim >> visible=true').first().scrollIntoViewIfNeeded();
      const row = { state: name, claim, card: await measure(page, '.lord-ledger-claim') };
      row.button = await measure(page, '.lord-ledger-claim .lord-ledger-file');
      row.bytes = await shoot(page, 'ledger-claim'); bytes += row.bytes;
      report('ledger-claim', row, (row.card?.text ?? '').includes('지금 걸면 심리에서') && /소송 걸기 · /.test(row.button?.text ?? ''));
    }
    await context.close();
  }
  if (rows['ledger-claim'] === undefined) report('ledger-claim', { card: null, claims }, false);
  rows['ledger-claims-by-state'] = { claims, pass: true };
  console.log(`claims by state: ${JSON.stringify(claims)}`);
}

// 2. The famine answered by the lord bot: its chip's card (the bottleneck left, the next lever), then its [조언].
{
  const state = sceneAt(flags.states, 'famine-answered');
  if (state === null) report('famine-lord', { card: null, missing: true }, false);
  else {
    const { context, page } = await open(state, { query: '&story-delay=0' });
    watch(page, 'famine-lord');
    const chip = ".event-chip[data-story='famine']";
    const shown = await waitFor(page, chip, 30_000);
    const row = { state: 'famine-answered', chip: shown, card: null };
    if (shown) {
      await click(page, chip);
      await waitFor(page, ".event-card[data-story='famine']", 10_000);
      row.card = await measure(page, ".event-card[data-story='famine']");
      row.bytes = await shoot(page, 'famine-lord'); bytes += row.bytes;
      await click(page, ".event-card[data-story='famine'] .event-card-actions button[aria-pressed]");
      await page.waitForTimeout(400);
      row.advice = await page.locator('.event-card-advice').first().textContent().catch(() => null);
      row.adviceBytes = await shoot(page, 'famine-lord-advice'); bytes += row.adviceBytes;
    }
    report('famine-lord', row, shown && (row.card?.text ?? '').includes('남은 병목') && (row.card?.text ?? '').includes('다음에 바꿀 조건'));
    await context.close();
  }
}

// 3. Chapter 1's famine (campaign) answered on screen: the card's bottleneck line (the geometry row's path).
{
  const state = sceneAt(flags.ui5, 'famine-arrival');
  if (state === null) report('famine-campaign', { card: null, missing: true }, false);
  else {
    const { context, page } = await open(state, { query: '&story-delay=5000', zoom: 1.1 });
    watch(page, 'famine-campaign');
    let modal = await waitFor(page, '.famine-decision', 30_000);
    if (!modal && await click(page, ".event-chip[data-story='famine']")) { await click(page, '.event-card-decide'); modal = await waitFor(page, '.famine-decision', 10_000); }
    const row = { state: 'ui5 famine-arrival', modal, card: null };
    if (modal) {
      await click(page, ".famine-decision [data-choose='laissez_faire']");
      row.chip = await waitFor(page, ".event-chip[data-story='famine']", 30_000);
      if (row.chip) {
        await click(page, ".event-chip[data-story='famine']");
        await waitFor(page, ".event-card[data-story='famine']", 10_000);
        row.card = await measure(page, ".event-card[data-story='famine']");
        row.bytes = await shoot(page, 'famine-campaign'); bytes += row.bytes;
      }
    }
    report('famine-campaign', row, (row.card?.text ?? '').includes('남은 병목') && !(row.card?.text ?? '').includes('다음에 바꿀 조건'));
    await context.close();
  }
}

// 4. 1300's year card → [연대기에서 보기]: the chronicle on that year only.
{
  const state = sceneAt(flags.deccard2, 'year-loaded');
  if (state === null) report('year-chronicle', { card: null, missing: true }, false);
  else {
    const { context, page } = await open(state, { query: '&story-delay=20000' });
    watch(page, 'year-chronicle');
    const opened = await waitFor(page, '.results-card.year-review', 60_000);
    const row = { state: 'deccard2 year-loaded', opened, card: null };
    if (opened) {
      row.year = await page.locator('.results-card.year-review').first().getAttribute('data-year-review');
      await click(page, '.results-card.year-review .results-card-chronicle');
      row.chronicle = await waitFor(page, '.chronicle-screen', 20_000);
      await page.waitForTimeout(900);
      const screen = page.locator('.chronicle-screen').first();
      row.from = await screen.getAttribute('data-from-year'); row.to = await screen.getAttribute('data-to-year');
      row.records = await screen.getAttribute('data-records');
      row.dates = await page.evaluate(() => [...document.querySelectorAll('.chronicle-card-date')].map(el => el.textContent));
      row.card = await measure(page, '.chronicle-screen');
      row.bytes = await shoot(page, 'year-chronicle'); bytes += row.bytes;
      // Closing the chronicle goes back to the year card.
      await click(page, '.chronicle-close'); await page.waitForTimeout(600);
      row.backToCard = await visible(page, '.results-card.year-review');
    }
    const inYear = (row.dates ?? []).length > 0 && row.dates.every(date => date.startsWith(`${row.year}년`));
    report('year-chronicle', row, opened && row.from === row.year && row.to === row.year && inYear && row.backToCard === true);
    await context.close();
  }
}

// 5. The chronicle's decisions: a card answer's line names the event and the answer.
{
  const state = sceneAt(flags.states, 'chronicle-cards');
  const expected = (() => { try { return JSON.parse(readFileSync(join(flags.states, 'play2-states.json'), 'utf8'))['chronicle-cards']?.lines ?? []; } catch { return []; } })();
  if (state === null) report('chronicle-titles', { card: null, missing: true }, false);
  else {
    const { context, page } = await open(state);
    watch(page, 'chronicle-titles');
    await click(page, "[data-dock='ledger']"); await click(page, '.ledger-tab--chronicle');
    const shown = await waitFor(page, '.chronicle-screen', 20_000);
    const row = { state: 'chronicle-cards', shown, card: null };
    if (shown) {
      await page.waitForTimeout(900);
      for (let turn = 0; turn < 8; turn += 1) {
        const other = page.locator(".chronicle-kind[aria-pressed='true']:not([data-kind='decision'])");
        if (await other.count() === 0) break;
        await other.first().click(); await page.waitForTimeout(300);
      }
      await page.waitForTimeout(600);
      row.lines = await page.evaluate(() => [...document.querySelectorAll('.chronicle-card-line')].map(el => el.textContent));
      row.matched = row.lines.filter(line => expected.some(entry => entry.line === line));
      row.card = await measure(page, '.chronicle-list');
      row.bytes = await shoot(page, 'chronicle-titles'); bytes += row.bytes;
    }
    report('chronicle-titles', row, shown && (row.matched ?? []).length > 0 && !(row.lines ?? []).includes('사건에 답했다'));
    await context.close();
  }
}

// 6. The time cluster: the fast seal's mark at 1×, 5×, 10× (a crop), and its box here and on the base commit.
{
  const state = sceneAt(flags.ui5, 'merchant-town');
  const boxes = {};
  for (const [label, at] of [['this', url], ...(base === null ? [] : [['base', base]])]) {
    for (const [viewport, size] of [['1280x800', { width: 1280, height: 800 }], ['tablet-1180x820', { width: 1180, height: 820, hasTouch: true }]]) {
      const { context, page } = await open(state, { baseUrl: at, zoom: 1.4, ...size });
      watch(page, `time ${label} ${viewport}`);
      await waitFor(page, '.hud-time-cluster', 20_000);
      const box = await measure(page, '.hud-time-cluster');
      boxes[`${label} ${viewport}`] = box?.box ?? null;
      if (label === 'this' && viewport === '1280x800') {
        const clip = box === null ? undefined : { x: Math.max(0, box.box.left - 8), y: Math.max(0, box.box.top - 8), width: box.box.width + 16, height: box.box.height + 16 };
        const marks = {};
        for (const [speed, key] of [['1', 'Digit1'], ['5', 'Digit5'], ['10', 'Digit0']]) {
          if (speed !== '1') { await page.keyboard.press(key); await page.waitForTimeout(400); }
          marks[speed] = await page.evaluate(() => ({ mark: document.querySelector("[data-seal='fast'] .speed-seal-mark")?.textContent ?? null,
            on: document.querySelector("[data-seal='fast'] .speed-seal-step[data-on='true']")?.textContent ?? null,
            label: document.querySelector("[data-seal='fast']")?.getAttribute('aria-label') ?? null,
            smallest: Math.min(...[...document.querySelectorAll("[data-seal='fast'] .speed-seal-step")].map(el => parseFloat(getComputedStyle(el).fontSize))),
            seal: (() => { const r = document.querySelector("[data-seal='fast']")?.getBoundingClientRect(); return r === undefined ? null : { width: Math.round(r.width), height: Math.round(r.height) }; })() }));
          bytes += await shoot(page, `time-cluster-x${speed}`, clip);
        }
        boxes.marks = marks;
        rows['time-cluster'] = { card: box, marks };
      }
      await context.close();
    }
  }
  const row = rows['time-cluster'] ?? { card: null };
  row.boxes = boxes;
  const same = base === null ? null : ['1280x800', 'tablet-1180x820'].every(viewport => {
    const here = boxes[`this ${viewport}`], there = boxes[`base ${viewport}`];
    return here !== null && there !== null && here.width === there.width && here.height === there.height;
  });
  row.sameBox = same;
  const marks = row.marks ?? {};
  report('time-cluster', row, same !== false && marks['1']?.mark === '×5·10' && marks['5']?.on === '×5' && marks['10']?.on === '10' && marks['1']?.smallest >= 12);
}

await browser.close();
writeFileSync(join(out, 'results.json'), JSON.stringify({ rows, bytes, errors }, null, 1));
if (errors.length > 0) console.log(`page errors: ${errors.join(' | ')}`);
const failed = Object.entries(rows).filter(([, row]) => !row.pass).map(([name]) => name);
console.log(`captures ${Object.keys(rows).length}, ${Math.round(bytes / 1024)} KB${failed.length === 0 ? '' : `; BAD ${failed.join(', ')}`}`);
process.exit(failed.length === 0 ? 0 : 1);
