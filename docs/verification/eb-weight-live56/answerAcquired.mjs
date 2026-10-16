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
const [caseId, input, out, url] = process.argv.slice(2);
assert.ok(out, 'Output directory required'); mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const product = '0b9e1a6bbb7c6b47cd19b5a1f1358dedde6afa96';
const report = { navigationHashScope: NAVIGATION_HASH_SCOPE, trajectoryScope: 'resumed_old_input_under_new_rules', saveAdmissions, schemaVersion: 1, caseId, product, valid: false, lord56Pass: false, humanJpegReview: "pending",
  screenshots: [], actions: [], errors: [], offerNavigation: [], screenCaptureValid: false,
  limits: ['One genuine acquired offer answered through ordinary UI; no fabricated state.',
    'Immediate actual effect only; no claim that a filing won, enforcement succeeded, or timber was delivered.',
    'Missing exact effect-linked trace fails the gate; processing records are never substituted.',
    'Automated checks still require separate screenshot review; receipts are diagnostic only.'] };
let browser, context, page, selected, witness;
async function state() { return page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state()); }
async function snapshot(label) {
  const s = await state(), json = JSON.stringify(s), file = `${label}.state.json.gz`;
  writeFileSync(join(out, file), gzipSync(json, { level: 9 }));
  await page.screenshot({ path: join(out, `${label}.jpg`), type: 'jpeg', quality: 55 });
  report.screenshots.push({ label, file, sha256: sha(json), image: `${label}.jpg` }); return s;
}
async function press(selector, settle = true) {
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
  report.actions.push({ selector, tick: (await state()).tick }); if (settle) await page.clock.runFor(32);
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
async function navigate(selector) {
  const before = await state();
  assert.equal(await page.locator('.speed-seal[data-seal="pause"]').getAttribute('aria-pressed'), 'true');
  await press(selector, false);
  const after = await state();
  const row = { selector, beforeTick: before.tick, afterTick: after.tick,
    beforeSha256: navSha(before), afterSha256: navSha(after),
    offerBefore: before.registry.occurrences.find(row => row.id === witness.offer.id),
    offerAfter: after.registry.occurrences.find(row => row.id === witness.offer.id) };
  report.offerNavigation.push(row);
  assert.equal(row.afterTick, row.beforeTick); assert.equal(row.afterSha256, row.beforeSha256);
  assert.deepEqual(row.offerAfter, row.offerBefore);
  assert.equal(await page.locator('.speed-seal[data-seal="pause"]').getAttribute('aria-pressed'), 'true');
  await page.clock.runFor(32);
  row.settledSha256 = navSha(await state());
  assert.equal(row.settledSha256, row.beforeSha256);
  assert.equal(await page.locator('.speed-seal[data-seal="pause"]').getAttribute('aria-pressed'), 'true');
}
function actualEffect(before, after) {
  const bound = witness.offer.bound;
  const newLedger = after.ledger.entries.filter(row => !before.ledger.entries.some(old => old.id === row.id));
  const proof = { type: selected.id, newLedger };
  report.actual = proof;
  if (selected.id === '052') {
    const old = before.stewardship.audits.find(row => row.id === bound.audit);
    const audit = after.stewardship.audits.find(row => row.id === bound.audit);
    assert.equal(old.status, 'pending'); assert.equal(old.revealedKept, 356);
    assert.ok(before.tick <= old.deadline); assert.equal(audit.status, 'punished');
    const recovery = newLedger.filter(row => row.account === 'cash' && row.category === 'audit_recovery'
      && row.tick === after.tick && row.sourceRefs.some(ref => ref.type === 'claim' && ref.id === old.id && ref.detail === 'audit'));
    assert.equal(recovery.length, 1); assert.equal(recovery[0].amount, 178);
    assert.equal(after.treasuryCoin - before.treasuryCoin, 178);
    const oldOversight = before.stewardship.oversight.find(row => row.estateId === bound.estate);
    const oversight = after.stewardship.oversight.find(row => row.estateId === bound.estate);
    assert.equal(oldOversight.stewardId, old.stewardId); assert.equal(oversight.stewardId, bound.successor);
    assert.equal(after.stewardship.stewards.find(row => row.personId === old.stewardId).status, 'dismissed');
    assert.equal(after.stewardship.stewards.find(row => row.personId === bound.successor).status, 'serving');
    assert.equal(oversight.tenants, Math.max(-100, Math.min(100, Math.round(oldOversight.tenants + 5))));
    Object.assign(proof, { before: old, after: audit, recovered: 178, oversightBefore: oldOversight, oversightAfter: oversight });
    return record => record.template === 'stewardship.audit_answered' && record.params?.stewardId === old.stewardId
      && record.params?.choice === 'punished' && record.params?.recovered === 178;
  }
  if (selected.id === '059') {
    const old = before.stewardship.oversight.find(row => row.estateId === bound.estate);
    const oversight = after.stewardship.oversight.find(row => row.estateId === bound.estate);
    assert.notEqual(old.stewardId, bound.ableCandidate); assert.equal(oversight.stewardId, bound.ableCandidate);
    assert.equal(oversight.mode, 'steward'); assert.equal(oversight.since, before.tick);
    assert.equal(after.stewardship.stewards.find(row => row.personId === old.stewardId).status, 'candidate');
    assert.equal(after.stewardship.stewards.find(row => row.personId === bound.ableCandidate).status, 'serving');
    Object.assign(proof, { before: old, after: oversight });
    return record => record.template === 'stewardship.oversight' && record.params?.estate === bound.estate
      && record.params?.mode === oversight.mode && record.params?.stewardId === oversight.stewardId;
  }
  if (selected.id === '209') {
    assert.equal(before.timberOrder ?? 0, 0); assert.equal(after.timberOrder, 10);
    Object.assign(proof, { target: 'state.timberOrder', before: 0, after: 10, delta: 10 });
    proof.immediateTraceSupport = 'v56_answerEffects_command_path';
    proof.traceReason = 'Exact answerEffects timberOrder before/after is checked independently of future history.';
    return () => false;
  }
  const oldClaim = before.estates.claims.find(row => row.id === bound.claim);
  let suit;
  if (selected.id === '038') {
    const old = before.estates.suits.find(row => row.id === bound.suit);
    suit = after.estates.suits.find(row => row.id === bound.suit);
    assert.equal(old.stage, 'enforcing'); assert.equal(old.hold, 75); assert.equal(old.patronSupport, 0);
    assert.equal(suit.enforcements, old.enforcements + 1); assert.equal(suit.hold, 55);
    assert.equal(suit.stage, 'enforcing'); assert.equal(suit.enforced, false);
    assert.deepEqual(after.estates.estates, before.estates.estates, 'Failed enforcement must not transfer possession');
    assert.ok(suit.costs > old.costs);
    Object.assign(proof, { before: old, after: suit, cost: suit.costs - old.costs });
  } else {
    const created = after.estates.suits.filter(row => !before.estates.suits.some(old => old.id === row.id));
    assert.equal(created.length, 1); suit = created[0];
    assert.equal(suit.claimId, bound.claim); assert.equal(suit.estateId, oldClaim.estateId);
    assert.equal(suit.pieceId, oldClaim.pieceId); assert.equal(suit.plaintiff, oldClaim.claimant);
    assert.equal(suit.stage, 'filed'); assert.equal(suit.stageSince, before.tick);
    assert.equal(after.estates.claims.find(row => row.id === bound.claim).status, 'suing');
    assert.notEqual(oldClaim.status, 'suing'); assert.ok(suit.costs > 0);
    Object.assign(proof, { before: null, after: suit, cost: suit.costs, claimBefore: oldClaim });
  }
  const payments = newLedger.filter(row => row.account === 'cash' && row.category === 'lawsuit' && row.tick === after.tick
    && row.sourceRefs.some(ref => ref.type === 'claim' && ref.id === bound.claim
      && ref.detail === `${suit.id}:${selected.id === '038' ? `enforcing:${suit.enforcements}` : 'filed'}`));
  assert.equal(payments.length, 1); assert.equal(payments[0].amount, -proof.cost);
  assert.equal(after.treasuryCoin - before.treasuryCoin, -proof.cost);
  return record => selected.id === '038'
    ? record.template === 'estate.possession_enforced' && record.params?.suit === suit.id
      && record.params?.attempt === suit.enforcements && record.params?.succeeded === 0
    : record.template === 'estate.suit_filed' && record.params?.suit === suit.id && record.params?.claim === bound.claim
      && record.params?.plaintiff === suit.plaintiff && record.params?.defendant === suit.defendant;
}
try {
  assert.equal(process.platform, 'linux'); assert.equal(process.env.FLS_REMOTE, '1');
  assert.ok(input && url && process.env.FLS_REMOTE_PORT);
  const meta = readFileSync('.remote-in/meta.env', 'utf8');
  assert.match(meta, /^SLOT=heavy$/m); assert.match(meta, /^RUN_CLASS=experiment$/m);
  assert.equal(execFileSync('git', ['diff', product, 'HEAD', '--', 'src', 'package.json', 'package-lock.json'], { encoding: 'utf8' }), '');
  report.toolRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  selected = JSON.parse(readFileSync('docs/verification/eb-weight-live56/acquired-answer-cases.json')).find(row => row.id === caseId);
  assert.ok(selected); assert.equal(selected.executionProduct, product); report.selected = selected; report.entryId = selected.entryId; report.choice = selected.choice;
  const packedReport = readFileSync(join(input, 'acquisition.json.gz'));
  assert.equal(sha(packedReport), selected.acquisitionSha256);
  const acquisition = JSON.parse(gunzipSync(packedReport));
  assert.equal(acquisition.product, '0eddc146c7d57b4cae091bff62295a1fc16e1f97', 'Historical acquisition provenance'); assert.equal(acquisition.found, true); assert.deepEqual(acquisition.errors, []);
  witness = acquisition.offered.find(row => row.file === selected.witness.file);
  assert.deepEqual(witness, selected.witness); report.witness = witness;
  const packed = readFileSync(join(input, witness.file)); assert.equal(sha(packed), witness.gzipSha256);
  const raw = gunzipSync(packed); assert.equal(sha(raw), witness.encodedSha256);
  const admitted = decodeSave(raw).envelope.state;
  assert.deepEqual(admitted, JSON.parse(raw).state, 'Codec admission changed acquired state');
  assert.equal(sha(JSON.stringify(admitted)), witness.stateSha256);
  assert.equal(admitted.tick, witness.tick); assert.equal(admitted.seed, selected.seed);
  const { openRegistryOffers, offerChoices } = await import('../../../src/engine/registry.ts');
  const offered = openRegistryOffers(admitted).find(row => row.id === witness.offer.id);
  assert.deepEqual(offered, witness.offer); assert.ok(offerChoices(admitted, offered).includes(selected.choice));
  const contractBytes = readFileSync('docs/design/engine-B-outcomes.json');
  assert.equal(sha(contractBytes), selected.contractSha256);
  report.contract = JSON.parse(contractBytes).events
    .find(row => row.id === selected.entryId).choices.find(row => row.id === selected.choice);
  assert.ok(report.contract); assert.deepEqual(report.contract.commands, selected.commands);
  browser = await (await loadChromium()).launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'ko-KR' });
  page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', error => report.errors.push(String(error)));
  await page.clock.install();
  await context.addInitScript("globalThis.__name ??= target => target; localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));");
  await page.routeWebSocket('**', socket => socket.close()); await routeSceneState(page, raw.toString('utf8'));
  const refused = sceneStateRefusal(page); await page.goto(`${url}?phase10-proof=1`, { timeout: 90000 });
  await Promise.race([page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined), refused]);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  if (await page.locator('.welcome-dismiss-layer').isVisible()) await navigate('.welcome-dismiss-layer');
  const before = await snapshot('offered'); report.before = await read(null);
  assert.equal(sha(JSON.stringify(before)), sha(JSON.stringify(withResidentWalkers(admitted))));
  const card = `.lord-card[data-registry-offer="${selected.entryId}"][data-occurrence="${witness.offer.id}"]`;
  if (await page.locator(card).count() === 0) {
    const knownCards = ['.lord-card[data-home-petition="boundary_dispute"]:visible'];
    if (selected.id === '052') knownCards.push(`.lord-card[data-lord-decision="audit"][data-audit="${witness.offer.bound.audit}"]:visible`);
    for (const known of knownCards) if (await page.locator(card).count() === 0 && await page.locator(known).count() === 1) {
      assert.equal(await page.locator(`${known} .story-modal-later`).textContent(), '나중에 정한다');
      await navigate(`${known} .story-modal-later`);
    }
    if (await page.locator(card).count() === 0) {
      assert.equal(await page.locator('[role="dialog"]:visible').count(), 0, 'Unknown covering modal');
      await navigate(`.event-chip[data-story="registry_event"][data-chip-id="registry:${witness.offer.id}"]`);
      if (await page.locator(card).count() === 0) await navigate(`.event-card[data-story="registry_event"][data-chip-id="registry:${witness.offer.id}"] .event-card-decide`);
    }
  }
  assert.equal(await page.locator('.speed-seal[data-seal="pause"]').getAttribute('aria-pressed'), 'true');
  assert.equal(navSha(await state()), navSha(before));
  await snapshot('target-offered');
  report.phase = 'answer'; await press(`${card} [data-choose="${selected.choice}"]`);
  const after = await snapshot('answered'); assert.equal(after.tick, before.tick);
  const occurrence = after.registry.occurrences.find(row => row.id === witness.offer.id);
  assert.equal(occurrence.status, 'answered'); assert.equal(occurrence.choiceId, selected.choice);
  report.phase = 'actual_effect'; const matchesEffect = actualEffect(before, after);
  report.actualVerified = true;
  report.phase = 'answer_trace';
  const oldIds = new Set((before.trace?.answers ?? []).map(row => row.id));
  const answers = (after.trace?.answers ?? []).filter(row => !oldIds.has(row.id) && row.source === `registry:${selected.entryId}:${selected.choice}`);
  if (answers.length !== 1) report.failureClass = 'actual_effect_present_exact_answer_trace_missing';
  assert.equal(answers.length, 1); report.answer = answers[0];
  report.answerEffects = answerEffects(after, report.answer.id) ?? null;
  report.newHistory = after.history.records.filter(row => !before.history.records.some(old => old.id === row.id));
  const receipt = page.locator('.answer-receipt:visible');
  report.receipt = { present: await receipt.count() === 1, diagnosticOnly: true };
  if (report.receipt.present) {
    report.receipt.text = await receipt.innerText(); await snapshot('receipt');
    await navigate('.answer-receipt:visible .answer-receipt-close');
  }
  await page.clock.runFor(4000);
  assert.equal(navSha(await state()), navSha(after), 'Paused settling changed state');
  report.after = await read(report.answer.id); await snapshot('chip');
  const newHistoryIds = new Set(report.newHistory.map(row => row.id));
  report.primaryEffectTrace = report.after.rows.filter(row => {
    const record = after.history.records.find(record => record.id === row.recordId);
    return record && newHistoryIds.has(record.id) && record.tick === after.tick && row.tick === after.tick
      && row.decisionId === report.answer.id && row.decisionTick === after.tick
      && record.kind !== 'decision' && record.template !== 'registry.answered'
      && record.because?.some(cause => cause.decisionId === report.answer.id) && matchesEffect(record, row);
  });
  report.chipCount = { before: report.before.results?.count ?? 0, after: report.after.results?.count ?? 0 };
  report.chipCount.delta = report.chipCount.after - report.chipCount.before;
  const ownsMemory = (factionId, memory) => memory.decisionId === report.answer.id
    || (report.answer.memoryEvidence ?? []).some(evidence => evidence.factionId === factionId
      && evidence.recordId === memory.recordId && evidence.tick === memory.tick && evidence.reason === memory.reason);
  report.relationDiagnostics = {
    interpretation: 'Raw answer-linked relation evidence only; not proof of the primary effect or actual relation delta.',
    rows: report.after.rows.filter(row => row.key === 'relation'),
    factions: (after.factions?.factions ?? []).filter(faction => faction.memory.some(memory => ownsMemory(faction.id, memory)))
      .map(faction => ({ id: faction.id, beforeRelation: before.factions?.factions.find(old => old.id === faction.id)?.relation ?? null,
        afterRelation: faction.relation, memories: faction.memory.filter(memory => ownsMemory(faction.id, memory)) })),
  };
  const exactEffect = (target, path, before, after, beforePresent = true, afterPresent = true) =>
    (report.answerEffects ?? []).filter(effect => effect.target === target && JSON.stringify(effect.path) === JSON.stringify(path)
      && effect.before === before && effect.after === after && effect.beforePresent === beforePresent && effect.afterPresent === afterPresent
      && effect.delta === (typeof before === 'number' && typeof after === 'number' ? after - before : null));
  const actual = report.actual, bound = witness.offer.bound;
  report.primaryAnswerEffects = selected.id === '209' ? exactEffect('command', ['timberOrder'], 0, 10)
    : selected.id === '059' ? exactEffect('oversight', ['stewardship', 'oversight', bound.estate, 'stewardId'], actual.before.stewardId, actual.after.stewardId)
    : selected.id === '038' ? exactEffect('right', ['estates', 'suits', bound.suit, 'hold'], 75, 55)
    : selected.id === '052' ? actual.newLedger.filter(row => row.category === 'audit_recovery').flatMap(row =>
        exactEffect('audit_recovery', ['auditRecovery', bound.audit, row.id], 0, 178))
    : exactEffect('right', ['estates', 'suits', actual.after.id, 'stage'], null, 'filed', false, true);
  report.primaryEffectTraceValid = report.primaryEffectTrace.length > 0 || report.primaryAnswerEffects.length === 1;
  if (!report.primaryEffectTraceValid) report.failureClass = 'actual_effect_present_exact_trace_missing';
  report.screenFailureClass = report.after.item ? null : 'year_results_omission';
  if (!report.after.item) report.failureClass ??= 'year_results_omission';
  if (report.after.item) {
    report.phase = 'chip_card'; assert.ok(report.chipCount.delta > 0);
    const chip = `.event-chip[data-story="decision_trace"][data-chip-id="results:${report.after.results.year}"]`;
    assert.equal(await page.locator(chip).textContent(), report.after.expectedChip);
    const beforeNavigation = navSha(await state()); await navigate(chip);
    const actualCard = page.locator('.event-card[data-story="decision_trace"]:visible'); assert.equal(await actualCard.count(), 1);
    const items = await actualCard.locator('.event-card-facts li').evaluateAll(elements => elements.map(el => {
      const b = el.getBoundingClientRect(), top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return { text: el.textContent, exposed: b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && top !== null && (el === top || el.contains(top)) };
    }));
    report.manual = { items, expectedFact: report.after.expectedFact, beforeSha256: beforeNavigation, afterSha256: navSha(await state()) };
    assert.equal(items.filter(row => row.text === report.after.expectedFact).length, 1);
    assert.ok(items.some(row => row.text === report.after.expectedFact && row.exposed));
    assert.equal(report.manual.beforeSha256, report.manual.afterSha256); await snapshot('card');
    report.screenCaptureValid = report.errors.length === 0;
    report.valid = report.actualVerified === true && report.primaryEffectTraceValid && report.screenCaptureValid;
    // Full gate remains pending separate JPEG review, even when all automated assertions pass.
  }
} catch (error) {
  report.errors.push(String(error));
  if (report.phase === 'chip_card') report.screenFailureClass = 'chip_card_or_navigation_contract_failed';
  report.failureClass ??= report.phase === 'actual_effect' ? 'actual_effect_contract_failed' : 'harness_or_screen_requires_classification';
  if (page) await snapshot('failure').catch(error => report.errors.push(`Failure snapshot: ${error}`));
} finally {
  if (context) await context.close().catch(error => report.errors.push(`Context close: ${error}`));
  if (browser) await browser.close().catch(error => report.errors.push(`Browser close: ${error}`));
  if (report.errors.length) { report.valid = false; report.lord56Pass = false; }
  writeFileSync(join(out, 'answer-acquired.json.gz'), gzipSync(JSON.stringify(report, null, 2), { level: 9 }));
}
console.log(JSON.stringify({ entryId: report.entryId, valid: report.valid, failureClass: report.failureClass, errors: report.errors }));
process.exitCode = report.valid ? 0 : 1;
