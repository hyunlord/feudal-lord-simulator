// SUIT-THREAD (renderer A's "suit-rest" part) in the browser, on the DGX, at 1280 × 800 (JPEG, the whole view), each on
// a real scene (the lmr2 states and scripts/suitRestStates.ts):
//  - will-chip → will-page → will-card: the will's chip (the engine's deadline as a season) → its button opens the lord
//    screen's 혼인 page (the deadline, [결정하기]) → the will's card (its deadline line);
//  - will-lapsed: the 혼인 page after the will's deadline passed unanswered ("기한이 지나 그대로 두었다");
//  - suit-chip → suit-ledger: a neighbour's suit against the lord as its chip → [소송 보기] opens 약속·소송 on it;
//  - entry-chip → entry-ledger: a forcible entry forewarned (suit-ledger's lord2 suit-entry-threat) the same way;
//  - kin-household → kin-biography: Astra's 1306 save — the rights register's 영주의 가솔 ("영주의 사촌의 아들"), the
//    child's biography (its father and mother);
//  - standing: the 상시 방침 screen's note on the lasting tax rates;
//  - prepared-chronicle: the chronicle's dearth arrival headed "○○년 결정이 남긴 대비"; prepared-dearth: the bad
//    harvest's chip with "그때 이 결정이 남긴 대비" (when the states script found one).
// Each: its smallest text (≥ 12 px), its box inside the view, no title=. results.json beside them.
//   scripts/remote/run.sh render-SUIT-rest-captures-<sha7> --light -- bash scripts/suitRestCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/suitRestCaptures.mjs)", { remote: "scripts/remote/run.sh render-SUIT-rest-captures-<sha7> --light -- bash scripts/suitRestCaptures.sh", entry: import.meta.url });
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const sceneAt = (dir, name) => { const path = join(dir, `${name}.json`); return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null; };
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
const QUALITY = 50;
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const open = (state, options = {}) => openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  query: '&story-delay=600000', loadTimeout: 90_000, zoom: 1.1, ...options });
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
      inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1 } };
}, selector);
const shoot = async (page, name) => { const path = join(out, `${name}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: QUALITY }); return statSync(path).size; };
const ok = row => row.card !== null && row.card !== undefined && (row.card.smallestText ?? 12) >= 12 && row.card.box.inside && row.card.titles === 0;
const rows = {}; const errors = [];
const report = (name, row, extra = true) => { row.pass = ok(row) && extra; rows[name] = row; console.log(`${row.pass ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify(row)}`); };
const watch = (page, name) => page.on('pageerror', error => errors.push(`${name}: ${String(error).slice(0, 300)}`));
const capture = async (page, name, selector, extra) => { const row = { card: await measure(page, selector) }; row.bytes = await shoot(page, name); report(name, row, extra(row.card?.text ?? '')); return row; };
const OPEN_LORD = ["[data-dock='ledger']", "[data-ledger-tab='lord']", "[data-lord-open]"];
const LORD_SCREEN = '.slot-panel.lord-screen';
const SEASON = /\d{4}년 (봄|여름|가을|겨울)/;
const missing = name => report(name, { card: null, missing: true }, false);

// 1. The will: its chip, the 혼인 page it opens, the will's card from there.
{
  const state = sceneAt(flags.lord2, 'will-change');
  if (state === null) missing('will-chip');
  else {
    const { context, page } = await open(state, { query: '&story-delay=3000' });
    watch(page, 'will');
    const chip = ".event-chip[data-chip-id^='marriage-decision:will_change:']";
    if (await waitFor(page, chip, 90_000)) {
      await click(page, chip); await page.waitForTimeout(600);
      await capture(page, 'will-chip', ".event-card[data-chip-id^='marriage-decision:will_change:']", text => SEASON.test(text) && text.includes('혼인 화면에서 답하기'));
      await click(page, ".event-card[data-chip-id^='marriage-decision:will_change:'] .event-card-decide");
      const shown = await waitFor(page, `${LORD_SCREEN} .lord-neg-due`, 20_000); await page.waitForTimeout(600);
      await capture(page, 'will-page', LORD_SCREEN, text => shown && SEASON.test(text));
      rows['will-page'].decide = await waitFor(page, ".lord-decide[data-decide='marriage_decision']", 5_000);
      if (await click(page, ".lord-decide[data-decide='marriage_decision']")) {
        await waitFor(page, ".lord-card[data-lord-decision='will_change']", 20_000); await page.waitForTimeout(600);
        await capture(page, 'will-card', ".lord-card[data-lord-decision='will_change']", text => /\d{4}년 (봄|여름|가을|겨울)까지 답해야 합니다/.test(text));
      } else missing('will-card');
    } else missing('will-chip');
    await context.close();
  }
}

// 2. The will let lapse: the 혼인 page's timeline.
{
  const state = sceneAt(flags.states, 'will-lapsed');
  if (state === null) missing('will-lapsed');
  else {
    const { context, page } = await open(state);
    watch(page, 'will-lapsed');
    for (const selector of OPEN_LORD) { await click(page, selector); await page.waitForTimeout(500); }
    await click(page, "[data-lord-nav='marriage']"); await page.waitForTimeout(800);
    await capture(page, 'will-lapsed', LORD_SCREEN, text => text.includes('기한이 지나 그대로 두었다'));
    await context.close();
  }
}

// 3. A suit against the lord: its chip, then 약속·소송 on it.
{
  const state = sceneAt(flags.lord2, 'neighbour-suit');
  if (state === null) missing('suit-chip');
  else {
    const { context, page } = await open(state, { query: '&story-delay=3000' });
    watch(page, 'suit');
    const chip = ".event-chip[data-chip-id^='suit-defence:']";
    if (await waitFor(page, chip, 90_000)) {
      await click(page, chip); await page.waitForTimeout(600);
      await capture(page, 'suit-chip', ".event-card[data-chip-id^='suit-defence:']", text => text.includes('영주를 상대로') && text.includes('소송 보기'));
      await click(page, ".event-card[data-chip-id^='suit-defence:'] .event-card-decide");
      const focused = await waitFor(page, `${LORD_SCREEN} [data-focused='true']`, 20_000); await page.waitForTimeout(600);
      await capture(page, 'suit-ledger', LORD_SCREEN, () => focused);
    } else missing('suit-chip');
    await context.close();
  }
}

// 3b. A forcible entry forewarned (suit-ledger's state, scripts/suitLedgerStates.ts): its chip, then 약속·소송 on it.
{
  const state = sceneAt(flags.lord2, 'suit-entry-threat');
  if (state === null) missing('entry-chip');
  else {
    const { context, page } = await open(state, { query: '&story-delay=3000' });
    watch(page, 'entry');
    const chip = ".event-chip[data-chip-id^='entry-threat:']";
    if (await waitFor(page, chip, 90_000)) {
      await click(page, chip); await page.waitForTimeout(600);
      await capture(page, 'entry-chip', ".event-card[data-chip-id^='entry-threat:']", text => SEASON.test(text) && text.includes('예고 보기'));
      await click(page, ".event-card[data-chip-id^='entry-threat:'] .event-card-decide");
      const shown = await waitFor(page, LORD_SCREEN, 20_000); await page.waitForTimeout(800);
      await capture(page, 'entry-ledger', LORD_SCREEN, () => shown);
    } else missing('entry-chip');
    await context.close();
  }
}

// 4. Astra's 1306 save: the household list and the kin child's biography.
{
  const state = sceneAt(flags.states, 'astra-1306');
  const child = (() => { try { return JSON.parse(readFileSync(join(flags.states, 'suit-rest-states.json'), 'utf8'))['astra-1306']?.child ?? null; } catch { return null; } })();
  if (state === null || child === null) missing('kin-household');
  else {
    const { context, page } = await open(state);
    watch(page, 'kin');
    await click(page, "[data-dock='ledger']"); await click(page, "[data-ledger-tab='rights']"); await page.waitForTimeout(700);
    await click(page, '.ledger-rights-household .person-list-toggle'); await page.waitForTimeout(400);
    await page.locator(`.ledger-rights-household [data-person='${child}']`).first().scrollIntoViewIfNeeded().catch(() => undefined);
    await capture(page, 'kin-household', '.ledger-rights', text => /영주의 사촌의 (아들|딸)/.test(text) && text.includes('영주의 사촌의 아내'));
    if (await click(page, `.ledger-rights-household [data-person='${child}']`)) {
      await waitFor(page, '.person-card', 10_000); await click(page, '.person-card .person-card-action');
      await waitFor(page, '.chronicle-biography', 20_000); await page.waitForTimeout(1_200);
      await capture(page, 'kin-biography', '.chronicle-biography', text => text.includes('아버지 ') && text.includes('어머니 '));
    } else missing('kin-biography');
    await context.close();
  }
}

// 5. The standing policies: the note on the lasting tax rates.
{
  const state = sceneAt(flags.lord2, 'attention-overloaded');
  if (state === null) missing('standing');
  else {
    const { context, page } = await open(state);
    watch(page, 'standing');
    for (const selector of OPEN_LORD) { await click(page, selector); await page.waitForTimeout(500); }
    await click(page, "[data-lord-nav='petitions']"); await page.waitForTimeout(800);
    await capture(page, 'standing', LORD_SCREEN, text => text.includes('지속 세율 변경은 영주에게 옵니다'));
    await context.close();
  }
}

// 6. The dearth an earlier decision prepared for: its chronicle record, and the bad harvest's chip.
for (const name of ['prepared-arrival', 'prepared-dearth']) {
  const state = sceneAt(flags.states, name);
  if (state === null) { rows[name] = { missing: true, pass: name === 'prepared-dearth' ? null : false }; continue; }
  if (name === 'prepared-arrival') {
    const { context, page } = await open(state);
    watch(page, name);
    await click(page, "[data-dock='ledger']"); await click(page, '.ledger-tab--chronicle');
    await waitFor(page, '.chronicle-screen', 20_000); await page.waitForTimeout(900);
    const card = page.locator(".chronicle-card-body[aria-label*='결정이 남긴 대비']").first();
    const found = await card.count() > 0;
    if (found) { await card.scrollIntoViewIfNeeded().catch(() => undefined); await card.click().catch(() => undefined); await page.waitForTimeout(800); }
    await capture(page, 'prepared-chronicle', '.chronicle-screen', text => found && /\d{4}년 결정이 남긴 대비/.test(text) && !/결정 때문에 — 흉년/.test(text));
    await context.close();
  } else {
    const { context, page } = await open(state, { query: '&story-delay=0' });
    watch(page, name);
    const chip = ".event-chip[data-story='bad_harvest']";
    if (await waitFor(page, chip, 30_000)) {
      await click(page, chip); await page.waitForTimeout(600);
      await capture(page, 'prepared-dearth', ".event-card[data-story='bad_harvest']", text => text.includes('그때 이 결정이 남긴 대비'));
    } else missing('prepared-dearth');
    await context.close();
  }
}

await browser.close();
writeFileSync(join(out, 'results.json'), JSON.stringify({ url, rows, errors }, null, 1));
const bad = Object.entries(rows).filter(([, row]) => row.pass === false).map(([name]) => name);
console.log(`errors: ${errors.length}; bad: ${bad.join(', ') || 'none'}`);
process.exit(bad.length > 0 || errors.length > 0 ? 1 : 0);
