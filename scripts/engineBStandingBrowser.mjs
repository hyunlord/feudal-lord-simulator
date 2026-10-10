// DGX-only browser verification; prepared real-handler fixture, not natural-play evidence.
import { refuseHeavyOnMac } from './remote/localGuard.mjs';
refuseHeavyOnMac('EB-INERT standing policy browser QA', { entry: import.meta.url });
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { standingBrowserFixture } from './engineBStandingFixture.ts';
import { seasonStewardView } from '../src/ui/lord/steward/seasonStewardModel.ts';
import { standingPolicyScreen } from '../src/ui/lord/steward/standingPolicyModel.ts';

assert.equal(process.platform, 'linux', 'Use scripts/remote/run.sh on DGX');
const args = process.argv.slice(2), flags = {};
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--url', '--out', '--playwright'].includes(args[i]) && args[i + 1], 'usage: --url URL --out DIR [--playwright MODULE]');
  flags[args[i].slice(2)] = args[i + 1];
}
assert.ok(flags.url && flags.out);
const out = resolve(flags.out);
assert.ok(!existsSync(out) || readdirSync(out).length === 0, 'New output directory required');
mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const artifact = (name, bytes) => { writeFileSync(join(out, name), bytes); return { path: name, bytes: bytes.length, sha256: sha(bytes) }; };
const fixture = standingBrowserFixture();
const result = { functionalPass: false, visualReview: 'pending-human-or-oracle-review',
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }),
  fixture: artifact('standing.save.json.gz', gzipSync(fixture.save, { level: 9 })),
  expectedLoss: fixture.loss, rows: [], errors: [],
  limits: ['Fixture built by real reducer/season/audit handlers; not natural eligibility or 125-year evidence.',
    'Only normal buttons advance time and withdraw policy after codec-validated scene admission.',
    'Screenshots and DOM measurements support visual review; they do not declare a visual verdict.'] };
const INIT = `globalThis.__name = globalThis.__name || (value => value); localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); localStorage.setItem('feudal.seasonLedgerAuto','1');`;
const observed = page => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state());
const visible = async (page, selector) => await page.locator(`${selector}:visible`).count() > 0;
async function dismiss(page) {
  for (let attempt = 0; attempt < 12; attempt++) {
    let closed = false;
    for (const candidate of ['.story-modal-later', '.results-card-continue', '.chronicle-close', '.chronicle-keep']) {
      if (await visible(page, candidate)) { await page.locator(`${candidate}:visible`).first().click(); closed = true; break; }
    }
    if (!closed) return;
    await page.waitForTimeout(150);
  }
  throw new Error('Unexpected repeated blocking dialogs');
}
async function capture(page, target, name) {
  await target.scrollIntoViewIfNeeded();
  const geometry = await target.evaluate(node => {
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height,
      viewport: { width: innerWidth, height: innerHeight }, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
      text: node.innerText, documentOverflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.ok(geometry.width > 0 && geometry.height > 0, `${name}: target has no rendered size`);
  assert.ok(!geometry.documentOverflow, `${name}: document horizontal overflow`);
  return { geometry, screenshot: artifact(`${name}.jpg`, await page.screenshot({ type: 'jpeg', quality: 75 })) };
}
async function scene(browser, state, width) {
  const seat = state.buildings.find(row => row.kind === 'manor_house') ?? state.buildings[0];
  assert.ok(seat);
  const opened = await openScene(browser, { state, tile: [seat.tx, seat.ty], baseUrl: flags.url, run: false,
    width, height: 900, initScript: INIT, query: '&story-delay=600000', loadTimeout: 90000 });
  opened.page.on('pageerror', error => result.errors.push(String(error)));
  return opened;
}
let browser;
try {
  const chromium = await loadChromium(flags.playwright);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [375, 768, 1280]) {
    const row = { width, pass: false };
    result.rows.push(row);
    const first = await scene(browser, fixture.beforeClose, width);
    try {
      await dismiss(first.page);
      await first.page.getByRole('button', { name: '1배속', exact: true }).click();
      await first.page.locator('.season-ledger-card:visible').waitFor({ timeout: 90000 });
      const actual = await observed(first.page);
      const report = first.page.locator('.season-steward');
      const expected = seasonStewardView(actual, fixture.start);
      assert.ok(expected && expected.toleratedLosses.length > 0);
      const reportText = await report.innerText();
      for (const line of expected.toleratedLosses) assert.ok(reportText.includes(line), `Missing actual loss: ${line}`);
      assert.ok(await report.locator(`[data-steward-item="${fixture.auditId}"]`).count() === 1, 'Automatic audit report missing');
      row.report = await capture(first.page, report.locator(`[data-steward-item="${fixture.auditId}"]`), `${width}-report`);
      row.report.text = reportText;
      row.loss = await capture(first.page, report.locator('.season-steward-line').filter({ hasText: '눈감아 준 오류로 이번 철 수입' }).first(), `${width}-season-loss`);
    } catch (error) {
      row.reportFailure = artifact(`${width}-report-failure.jpg`, await first.page.screenshot({ type: 'jpeg', quality: 75 }));
      row.failureText = (await first.page.locator('body').innerText()).slice(0, 10000);
      throw error;
    } finally { await first.context.close(); }
    const second = await scene(browser, fixture.state, width);
    try {
      const page = second.page;
      await dismiss(page);
      await page.locator('[data-dock="ledger"]:visible').click();
      await page.locator('[data-ledger-tab="stock"]:visible').click();
      const debit = page.locator(`[data-tolerance-amount="-${fixture.loss}"]`).first();
      await debit.waitFor();
      assert.ok((await debit.innerText()).includes('눈감아 준 오류로 수입'));
      row.ledger = await capture(page, debit, `${width}-ledger-loss`);
      for (const selector of ['[data-ledger-tab="lord"]', '[data-lord-open]', '[data-lord-nav="petitions"]']) {
        await page.locator(`${selector}:visible`).first().click();
      }
      const policy = page.locator(`.lord-standing-kind[data-kind="${fixture.key}"]`);
      await policy.locator('.lord-standing-open').click();
      const expected = standingPolicyScreen(fixture.state)?.families.flatMap(family => family.kinds).find(item => item.kind === fixture.key);
      assert.ok(expected);
      assert.ok((await policy.innerText()).includes(expected.row));
      assert.equal(await policy.locator('.lord-standing-set').count(), 1, 'Only withdrawal is available');
      row.active = await capture(page, policy.locator('.lord-standing-set'), `${width}-policy-active`);
      const before = await observed(page);
      await policy.locator('.lord-standing-set').click();
      await page.waitForFunction(key => window.__FEUDAL_PHASE10_PROOF__.state().stewardship?.standing?.[key] === 'lord', fixture.key);
      const after = await observed(page);
      assert.equal(after.tick, before.tick, 'Withdrawal unexpectedly advanced time');
      assert.equal(await policy.locator('.lord-standing-set').count(), 0, 'Revoked policy must not offer fake reactivation');
      assert.ok((await policy.innerText()).includes('눈감아 주기를 거둠'));
      row.revoked = await capture(page, policy, `${width}-policy-revoked`);
      row.pass = true;
    } catch (error) {
      row.policyFailure = artifact(`${width}-policy-failure.jpg`, await second.page.screenshot({ type: 'jpeg', quality: 75 }));
      row.failureText = (await second.page.locator('body').innerText()).slice(0, 10000);
      throw error;
    } finally { await second.context.close(); }
  }
  result.functionalPass = result.rows.length === 3 && result.rows.every(row => row.pass) && result.errors.length === 0;
} catch (error) {
  result.errors.push(error instanceof Error ? error.stack : String(error));
} finally {
  if (browser) await browser.close();
  writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify({ functionalPass: result.functionalPass, rows: result.rows.length, errors: result.errors, out }));
if (!result.functionalPass) process.exitCode = 1;
