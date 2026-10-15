import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

assert.equal(process.platform, 'linux', 'Browser verification runs on DGX only');
assert.equal(process.env.FLS_REMOTE, '1', 'Use the official remote runner');
const [input, out, url] = process.argv.slice(2);
assert(input && out && url, 'Usage: tsx event056.mjs INPUT OUTPUT_DIR URL');
mkdirSync(out, { recursive: true });
const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const sha = value => createHash('sha256').update(value).digest('hex');
const jsonSha = value => sha(JSON.stringify(value));
const report = { schemaVersion: 1, eventId: 'ck_evt_056', mode: 'genuine-historical-variant-real-UI-answers-paused',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  input, errors: [], rows: [], limits: ['No natural-play frequency claim; historical generator used player standing policies.',
    'Each choice starts fresh from the same genuine save. No ticks advanced; future consequences are unobserved.',
    'Variant provenance is witnessed on the actual card before the answer; v55 does not persist the variant ID.'] };
const saveReport = () => writeFileSync(join(out, 'event056.json'), `${JSON.stringify(report, null, 2)}\n`);
const difference = (before, after, path = '') => {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before !== null && after !== null && typeof before === 'object' && typeof after === 'object') {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => difference(before[key], after[key], `${path}/${key}`));
  }
  return [{ path, beforePresent: before !== undefined, afterPresent: after !== undefined,
    before: before ?? null, after: after ?? null, delta: typeof before === 'number' && typeof after === 'number' ? after - before : null }];
};
let browser;
try {
  const [{ decodeSave, encodeSave }, { withResidentWalkers }, { estatePetitionVariantFor }, { homePetitionView },
    { homePetitionCard }, { yearResults }, { traceInRange }, { traceGroups }, { BALANCE }, { RESULTS_COPY },
    { loadChromium, openScene }, { admitSceneState }, { DEFAULT_GAME_STATE }] = await Promise.all([
    import('../../../src/save/saveCodec.ts'), import('../../../src/render/presentation/residentWalkerState.ts'),
    import('../../../src/engine/registryVariants.ts'), import('../../../src/ui/lordCardsModel.ts'),
    import('../../../src/ui/decisionCard/families/homePetitionCard.ts'), import('../../../src/ui/results/yearResults.ts'),
    import('../../../src/engine/decisionReads.ts'), import('../../../src/ui/results/decisionThread.ts'),
    import('../../../src/content/balanceConfig.ts'), import('../../../src/ui/results/resultsCopy.ko.ts'),
    import('../../../scripts/renderCommitProbe.mjs'),
    import('../../../scripts/sceneState.ts'), import('../../../src/state/gameStore.ts'),
  ]);
  const bytes = readFileSync(input);
  report.rawSha256 = sha(bytes);
  assert.equal(report.rawSha256, '00c8eeab4b4c17443e3b3c53f0a6a2af639e7fc3bf1c23ea8de6a56fd181405c');
  const raw = JSON.parse(bytes);
  assert.equal(raw.schemaVersion, undefined, 'This pinned input is an unversioned scene snapshot');
  const state = admitSceneState(raw, DEFAULT_GAME_STATE);
  assert.equal(jsonSha(state), jsonSha(raw), 'Official scene admission must preserve every source value');
  const metadataBytes = readFileSync(join(repo, 'docs/verification/variants/states.json'));
  const metadata = JSON.parse(metadataBytes)['home-056'];
  assert.equal(metadata.prepared, false);
  assert.equal(state.seed, metadata.seed); assert.equal(state.tick, metadata.tick);
  assert.equal(state.seed, 3); assert.equal(state.tick, 32000);
  const petitionId = metadata.petition;
  assert.equal(petitionId, 'estate-petition-19');
  const head = homePetitionView(state);
  assert.equal(head?.petitionId, petitionId);
  const variant = estatePetitionVariantFor(state, petitionId);
  assert.equal(variant?.variantEntryId, 'ck_evt_056');
  const model = homePetitionCard(state);
  assert.equal(model?.subjectId, petitionId);
  assert.equal(model.title, variant.title);
  const encoded = encodeSave({ state, createdAt: '2026-10-15T00:00:00.000Z', savedAt: '2026-10-15T00:00:00.000Z' });
  const decoded = decodeSave(encoded.bytes);
  assert.equal(jsonSha(decoded.envelope.state), jsonSha(state));
  report.inputProvenance = { metadata, metadataSha256: sha(metadataBytes), rawSchemaVersion: null,
    admission: 'RES-REG current bare admission; unchanged snapshot repack, not a v0 migration',
    admittedStateSha256: jsonSha(state), currentSchemaVersion: decoded.envelope.schemaVersion,
    rawStateSha256: jsonSha(raw), repackedStateSha256: jsonSha(decoded.envelope.state),
    admissionChanges: difference(raw, state), variant, offeredChoices: model.choices };
  report.sceneSaveSha256 = sha(encoded.bytes);
  writeFileSync(join(out, '056-admitted.save.json.gz'), gzipSync(encoded.bytes, { level: 9 }));
  const seat = state.buildings.find(building => building.kind === 'manor_house') ?? state.buildings[0];
  assert(seat);
  browser = await (await loadChromium()).launch({ channel: 'chrome', headless: true });
  for (const choice of model.choices) {
    const row = { choiceId: choice.id, choice, actions: [], screenshots: [], errors: [] };
    report.rows.push(row);
    if (choice.refusal !== null) { row.status = 'not-offered-disabled'; saveReport(); continue; }
    let context; let page;
    const screenshot = async label => {
      const file = `056-${choice.id}-${label}.png`;
      await page.screenshot({ path: join(out, file) }); row.screenshots.push(file);
    };
    const proof = async () => JSON.parse(await page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state())));
    try {
      assert(['grant', 'refuse'].includes(choice.id), 'Unexpected genuine home-petition choice');
      ({ context, page } = await openScene(browser, { state: Buffer.from(encoded.bytes).toString('utf8'),
        tile: [seat.tx, seat.ty], baseUrl: url, width: 1280, height: 800, run: false, query: '&story-delay=0', loadTimeout: 90000,
        initScript: "globalThis.__name ??= target => target; localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));" }));
      page.on('pageerror', error => row.errors.push(String(error)));
      const initial = await proof();
      row.initialStateSha256 = jsonSha(initial);
      assert.equal(row.initialStateSha256, jsonSha(withResidentWalkers(state)), 'Genuine decoded input must load unchanged');
      await screenshot('initial');
      for (const selector of ['.season-ledger-resume', '.results-card-continue']) {
        const button = page.locator(`${selector}:visible`);
        if (await button.count() === 1) { await button.click(); row.actions.push(selector); }
      }
      const card = page.locator(`.decision-card[data-home-petition="road_bridge"][data-petition="${petitionId}"]:visible`);
      if (!await card.count()) {
        const chip = page.locator('.event-chip[data-story="home_petition"]:visible');
        if (await chip.count() === 1) {
          await chip.click({ timeout: 10000 }); row.actions.push('open-home-petition-chip');
          const decide = page.locator('.event-card[data-story="home_petition"] .event-card-decide:visible');
          if (await decide.count() === 1) { await decide.click(); row.actions.push('decide-home-petition'); }
        }
      }
      await card.waitFor({ timeout: 10000 });
      row.beforeCardTitle = await card.locator('h2').innerText();
      row.beforeCardText = await card.innerText();
      assert.equal(row.beforeCardTitle, variant.title);
      assert(row.beforeCardText.includes(variant.body));
      assert.equal(jsonSha(await proof()), row.initialStateSha256, 'Opening card cannot advance or mutate state');
      await screenshot('offered');
      const button = card.locator(`[data-choose="${choice.id}"]`);
      assert.equal(await button.count(), 1); assert.equal(await button.isEnabled(), true);
      await button.click(); row.actions.push(`choose:${choice.id}`);
      const receipt = page.locator(`.answer-receipt[data-subject="${petitionId}"]:visible`);
      await receipt.waitFor({ timeout: 10000 });
      row.receiptText = await receipt.innerText(); await screenshot('receipt');
      const after = await proof();
      assert.equal(after.tick, initial.tick, 'Paused UI answer must not advance ticks');
      const petition = after.stewardship?.petitions.find(item => item.id === petitionId);
      assert.equal(petition?.status, choice.id === 'grant' ? 'granted' : 'refused');
      assert.equal(petition?.decidedBy, 'lord');
      const previousIds = new Set((initial.history?.records ?? []).map(record => record.id));
      const newDecisions = (after.history?.records ?? []).filter(record => record.kind === 'decision' && !previousIds.has(record.id));
      assert.equal(newDecisions.length, 1, 'Exact new answer history record required');
      row.answerRecord = newDecisions[0]; row.answerId = newDecisions[0].id;
      row.traceDecision = after.trace?.decisions.find(item => item.id === row.answerId) ?? null;
      assert.equal(row.traceDecision?.source, `manor_petition:road_bridge:${petition.status}`);
      row.afterStateSha256 = jsonSha(after); row.changes = difference(initial, after);
      row.changedTopLevelKeys = [...new Set(row.changes.map(change => change.path.split('/')[1]))];
      writeFileSync(join(out, `056-${choice.id}-answered-state.json.gz`), gzipSync(JSON.stringify(after), { level: 9 }));
      const results = yearResults(after);
      const yearStartTick = after.tick - after.tick % BALANCE.TICKS_PER_YEAR;
      row.allTimeRows = traceInRange(after, 0, after.tick + 1).filter(item => item.decisionId === row.answerId);
      row.yearRows = traceInRange(after, yearStartTick, after.tick + 1).filter(item => item.decisionId === row.answerId);
      row.group = traceGroups(after, row.yearRows).find(item => item.decisionId === row.answerId) ?? null;
      row.yearItem = results?.items.find(item => item.decisionId === row.answerId) ?? null;
      row.readerReason = row.yearItem ? 'included' : !row.allTimeRows.length ? 'no_trace_yet_at_answer'
        : !row.yearRows.length ? 'outside_current_year' : row.group?.by === 'steward' ? 'steward_excluded' : 'reader_exclusion';
      await receipt.locator('.answer-receipt-close').click(); row.actions.push('close-answer-receipt');
      const chip = page.locator('.event-chip[data-story="decision_trace"]:visible');
      if (results) await chip.waitFor({ timeout: 3000 }).catch(() => undefined);
      row.chipCount = await chip.count(); row.targetCaptured = false;
      if (row.chipCount === 1) {
        row.chipTitle = await chip.innerText(); row.chipId = await chip.getAttribute('data-chip-id');
        assert(results); assert.equal(row.chipTitle, RESULTS_COPY.trace.yearChip(results.count));
        assert.equal(row.chipId, `results:${results.year}`);
        await screenshot('year-chip');
        await chip.click({ timeout: 10000 }); row.actions.push('open-year-results-chip');
        const resultsCard = page.locator('.event-card[data-story="decision_trace"]:visible');
        await resultsCard.waitFor({ timeout: 10000 });
        row.cardText = await resultsCard.innerText(); row.facts = await resultsCard.locator('.event-card-facts li').allTextContents();
        row.expectedFact = row.yearItem ? RESULTS_COPY.trace.yearItem(row.yearItem.title, row.yearItem.count) : null;
        row.targetCaptured = row.expectedFact !== null && row.facts.includes(row.expectedFact);
        await screenshot('year-card');
      } else await screenshot('no-year-chip');
      row.finalStateSha256 = jsonSha(await proof());
      assert.equal(row.finalStateSha256, row.afterStateSha256, 'Receipt/results navigation cannot mutate the answered state');
      row.status = row.targetCaptured ? 'captured' : row.yearItem ? 'reader-included-but-screen-missing' : row.readerReason;
      if (row.yearItem && !row.targetCaptured) row.errors.push('LS1-4 reader includes answer, but actual screen did not capture it');
    } catch (error) {
      row.errors.push(String(error)); row.status = 'verification-failed';
      if (page) {
        await screenshot('failure').catch(captureError => row.errors.push(`Screenshot: ${String(captureError)}`));
        await proof().then(current => {
          row.failureStateSha256 = jsonSha(current); row.failureTick = current.tick;
          writeFileSync(join(out, `056-${choice.id}-failure-state.json.gz`), gzipSync(JSON.stringify(current), { level: 9 }));
        }).catch(proofError => row.errors.push(`Failure proof: ${String(proofError)}`));
      }
    } finally { if (context) await context.close().catch(error => row.errors.push(`Context close: ${String(error)}`)); saveReport(); }
  }
} catch (error) { report.errors.push(String(error)); }
finally { if (browser) await browser.close().catch(error => report.errors.push(`Browser close: ${String(error)}`)); }
report.pass = report.errors.length === 0 && report.rows.length > 0 && report.rows.every(row => row.errors.length === 0);
saveReport();
console.log(JSON.stringify({ pass: report.pass, rows: report.rows.map(row => ({ choice: row.choiceId, status: row.status, errors: row.errors })), errors: report.errors }));
if (!report.pass) process.exitCode = 1;
