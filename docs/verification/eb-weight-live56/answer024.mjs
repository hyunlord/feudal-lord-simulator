import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { decodeSave } from '../../../src/save/saveCodec.ts';
import { withResidentWalkers } from '../../../src/render/presentation/residentWalkerState.ts';
import { HOLD_RELATION_DELTA } from '../../../src/content/registry/registryHoldConfig.ts';
import { loadChromium } from '../../../scripts/renderCommitProbe.mjs';
import { routeSceneState, sceneStateRefusal } from '../../../scripts/sceneInjection.mjs';
assert.equal(process.platform, 'linux'); assert.equal(process.env.FLS_REMOTE, '1');
const [input, out, url] = process.argv.slice(2);
assert.ok(input && out && url); mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const product = '0eddc146c7d57b4cae091bff62295a1fc16e1f97';
assert.equal(execFileSync('git', ['diff', product, 'HEAD', '--', 'src', 'package.json', 'package-lock.json'], { encoding: 'utf8' }), '');
const acquisitionBytes = readFileSync(join(input, 'acquisition.json.gz'));
const acquisition = JSON.parse(gunzipSync(acquisitionBytes));
assert.equal(acquisition.product, product); assert.equal(acquisition.found, true); assert.deepEqual(acquisition.errors, []);
const witness = acquisition.offered.find(row => row.entryId === 'ck_evt_024');
assert.ok(witness?.choices.includes('keep'));
const packed = readFileSync(join(input, witness.file)); assert.equal(sha(packed), witness.gzipSha256);
const raw = gunzipSync(packed); assert.equal(sha(raw), witness.encodedSha256);
const admitted = decodeSave(raw).envelope.state;
assert.equal(sha(JSON.stringify(admitted)), witness.stateSha256);
const report = { product, toolRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  acquisitionSha256: sha(acquisitionBytes), witness, entryId: 'ck_evt_024', choice: 'keep', screenshots: [], actions: [], errors: [], valid: false,
  limits: ['Actual UI answer from a genuine normally resumed offer. No state fields invented.',
    'Immediate faction relation effect is checked; conditional later faction acts remain unobserved.',
    'A yearly chip is automatic aggregation; opening its card is manual.'] };
let browser, context, page;
async function state() { return page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state()); }
async function snapshot(label) {
  const s = await state(), json = JSON.stringify(s), file = `${label}.state.json.gz`;
  writeFileSync(join(out, file), gzipSync(json, { level: 9 }));
  await page.screenshot({ path: join(out, `${label}.jpg`), type: 'jpeg', quality: 55 });
  report.screenshots.push({ label, file, sha256: sha(json), image: `${label}.jpg` }); return s;
}
async function press(selector) {
  const el = page.locator(selector); assert.equal(await el.count(), 1); assert.ok(await el.isEnabled());
  const point = await el.evaluate(el => {
    const b = el.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2, top = document.elementFromPoint(x, y);
    return b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight
      && top !== null && (el === top || el.contains(top)) ? { x, y } : null;
  });
  assert.ok(point, `Unavailable/covered control: ${selector}`); await page.mouse.click(point.x, point.y);
  report.actions.push({ selector, tick: (await state()).tick }); await page.clock.runFor(32);
}
async function read(answer) {
  return page.evaluate(async answer => {
    const [{ yearResults }, { RESULTS_COPY }, { traceInRange }] = await Promise.all([
      import('/src/ui/results/yearResults.ts'), import('/src/ui/results/resultsCopy.ko.ts'), import('/src/engine/decisionReads.ts')]);
    const state = window.__FEUDAL_PHASE10_PROOF__.state(), results = yearResults(state), item = results?.items.find(row => row.decisionId === answer) ?? null;
    return { results, item, expectedChip: results ? RESULTS_COPY.trace.yearChip(results.count) : null,
      expectedFact: item ? RESULTS_COPY.trace.yearItem(item.title, item.count) : null,
      rows: traceInRange(state, state.tick - state.tick % 4000, state.tick + 1).filter(row => row.decisionId === answer),
      chips: [...document.querySelectorAll('.event-chip[data-story="decision_trace"]')].map(el => ({ id: el.getAttribute('data-chip-id'), text: el.textContent })) };
  }, answer);
}
try {
  browser = await (await loadChromium()).launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'ko-KR' });
  page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => report.errors.push(String(e)));
  await page.clock.install();
  await context.addInitScript("globalThis.__name ??= target => target; localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));");
  await page.routeWebSocket('**', socket => socket.close()); await routeSceneState(page, raw.toString('utf8'));
  const refused = sceneStateRefusal(page);
  await page.goto(`${url}?phase10-proof=1`, { timeout: 90000 });
  await Promise.race([page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined), refused]);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  if (await page.locator('.welcome-dismiss-layer').isVisible()) await press('.welcome-dismiss-layer');
  const before = await snapshot('offered'); report.before = await read(null);
  assert.equal(sha(JSON.stringify(before)), sha(JSON.stringify(withResidentWalkers(admitted))));
  assert.equal(before.tick, witness.tick); assert.equal(before.seed, 1);
  assert.equal(await page.locator('.speed-seal[data-seal="pause"]').getAttribute('aria-pressed'), 'true');
  const card = `.lord-card[data-registry-offer="ck_evt_024"][data-occurrence="${witness.offer.id}"]`;
  await press(`${card} [data-choose="keep"]`);
  const after = await snapshot('answered');
  const occurrence = after.registry.occurrences.find(row => row.id === witness.offer.id);
  assert.equal(occurrence.status, 'answered'); assert.equal(occurrence.choiceId, 'keep');
  const oldIds = new Set(before.trace.decisions.map(row => row.id));
  const answers = after.trace.decisions.filter(row => !oldIds.has(row.id) && row.source === 'registry:ck_evt_024:keep');
  assert.equal(answers.length, 1); report.answer = answers[0];
  report.actual = { beforeRelation: before.factions.factions.find(row => row.id === 'town')?.relation,
    afterRelation: after.factions.factions.find(row => row.id === 'town')?.relation,
    beforeDues: before.agency.duesPermille, afterDues: after.agency.duesPermille };
  report.actual.delta = report.actual.afterRelation - report.actual.beforeRelation;
  assert.equal(report.actual.afterRelation, Math.max(-100, Math.min(100, report.actual.beforeRelation + HOLD_RELATION_DELTA)));
  assert.equal(after.tick, before.tick); assert.equal(report.actual.beforeDues, report.actual.afterDues);
  report.receipt = await page.locator('.answer-receipt:visible').innerText();
  await press('.answer-receipt:visible .answer-receipt-close');
  assert.equal(sha(JSON.stringify(await state())), sha(JSON.stringify(after)), 'Closing receipt changed state');
  await page.clock.runFor(4000);
  report.after = await read(report.answer.id); await snapshot('chip');
  if (report.actual.delta === 0) report.failureClass = 'rule_inert_relation_saturation';
  else if (!report.after.item) report.failureClass = report.after.rows.length ? 'year_results_omission' : 'immediate_effect_missing_trace';
  else {
    const chip = `.event-chip[data-story="decision_trace"][data-chip-id="results:${report.after.results.year}"]`;
    assert.equal(await page.locator(chip).textContent(), report.after.expectedChip);
    const beforeNavigation = sha(JSON.stringify(await state()));
    await press(chip);
    const actualCard = page.locator('.event-card[data-story="decision_trace"]:visible'); assert.equal(await actualCard.count(), 1);
    const items = await actualCard.locator('.event-card-facts li').evaluateAll(elements => elements.map(el => {
      const b = el.getBoundingClientRect(), top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return { text: el.textContent, exposed: b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && top !== null && (el === top || el.contains(top)) };
    }));
    report.manual = { items, expectedFact: report.after.expectedFact, beforeSha256: beforeNavigation,
      afterSha256: sha(JSON.stringify(await state())) };
    assert.equal(items.filter(row => row.text === report.after.expectedFact).length, 1);
    assert.ok(items.some(row => row.text === report.after.expectedFact && row.exposed));
    assert.equal(report.manual.beforeSha256, report.manual.afterSha256);
    await snapshot('card'); report.valid = report.actual.delta !== 0 && report.errors.length === 0;
  }
} catch (error) {
  report.errors.push(String(error)); report.failureClass ??= 'harness_or_screen_requires_classification';
  if (page) await snapshot('failure').catch(() => {});
} finally {
  if (context) await context.close(); if (browser) await browser.close();
  writeFileSync(join(out, 'answer024.json.gz'), gzipSync(JSON.stringify(report, null, 2), { level: 9 }));
}
console.log(JSON.stringify({ valid: report.valid, actual: report.actual, failureClass: report.failureClass, errors: report.errors }));
process.exitCode = report.valid ? 0 : 1;
