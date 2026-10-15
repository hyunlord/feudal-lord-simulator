import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { decodeSave, encodeSave } from '../../../src/save/saveCodec.ts';
import { openRegistryOffers, offerChoices } from '../../../src/engine/registry.ts';
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
const product = '0eddc146c7d57b4cae091bff62295a1fc16e1f97';
assert.equal(execFileSync('git', ['diff', product, 'HEAD', '--', 'src', 'package.json', 'package-lock.json'], { encoding: 'utf8' }), '');
const report = { product, toolRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  input, entryId: 'ck_evt_124', choice: 'a', screenshots: [], actions: [], errors: [], valid: false,
  provenance: { source: '/home/hyunlord/fls-lord-states/registry-offer.json',
    rawSha256: '0ff4d88a516b6b6868529ccc80281a4ea8a4e68c79b5ecf9ac01a024332bb508',
    archive: 'codex/engine-b-tlink:docs/verification/eb-answer-effects/fixtures.tar.xz',
    archiveSha256: '03a010b04a9de48492b4fc0de7c5ec994f3d20d7216e1010c0b12ccf9c5057e4', member: 'lord/registry-offer.json',
    generation: 'scripts/eventArtStates.ts play: ordinary newGameState, lordBotCommands/gameReducer and advanceTick; first registry offer captured before bot answer.' },
  limits: ['No state fields invented or repaired; raw save requires lossless current-codec admission.',
    'Choice a proposes 80d plus consent. A proposal is not a completed marriage; accepted/rejected/countered are distinct actual results.',
    'No future ticks or counter acceptance. Conditional future marriage events remain unobserved.',
    'No precise immediate marriage-effect trace is assumed from processing records; missing exact effect evidence stays diagnostic.',
    'Yearly chip aggregation is automatic; result-card opening is manual.'] };
const contract = JSON.parse(readFileSync('docs/design/engine-B-outcomes.json')).events.find(row => row.id === 'ck_evt_124').choices.find(row => row.id === 'a');
assert.equal(contract.commands[0].type, 'propose_marriage');
assert.deepEqual(contract.commands[0].args.terms, [{ kind: 'cash', giver: 'proposer', amount: 80 }]);
assert.ok(contract.outcomes.some(row => row.effectKind === 'immediate' && row.target.kind === 'negotiation'));
report.contract = contract;
let raw, admitted, witness;
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
    const before = sha(JSON.stringify(await state()));
    await page.mouse.move(scroll.x, scroll.y); await page.mouse.wheel(0, scroll.delta); await page.clock.runFor(64);
    const after = sha(JSON.stringify(await state())); assert.equal(after, before, 'Card scroll changed game state');
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
  const inputBytes = readFileSync(input);
  assert.equal(sha(inputBytes), report.provenance.rawSha256, 'Authentic raw input pin mismatch');
  admitted = JSON.parse(inputBytes);
  assert.equal(admitted.seed, 1); assert.equal(admitted.tick, 13000);
  const now = new Date().toISOString();
  raw = Buffer.from(encodeSave({ state: admitted, createdAt: now, savedAt: now }).bytes);
  assert.equal(JSON.stringify(decodeSave(raw).envelope.state), JSON.stringify(admitted), 'Raw-state admission changed values; no repairs allowed');
  writeFileSync(join(out, 'admitted.save.json.gz'), gzipSync(raw, { level: 9 }));
  report.admission = { rawSha256: sha(inputBytes), encodedSha256: sha(raw), stateSha256: sha(JSON.stringify(admitted)), lossless: true };
  const offer = openRegistryOffers(admitted).find(row => row.entryId === 'ck_evt_124');
  assert.ok(offer, 'Real saved 124 offer must still be offered');
  const choices = offerChoices(admitted, offer);
  witness = { offer, choices, tick: admitted.tick };
  report.witness = witness;
  assert.ok(choices.includes('a'), 'Canonical 80d choice must genuinely be enabled; no alternative invented');
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
  const card = `.lord-card[data-registry-offer="ck_evt_124"][data-occurrence="${witness.offer.id}"]`;
  await press(`${card} [data-choose="a"]`);
  const after = await snapshot('answered');
  const occurrence = after.registry.occurrences.find(row => row.id === witness.offer.id);
  assert.equal(occurrence.status, 'answered'); assert.equal(occurrence.choiceId, 'a');
  const oldIds = new Set(before.trace.decisions.map(row => row.id));
  const answers = after.trace.decisions.filter(row => !oldIds.has(row.id) && row.source === 'registry:ck_evt_124:a');
  assert.equal(answers.length, 1); report.answer = answers[0];
  const oldNegotiations = before.diplomacy?.negotiations ?? [];
  const created = (after.diplomacy?.negotiations ?? []).filter(row => !oldNegotiations.some(old => old.id === row.id));
  assert.equal(created.length, 1, 'A successful 124/a must create exactly one negotiation');
  const negotiation = created[0];
  assert.equal(negotiation.purpose, 'marriage');
  assert.equal(negotiation.groomId, witness.offer.bound.groom);
  assert.equal(negotiation.brideId, witness.offer.bound.bride);
  assert.equal(negotiation.counterpart, `estate:${witness.offer.bound.counterpart}`);
  assert.equal(negotiation.tick, before.tick);
  assert.ok(['accepted', 'rejected', 'countered'].includes(negotiation.status));
  assert.deepEqual(negotiation.terms.filter(term => term.kind !== 'consent'), contract.commands[0].args.terms);
  assert.ok(negotiation.terms.some(term => term.kind === 'consent'));
  report.actual = { target: `state.diplomacy.negotiations[${negotiation.id}]`, before: null, after: negotiation,
    addedNegotiations: 1, treasuryBefore: before.treasuryCoin, treasuryAfter: after.treasuryCoin,
    marriageBefore: before.diplomacy?.marriage ?? null, marriageAfter: after.diplomacy?.marriage ?? null };
  report.actual.treasuryDelta = report.actual.treasuryAfter - report.actual.treasuryBefore;
  assert.equal(after.tick, before.tick);
  report.newHistory = after.history.records.filter(row => !before.history.records.some(previous => previous.id === row.id));
  const receipt = page.locator('.answer-receipt:visible');
  report.receipt = { present: await receipt.count() === 1, text: null, rows: [], exactNegotiationStatus: false };
  if (report.receipt.present) {
    report.receipt.text = await receipt.innerText();
    report.receipt.rows = await receipt.locator('.answer-receipt-row').evaluateAll(elements => elements.map(el => ({
      key: el.getAttribute('data-receipt-row'), what: el.querySelector('.answer-receipt-what')?.textContent,
      change: el.querySelector('.answer-receipt-change')?.textContent })));
    report.receipt.expectedStatus = await page.evaluate(async status => {
      const { NEGOTIATION_COPY } = await import('/src/ui/lord/negotiation/negotiationCopy.ko.ts');
      return NEGOTIATION_COPY.answers[status];
    }, negotiation.status);
    report.receipt.exactNegotiationStatus = report.receipt.rows.some(row => row.key === `offer:${negotiation.id}:answer` && row.change === report.receipt.expectedStatus);
    await press('.answer-receipt:visible .answer-receipt-close');
    assert.equal(sha(JSON.stringify(await state())), sha(JSON.stringify(after)), 'Closing receipt changed state');
  }
  await page.clock.runFor(4000);
  assert.equal(sha(JSON.stringify(await state())), sha(JSON.stringify(after)), 'Paused UI settling changed state');
  report.after = await read(report.answer.id); await snapshot('chip');
  report.chipCount = { before: report.before.results?.count ?? 0, after: report.after.results?.count ?? 0 };
  report.chipCount.delta = report.chipCount.after - report.chipCount.before;
  report.navigation = { attempted: false, reason: 'Only navigate an exact answer-linked result item; no unrelated card substitute.' };
  report.effectTrace = report.after.rows.filter(row => {
    const record = after.history.records.find(record => record.id === row.recordId);
    return row.decisionId === report.answer.id && row.decisionTick === after.tick && row.tick === after.tick
      && row.key === 'marriage_turned' && record !== undefined && record.kind !== 'decision'
      && record.template !== 'registry.answered'
      && (record.subject?.id === negotiation.id || record.params?.negotiationId === negotiation.id || record.params?.negotiation === negotiation.id);
  });
  report.traceContract = 'Conservative diagnostic: immediate non-processing marriage_turned history must identify this created negotiation and exact successful answer ID. No generic processing record or unrelated relation is accepted.';
  if (!report.after.item) report.failureClass = report.after.rows.length ? 'year_results_omission' : 'immediate_negotiation_missing_trace';
  else if (!report.effectTrace.length) report.failureClass = 'immediate_negotiation_trace_contract_unproven';
  else {
    assert.ok(report.chipCount.delta > 0, 'A real result must increase the yearly chip count');
    const chip = `.event-chip[data-story="decision_trace"][data-chip-id="results:${report.after.results.year}"]`;
    assert.equal(await page.locator(chip).textContent(), report.after.expectedChip);
    report.navigation = { attempted: true, reason: 'Exact answer-linked result item and effect trace found.' };
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
    await snapshot('card'); report.valid = report.actual.addedNegotiations === 1 && report.errors.length === 0;
  }
} catch (error) {
  report.errors.push(String(error)); report.failureClass ??= 'harness_or_screen_requires_classification';
  if (page) await snapshot('failure').catch(() => {});
} finally {
  if (context) await context.close().catch(error => report.errors.push(`Context close: ${error}`));
  if (browser) await browser.close().catch(error => report.errors.push(`Browser close: ${error}`));
  if (report.errors.length) report.valid = false;
  writeFileSync(join(out, 'answer124.json.gz'), gzipSync(JSON.stringify(report, null, 2), { level: 9 }));
}
console.log(JSON.stringify({ valid: report.valid, actual: report.actual, failureClass: report.failureClass, errors: report.errors }));
process.exitCode = report.valid ? 0 : 1;
