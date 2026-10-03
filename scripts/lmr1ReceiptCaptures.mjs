// LM-R1 (receipt) captures — the wave35-receipts spec's capture gate (docs/ops/install-plan-20261003/SPECS/wave35-receipts.md)
// and the lord tab: on the states of scripts/lmr1LordStates.ts (lord's slice, stability policy, dues 80%, 10d farmstead
// subsidy), paused, 1280 × 800 DPR 1 unless named:
//  - receipt-runnerup: a town-built building's receipt with its next best site's score (and the 10d subsidy paid);
//  - receipt-subsidy0: a receipt whose project was paid no subsidy (0d written);
//  - receipt-single: a receipt with one candidate site (runnerUp null), when the state run found one;
//  - receipt-old: the same receipt from the old-save state (no chance kept);
//  - receipt-none: an opening well (no receipt: the reason, not an empty frame);
//  - decision-opened: the receipt's first decision ribbon pressed — the chronicle open on that record;
//  - receipt-tablet-dpr2: the receipt at 1180 × 820, DPR 2, by touch;
//  - receipt-art-missing: the frame's picture answered 404 — the plain parchment and every line still there;
//  - policy-tab / policy-refusal: the ledger's lord tab, and a subsidy draft raised until the engine refuses it;
//  - sandbox-card: the seed 1 stone town (ui5 merchant-town, sandbox): a house's card has no why-here button and the
//    ledger no lord tab.
// Each step's facts (texts, attributes, the art's HTTP answers) go to captures.json; a missing fact fails the run.
//   PLAYWRIGHT_MODULE=… node scripts/lmr1ReceiptCaptures.mjs <outDir> --states <lord states dir> --sandbox <ui5 states dir> [--port 4321]
import { refuseHeavyOnMac } from './remote/localGuard.mjs';
refuseHeavyOnMac('브라우저 캡처(scripts/lmr1ReceiptCaptures.mjs)', { remote: 'scripts/remote/run.sh render-LMR1-receipt-<sha7> -- node scripts/lmr1ReceiptCaptures.mjs …', entry: import.meta.url });
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const port = Number(flag('port') ?? process.env.FLS_REMOTE_PORT ?? 4321);
const url = `http://127.0.0.1:${port}/`;
const statesDir = flag('states'); const sandboxDir = flag('sandbox');
if (outDir === undefined || statesDir === undefined || sandboxDir === undefined) throw new Error('usage: lmr1ReceiptCaptures.mjs <outDir> --states <dir> --sandbox <dir>');
const NAME_SHIM = 'globalThis.__name = globalThis.__name || (target => target);';
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = async (dir, name) => JSON.parse(await readFile(join(dir, `${name}.json`), 'utf8'));
const pause = ms => new Promise(done => setTimeout(done, ms));

const vite = spawn('node_modules/.bin/vite', ['--config', 'scripts/remote/viteNoWatch.config.ts', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const stopVite = () => { try { vite.kill('SIGTERM'); } catch { /* gone */ } };
process.on('exit', stopVite);
for (let tries = 0; tries < 90; tries += 1) { try { if ((await fetch(url)).ok) break; } catch { /* not up */ } await pause(1000); }

const moments = JSON.parse(await readFile(join(statesDir, 'moments-lord.json'), 'utf8'));
const lord = await load(statesDir, 'lord-receipts');
const old = await load(statesDir, 'lord-receipts-old');
const sandbox = await load(sandboxDir, 'merchant-town');
await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
const failures = [];
const expect = (name, ok, what) => { if (!ok) failures.push(`${name}: ${what}`); };

async function scene(state, at, { width = 1280, height = 800, dpr = 1, touch = false, block = null, zoom = 1.4 } = {}) {
  const opened = await openScene(browser, { state, tile: [at.tx, at.ty], baseUrl: url, width, height, dpr, zoom, run: false, hasTouch: touch,
    loadTimeout: 120_000, initScript: `${NAME_SHIM}${TUTORIAL_OFF}`, query: '&story-delay=600000' });
  const art = [];
  opened.page.on('response', response => { if (response.url().includes('wave35-receipts')) art.push([response.url().replace(/^.*assets\//, ''), response.status()]); });
  if (block !== null) await opened.page.route(`**/${block}`, route => route.fulfill({ status: 404, body: '' }));
  return { ...opened, art };
}
async function select(page, at, touch = false) {
  const point = await page.evaluate(tile => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: at.tx, ty: at.ty });
  if (touch) await page.touchscreen.tap(point.clientX, point.clientY); else await page.mouse.click(point.clientX, point.clientY);
  await page.locator('.diagnostic-card').first().waitFor({ timeout: 10_000 });
  await pause(600);
}
async function openReceipt(page, touch = false) {
  const button = page.locator('.lord-why-here').first();
  if (touch) await button.tap(); else await button.click();
  await page.locator('.lord-receipt').first().waitFor({ timeout: 10_000 });
  await pause(700);
}
async function shot(page, name, selectors, quality = 55) {
  const boxes = (await Promise.all(selectors.map(selector => page.locator(selector).first().boundingBox()))).filter(box => box !== null);
  const viewport = page.viewportSize();
  const left = Math.max(0, Math.floor(Math.min(...boxes.map(box => box.x)) - 8)), top = Math.max(0, Math.floor(Math.min(...boxes.map(box => box.y)) - 8));
  const right = Math.min(viewport.width, Math.ceil(Math.max(...boxes.map(box => box.x + box.width)) + 8)), bottom = Math.min(viewport.height, Math.ceil(Math.max(...boxes.map(box => box.y + box.height)) + 8));
  const file = `${name}.jpg`;
  await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality, clip: { x: left, y: top, width: right - left, height: bottom - top } }));
  return file;
}
const facts = page => page.evaluate(() => {
  const receipt = document.querySelector('.lord-receipt');
  const text = selector => [...(receipt?.querySelectorAll(selector) ?? [])].map(node => node.textContent ?? '');
  return { kind: receipt?.getAttribute('data-receipt') ?? null, values: text('.lord-receipt-value'), lines: text('.lord-receipt-lines li'),
    runnerUp: receipt?.querySelector('[data-runner-up]')?.getAttribute('data-runner-up') ?? null,
    chance: receipt?.querySelector('[data-chance]')?.getAttribute('data-chance') ?? null, foot: text('.lord-receipt-foot')[0] ?? null,
    subsidy: receipt?.querySelector('.lord-receipt-foot')?.getAttribute('data-subsidy') ?? null,
    ribbons: [...(receipt?.querySelectorAll('.lord-receipt-ribbon') ?? [])].map(node => node.getAttribute('data-record')), none: text('.lord-receipt-none')[0] ?? null,
    frame: receipt === null ? null : getComputedStyle(receipt.querySelector('.lord-receipt-frame')).borderImageSource };
});

async function receiptView(name, state, at, extra = {}) {
  const { context, page, art } = await scene(state, at, extra);
  await select(page, at, extra.touch === true); await openReceipt(page, extra.touch === true);
  const seen = await facts(page);
  const file = await shot(page, name, ['.lord-receipt', '.diagnostic-card'], extra.dpr === 2 ? 45 : 55);
  rows.push({ name, file, target: at, viewport: `${extra.width ?? 1280}x${extra.height ?? 800}`, dpr: extra.dpr ?? 1, ...seen, art });
  return { context, page, seen };
}

// 1. The receipt with the next best site (the subsidised farmstead), then its first decision opened.
{
  const { context, page, seen } = await receiptView('receipt-runnerup', lord, moments.subsidised);
  expect('receipt-runnerup', seen.kind === 'receipt' && seen.runnerUp !== 'none' && seen.chance === 'known' && seen.ribbons.length > 0, JSON.stringify(seen));
  expect('receipt-runnerup', seen.subsidy === 'paid', `subsidy paid: ${seen.foot}`);
  await page.locator('.lord-receipt-ribbon').first().click();
  await page.locator('.chronicle-screen').first().waitFor({ timeout: 15_000 }); await pause(1200);
  const record = seen.ribbons[0];
  const picked = await page.evaluate(id => ({ detail: document.querySelector('.chronicle-detail-body')?.getAttribute('data-detail') ?? null,
    line: document.querySelector('.chronicle-detail-line')?.textContent ?? null }), record);
  expect('decision-opened', picked.detail === record, `chronicle detail ${picked.detail}, ribbon ${record}`);
  const file = await shot(page, 'decision-opened', ['.chronicle-screen'], 45);
  rows.push({ name: 'decision-opened', file, record, ...picked });
  await context.close();
}
// 2. A receipt paid no subsidy.
{ const { context, seen } = await receiptView('receipt-subsidy0', lord, moments.unsubsidised);
  expect('receipt-subsidy0', seen.kind === 'receipt' && seen.subsidy === 'none', `foot ${seen.foot}`); await context.close(); }
// 3. One candidate site (when the state run found one).
if (moments.single !== null) { const { context, seen } = await receiptView('receipt-single', lord, moments.single);
  expect('receipt-single', seen.runnerUp === 'none', `runnerUp ${seen.runnerUp}`); await context.close(); }
else rows.push({ name: 'receipt-single', file: null, note: 'scripts/lmr1LordStates.ts found no single-site receipt in its run (tests/lmr1Receipt.test.ts covers the line)' });
// 4. The old save: no chance kept.
{ const { context, seen } = await receiptView('receipt-old', old, moments.subsidised);
  expect('receipt-old', seen.chance === 'none', `chance ${seen.chance}`); await context.close(); }
// 5. No receipt: the opening well.
if (moments.opening !== null) { const { context, seen } = await receiptView('receipt-none', lord, moments.opening);
  expect('receipt-none', seen.kind === 'none' && (seen.none ?? '').length > 0, JSON.stringify(seen)); await context.close(); }
// 6. Tablet, DPR 2, by touch.
{ const { context, seen } = await receiptView('receipt-tablet-dpr2', lord, moments.subsidised, { width: 1180, height: 820, dpr: 2, touch: true });
  expect('receipt-tablet-dpr2', seen.kind === 'receipt', JSON.stringify(seen)); await context.close(); }
// 7. The frame's picture missing: the parchment and the lines stay.
{ const { context, seen } = await receiptView('receipt-art-missing', lord, moments.subsidised, { block: 'wave35-receipts/E_receipts/receipt_frame.png' });
  expect('receipt-art-missing', seen.kind === 'receipt' && seen.values.length > 0, JSON.stringify(seen)); await context.close(); }
// 8. The lord tab and the refusal.
{
  const { context, page } = await scene(lord, moments.subsidised);
  await page.locator("[data-dock='ledger']").click(); await page.locator("[data-ledger-tab='lord']").click(); await pause(600);
  const tab = await page.evaluate(() => ({ chosen: document.querySelector('.lord-policy-option[aria-pressed="true"]')?.getAttribute('data-policy') ?? null,
    subsidies: [...document.querySelectorAll('.lord-policy-withdraw')].map(node => node.getAttribute('data-withdraw')),
    dues: document.querySelector('[data-dues-permille]')?.getAttribute('data-dues-permille') ?? null,
    natives: document.querySelectorAll('.lord-policy input, .lord-policy select').length }));
  expect('policy-tab', tab.chosen === 'stability' && tab.subsidies.includes('farmstead') && tab.dues === '800' && tab.natives === 0, JSON.stringify(tab));
  rows.push({ name: 'policy-tab', file: await shot(page, 'policy-tab', ['.ledger-drawer']), ...tab });
  for (let press = 0; press < 15 && await page.locator(".lord-policy-refusal[data-refused='true']").count() === 0; press += 1) {
    await page.locator("[data-step='more']").click(); await pause(150);
  }
  const refusal = await page.evaluate(() => ({ text: document.querySelector(".lord-policy-refusal[data-refused='true']")?.textContent ?? null,
    setDisabled: document.querySelector('.lord-policy-set')?.hasAttribute('disabled') ?? null, amount: document.querySelector('[data-amount]')?.getAttribute('data-amount') ?? null }));
  expect('policy-refusal', refusal.text !== null && refusal.setDisabled === true, JSON.stringify(refusal));
  await page.locator('.lord-policy-refusal').first().scrollIntoViewIfNeeded().catch(() => undefined); await pause(200);
  rows.push({ name: 'policy-refusal', file: await shot(page, 'policy-refusal', ['.ledger-drawer']), ...refusal });
  // A policy pressed is the engine's command: the pressed toggle follows the state.
  await page.locator(".lord-policy-option[data-policy='growth']").click(); await pause(500);
  const pressed = await page.evaluate(() => document.querySelector('.lord-policy-option[aria-pressed="true"]')?.getAttribute('data-policy') ?? null);
  expect('policy-set', pressed === 'growth', `pressed ${pressed}`);
  rows.push({ name: 'policy-set', file: null, pressed });
  await context.close();
}
// 9. The sandbox: no button, no tab.
try {
  // As the audit's map.selection.house: the camera on the first house at zoom 1.6, that house clicked.
  const house = sandbox.buildings.find(building => building.kind === 'house');
  const { context, page } = await scene(sandbox, house, { zoom: 1.6 });
  await select(page, house).catch(async error => { await writeFile(join(outDir, 'sandbox-debug.jpg'), await page.screenshot({ type: 'jpeg', quality: 40 })); throw error; });
  const card = await page.evaluate(() => ({ button: document.querySelectorAll('.lord-why-here').length }));
  await page.locator("[data-dock='ledger']").click(); await pause(500);
  const tab = await page.locator("[data-ledger-tab='lord']").count();
  expect('sandbox-card', card.button === 0 && tab === 0, `button ${card.button}, tab ${tab}`);
  rows.push({ name: 'sandbox-card', file: await shot(page, 'sandbox-card', ['.diagnostic-card', '.ledger-drawer'], 45), button: card.button, lordTab: tab });
  await context.close();
} catch (error) { failures.push(`sandbox-card: ${String(error).slice(0, 200)}`); }
await browser.close();
stopVite();
await writeFile(join(outDir, 'captures.json'), JSON.stringify({ states: { tick: moments.tick, year: moments.year, treasury: moments.treasury, subsidyLimit: moments.subsidyLimit }, rows, failures }, null, 1) + '\n');
console.log(rows.map(row => row.file).filter(Boolean).join(' '));
if (failures.length > 0) { console.error(failures.join('\n')); process.exitCode = 1; }
