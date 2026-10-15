import { navigationStateSha256 as navSha, NAVIGATION_HASH_SCOPE } from './navigationState.mjs';
import { answerEffects } from '../../../src/engine/decisionTraceAnswers.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { decodeSave, saveAdmissions } from './reviewedSaveAdmission.mjs';
import { withResidentWalkers } from '../../../src/render/presentation/residentWalkerState.ts';
import { loadChromium } from '../../../scripts/renderCommitProbe.mjs';
import { routeSceneState, sceneStateRefusal } from '../../../scripts/sceneInjection.mjs';
assert.equal(process.platform, 'linux'); assert.equal(process.env.FLS_REMOTE, '1');
assert.ok(process.env.FLS_REMOTE_PORT);
const meta = readFileSync('.remote-in/meta.env', 'utf8');
assert.match(meta, /^SLOT=heavy$/m); assert.match(meta, /^RUN_CLASS=experiment$/m);
const [input, out, url] = process.argv.slice(2);
assert.ok(input && out && url); mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const product = '53407fe6946921ddd448fcffeb417ae07e7351f2';
assert.equal(execFileSync('git', ['diff', product, 'HEAD', '--', 'src', 'package.json', 'package-lock.json'], { encoding: 'utf8' }), '');
const acquisitionBytes = readFileSync(join(input, 'acquisition.json.gz'));
assert.equal(sha(acquisitionBytes), '7797c4940af51d990eb4deced57d94e0e0e5679ef86f51220ab46c906a41edc0');
const acquisition = JSON.parse(gunzipSync(acquisitionBytes));
assert.equal(acquisition.product, '0eddc146c7d57b4cae091bff62295a1fc16e1f97', 'Historical acquisition provenance'); assert.equal(acquisition.found, true); assert.deepEqual(acquisition.errors, []);
const witness = acquisition.offered.find(row => row.entryId === 'ck_evt_046');
assert.ok(witness?.choices.includes('cancel'));
assert.equal(witness.tick, 298000);
assert.equal(witness.gzipSha256, '98ec9d41b2f7529efa8d2be6fc38afc09dc980c3407fbc93692cc9318aa83231');
assert.equal(witness.encodedSha256, '95e2d785287ca7bfb009cf9f1c540eb034445d872433a7112b13a2fbb99c448d');
assert.equal(witness.stateSha256, '43104de224ef9be3714c9ca76428b73d1af268d955cb20d9ff17679282db22c6');
const packed = readFileSync(join(input, witness.file)); assert.equal(sha(packed), witness.gzipSha256);
const raw = gunzipSync(packed); assert.equal(sha(raw), witness.encodedSha256);
const admitted = decodeSave(raw).envelope.state;
assert.equal(sha(JSON.stringify(admitted)), witness.stateSha256);
const report = { navigationHashScope: NAVIGATION_HASH_SCOPE, trajectoryScope: 'resumed_old_input_under_new_rules', saveAdmissions, product, toolRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  acquisitionSha256: sha(acquisitionBytes), witness, entryId: 'ck_evt_046', choice: 'cancel', screenshots: [], actions: [], errors: [], valid: false,
  limits: ['Actual UI answer from a genuine normally resumed offer. No state fields invented.',
    'Cancellation is complete when timberOrder becomes absent/zero. Later delivery from a new order is not its effect.',
    'Processing/registry.answered records alone are not effect evidence. Missing immediate-effect trace is a failed gate, not invented future success.',
    'A yearly chip is automatic aggregation; opening its card is manual.'] };
const contract = JSON.parse(readFileSync('docs/design/engine-B-outcomes.json')).events.find(row => row.id === 'ck_evt_046').choices.find(row => row.id === 'cancel');
assert.deepEqual(contract.commands, [{ type: 'order_timber', args: { amount: 0 } }]);
assert.ok(contract.outcomes.some(row => row.effectKind === 'immediate' && row.target.path === 'state.timberOrder'));
report.contract = contract;
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
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const scroll = await el.evaluate(el => {
      const target = el.getBoundingClientRect();
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), b = parent.getBoundingClientRect();
        if (!['auto', 'scroll'].includes(style.overflowY) || parent.scrollHeight <= parent.clientHeight) continue;
        if (target.top >= b.top && target.bottom <= b.bottom) return null;
        const x = Math.min(innerWidth - 2, Math.max(2, b.x + b.width / 2));
        const y = Math.min(innerHeight - 2, Math.max(2, b.y + b.height / 2));
        const top = document.elementFromPoint(x, y);
        return top && parent.contains(top) ? { x, y, delta: target.bottom > b.bottom ? 500 : -500,
          scrollTop: parent.scrollTop, target: { top: target.top, bottom: target.bottom } } : null;
      }
      return null;
    });
    if (!scroll) break;
    const before = navSha(await state());
    await page.mouse.move(scroll.x, scroll.y); await page.mouse.wheel(0, scroll.delta); await page.clock.runFor(64);
    const after = navSha(await state()); assert.equal(after, before, 'Card scroll changed game state');
    report.actions.push({ input: 'native wheel', selector, scroll, beforeSha256: before, afterSha256: after });
  }
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
  const card = `.lord-card[data-registry-offer="ck_evt_046"][data-occurrence="${witness.offer.id}"]`;
  await press(`${card} [data-choose="cancel"]`);
  const after = await snapshot('answered');
  const occurrence = after.registry.occurrences.find(row => row.id === witness.offer.id);
  assert.equal(occurrence.status, 'answered'); assert.equal(occurrence.choiceId, 'cancel');
  const oldIds = new Set((before.trace?.answers ?? []).map(row => row.id));
  const answers = (after.trace?.answers ?? []).filter(row => !oldIds.has(row.id) && row.source === 'registry:ck_evt_046:cancel');
  assert.equal(answers.length, 1); report.answer = answers[0];
  report.answerEffects = answerEffects(after, report.answer.id) ?? null;
  report.actual = { target: 'state.timberOrder', before: before.timberOrder ?? 0,
    after: after.timberOrder ?? 0, beforePresent: Object.hasOwn(before, 'timberOrder'), afterPresent: Object.hasOwn(after, 'timberOrder') };
  report.actual.delta = report.actual.after - report.actual.before;
  assert.equal(report.actual.before, 350);
  assert.equal(report.actual.after, 0);
  assert.equal(report.actual.afterPresent, false, 'Cancellation must remove the actual outstanding order');
  assert.equal(after.tick, before.tick);
  report.newHistory = after.history.records.filter(row => !before.history.records.some(previous => previous.id === row.id));
  const receipt = page.locator('.answer-receipt:visible');
  report.receipt = { present: await receipt.count() === 1, text: null, exactOrderDeltaVisible: false };
  if (report.receipt.present) {
    report.receipt.text = await receipt.innerText();
    const timberRow = receipt.locator('[data-receipt-row="timber"]');
    report.receipt.timberRow = await timberRow.count() === 1 ? await timberRow.innerText() : null;
    report.receipt.expected = await page.evaluate(async () => {
      const { ANSWER_RECEIPT_COPY } = await import('/src/ui/decisionCard/answerReceiptCopy.ko.ts');
      return { what: ANSWER_RECEIPT_COPY.timber, change: ANSWER_RECEIPT_COPY.change(ANSWER_RECEIPT_COPY.timberValue(350), ANSWER_RECEIPT_COPY.timberValue(0)) };
    });
    report.receipt.exactOrderDeltaVisible = await timberRow.count() === 1
      && await timberRow.locator('.answer-receipt-what').innerText() === report.receipt.expected.what
      && await timberRow.locator('.answer-receipt-change').innerText() === report.receipt.expected.change;
    await press('.answer-receipt:visible .answer-receipt-close');
    assert.equal(navSha(await state()), navSha(after), 'Closing receipt changed state');
  }
  await page.clock.runFor(4000);
  assert.equal(navSha(await state()), navSha(after), 'Paused UI settling changed state');
  report.after = await read(report.answer.id); await snapshot('chip');
  report.chipCount = { before: report.before.results?.count ?? 0, after: report.after.results?.count ?? 0 };
  report.chipCount.delta = report.chipCount.after - report.chipCount.before;
  report.navigation = { attempted: false, reason: 'Only navigate an exact answer-linked result item; no unrelated card substitute.' };
  report.effectTrace = report.after.rows.filter(row => {
    const record = after.history.records.find(record => record.id === row.recordId);
    return row.decisionId === report.answer.id && row.decisionTick === after.tick && row.tick === after.tick
      && record !== undefined && record.kind !== 'decision' && record.template !== 'registry.answered'
      && row.delta === report.actual.delta && /timber|order/.test(`${row.key} ${row.actor}`);
  });
  report.primaryAnswerEffects = (report.answerEffects ?? []).filter(effect => effect.target === 'command' && JSON.stringify(effect.path) === JSON.stringify(['timberOrder'])
    && effect.before === 350 && effect.after === 0 && effect.delta === -350 && effect.beforePresent && effect.afterPresent);
  report.primaryEffectTraceValid = report.effectTrace.length > 0 || report.primaryAnswerEffects.length === 1;
  report.screenCaptureValid = false;
  report.screenFailureClass = report.after.item ? null : 'year_results_omission';
  if (report.actual.delta === 0) report.failureClass = 'rule_inert_order_cancel';
  else if (!report.after.item) report.failureClass = (report.primaryEffectTraceValid || report.after.rows.length > 0) ? 'year_results_omission' : 'immediate_effect_missing_trace';
  else if (!report.primaryEffectTraceValid) report.failureClass = 'order_cancel_missing_effect_trace';
  else {
    assert.ok(report.chipCount.delta > 0, 'A real result must increase the yearly chip count');
    const chip = `.event-chip[data-story="decision_trace"][data-chip-id="results:${report.after.results.year}"]`;
    assert.equal(await page.locator(chip).textContent(), report.after.expectedChip);
    report.navigation = { attempted: true, reason: 'Exact answer-linked result item and effect trace found.' };
    const beforeNavigation = navSha(await state());
    await press(chip);
    const actualCard = page.locator('.event-card[data-story="decision_trace"]:visible'); assert.equal(await actualCard.count(), 1);
    const items = await actualCard.locator('.event-card-facts li').evaluateAll(elements => elements.map(el => {
      const b = el.getBoundingClientRect(), top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return { text: el.textContent, exposed: b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && top !== null && (el === top || el.contains(top)) };
    }));
    report.manual = { items, expectedFact: report.after.expectedFact, beforeSha256: beforeNavigation,
      afterSha256: navSha(await state()) };
    assert.equal(items.filter(row => row.text === report.after.expectedFact).length, 1);
    assert.ok(items.some(row => row.text === report.after.expectedFact && row.exposed));
    assert.equal(report.manual.beforeSha256, report.manual.afterSha256);
    await snapshot('card'); report.screenCaptureValid = report.errors.length === 0; report.valid = report.actual.delta !== 0 && report.errors.length === 0;
  }
} catch (error) {
  report.errors.push(String(error)); report.failureClass ??= 'harness_or_screen_requires_classification';
  if (page) await snapshot('failure').catch(() => {});
} finally {
  if (context) await context.close().catch(error => report.errors.push(`Context close: ${error}`));
  if (browser) await browser.close().catch(error => report.errors.push(`Browser close: ${error}`));
  if (report.errors.length) report.valid = false;
  writeFileSync(join(out, 'answer046.json.gz'), gzipSync(JSON.stringify(report, null, 2), { level: 9 }));
}
console.log(JSON.stringify({ valid: report.valid, actual: report.actual, failureClass: report.failureClass, errors: report.errors }));
process.exitCode = report.valid ? 0 : 1;
