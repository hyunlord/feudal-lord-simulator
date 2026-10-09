// DEC-CARD-2 (steward) in the browser, on the DGX, at 1280 × 800 (JPEG, the whole view): "I know why I choose this,
// and after choosing I know what changed" for the steward's side, on scripts/deccard2StewardStates.ts's `season-eve`:
//  - season-steward: the town run at 3× over the season's close — the season card's "청지기가 처리한 일", its first
//    matter's drill-in open (what it was, the policy used, the result);
//  - policy-kind: the drill-in's [이 종류의 방침을 정한다] → the lord screen's 상시 방침 on that kind (the four settings,
//    what each does); a press on another setting moves the pressed one (the engine kept it: the scene's proof port);
//  - policy-screen: the same screen from its top (the families, 모든 장원 청원을 영주에게);
//  - treasury: the coin cell → the stock tab's treasury by estate (treasuryBreakdown's estates, kinds, settled).
// Each: its smallest text (≥ 12 px), its box inside the view, its primaries (the season card one, the lord screen none).
//   scripts/remote/run.sh render-DC2-steward-captures-<sha7> --light -- bash scripts/deccard2StewardCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/deccard2StewardCaptures.mjs)", { remote: "scripts/remote/run.sh render-DC2-steward-captures-<sha7> --light -- bash scripts/deccard2StewardCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const state = JSON.parse(readFileSync(join(flags.states, 'season-eve.json'), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seat = (() => { const building = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [building.tx, building.ty]; })();
const QUALITY = 50;
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const open = (options = {}) => openScene(browser, { state, tile: seat, baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  query: '&story-delay=600000', loadTimeout: 90_000, zoom: 1.1, ...options });
const measure = (page, selector) => page.evaluate(sel => {
  const root = document.querySelector(sel);
  if (root === null) return null;
  const box = root.getBoundingClientRect();
  const texts = [...root.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== '') && el.getBoundingClientRect().height > 0);
  return { text: root.innerText.slice(0, 1600), primary: root.querySelectorAll('.ui-btn--primary').length,
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight } };
}, selector);
const shoot = async (page, name) => { const path = join(out, `${name}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: QUALITY }); return statSync(path).size; };
const ok = (row, primaries) => row.card !== null && row.card.smallestText >= 12 && row.card.box.inside && row.card.primary === primaries;
const rows = {}; let bytes = 0; const errors = [];
const report = (name, row, primaries, extra = true) => { row.pass = ok(row, primaries) && extra; rows[name] = row; console.log(`${row.pass ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify({ ...row, card: row.card === null ? null : { ...row.card, text: undefined } })}`); };
const standingOf = (page, kind) => page.evaluate(key => window.__FEUDAL_PHASE10_PROOF__?.state?.()?.stewardship?.standing?.[key] ?? null, kind).catch(() => null);

// 1–3. The season card's steward section, its drill-in, the way to the kind's policy, the screen.
{
  // LM-R3 pauseReasons: time runs on to the season's close (the lord-mode auto-pause would stop it).
  const { context, page } = await open({ run: true, query: '&story-delay=600000&auto-pause=off' });
  page.on('pageerror', error => errors.push(String(error).slice(0, 300)));
  await page.keyboard.press('Digit3');
  const opened = await page.locator('.season-ledger-card .season-steward >> visible=true').first().waitFor({ timeout: 120_000 }).then(() => true, () => false);
  const row = { opened, card: null };
  if (opened) {
    await page.locator('.season-steward').scrollIntoViewIfNeeded();
    const summary = page.locator('.season-steward-summary').first();
    row.items = await page.locator('.season-steward-summary').allTextContents();
    if (await summary.count()) { await summary.click(); await page.waitForTimeout(300); await page.locator('.season-steward-item[open] .season-steward-detail').scrollIntoViewIfNeeded(); }
    row.detail = await page.locator('.season-steward-item[open] .season-steward-detail').innerText().catch(() => null);
    row.lines = await page.locator('.season-steward-line').allTextContents();
    row.card = await measure(page, '.season-ledger-card');
    row.bytes = await shoot(page, 'season-steward'); bytes += row.bytes;
  }
  report('season-steward', row, 1, opened && row.items.length > 0 && row.detail !== null);
  // 2. The drill-in's way to the kind's policy.
  const way = page.locator('.season-steward-item[open] .season-steward-policy').first();
  const kind = opened && await way.count() ? await way.getAttribute('data-steward-policy') : null;
  const kindRow = { kind, card: null };
  if (kind !== null) {
    await way.click();
    kindRow.screen = await page.locator(`.lord-screen[data-lord-screen="petitions"] [data-standing-detail="${kind}"] >> visible=true`).first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
    await page.locator(`[data-standing-detail="${kind}"]`).scrollIntoViewIfNeeded().catch(() => undefined);
    kindRow.cardClosed = await page.locator('.season-ledger-card').count() === 0;
    kindRow.detail = await page.locator(`[data-standing-detail="${kind}"]`).innerText().catch(() => null);
    kindRow.card = await measure(page, '.slot-panel.lord-screen');
    kindRow.bytes = await shoot(page, 'policy-kind'); bytes += kindRow.bytes;
    // A press on another setting: the engine keeps it, the pressed button moves.
    const other = page.locator(`[data-standing-detail="${kind}"] .lord-standing-set[aria-pressed="false"]`).first();
    const setting = await other.locator('xpath=..').getAttribute('data-setting');
    kindRow.before = await standingOf(page, kind);
    await other.click(); await page.waitForTimeout(800);
    kindRow.pressed = await page.locator(`[data-standing-detail="${kind}"] .lord-standing-choice[data-setting="${setting}"] .lord-standing-set`).getAttribute('aria-pressed');
    kindRow.after = await standingOf(page, kind);
    kindRow.setting = setting;
  }
  report('policy-kind', kindRow, 0, kindRow.screen === true && kindRow.cardClosed === true && kindRow.pressed === 'true' && kindRow.after === kindRow.setting);
  // 3. The screen from its top.
  const screenRow = { card: null };
  if (kind !== null) {
    await page.locator('.lord-screen-content').evaluate(element => { element.scrollTop = 0; });
    await page.waitForTimeout(300);
    screenRow.families = await page.locator('.lord-standing-family h4').allTextContents();
    screenRow.card = await measure(page, '.slot-panel.lord-screen');
    screenRow.bytes = await shoot(page, 'policy-screen'); bytes += screenRow.bytes;
  }
  report('policy-screen', screenRow, 0, (screenRow.families?.length ?? 0) === 3);
  await context.close();
}

// 4. The treasury by estate (the coin cell → the stock tab).
{
  const { context, page } = await open();
  page.on('pageerror', error => errors.push(String(error).slice(0, 300)));
  await page.locator('.status-pill > .status-pill-cell:nth-of-type(4)').click();
  const opened = await page.locator('.treasury-estates >> visible=true').first().waitFor({ timeout: 30_000 }).then(() => true, () => false);
  const row = { opened, card: null };
  if (opened) {
    await page.locator('.treasury-estates').scrollIntoViewIfNeeded();
    row.lines = await page.locator('.treasury-estates p, .treasury-estates li li').allTextContents();
    row.card = await measure(page, '.slot-panel.ledger-drawer');
    row.bytes = await shoot(page, 'treasury'); bytes += row.bytes;
  }
  report('treasury', row, 0, opened && row.lines.some(line => line.includes('정산')));
  await context.close();
}

await browser.close();
writeFileSync(join(out, 'results.json'), JSON.stringify({ rows, bytes, errors }, null, 1));
if (errors.length > 0) console.log(`page errors: ${errors.join(' | ')}`);
const failed = Object.entries(rows).filter(([, row]) => !row.pass).map(([name]) => name);
console.log(`captures ${Object.keys(rows).length}, ${Math.round(bytes / 1024)} KB${failed.length === 0 ? '' : `; BAD ${failed.join(', ')}`}`);
process.exit(failed.length === 0 ? 0 : 1);
