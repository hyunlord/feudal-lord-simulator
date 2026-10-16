import { observeChipRail } from './chipRailObservation.mjs';
import { navigationStateSha256 as navSha, NAVIGATION_HASH_SCOPE } from './navigationState.mjs';
import { saveAdmissions } from './reviewedSaveAdmission.mjs';
// One genuine answer, normal UI time, and passive reads. No decision is answered by this observer.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

assert.equal(process.platform, 'linux', 'Game/browser execution belongs on DGX');
assert.equal(process.env.FLS_REMOTE, '1', 'Use the official remote runner');
const [input, out, url, requestedEntryId] = process.argv.slice(2);
const entryId = /^\d{3}$/.test(requestedEntryId ?? '') ? `ck_evt_${requestedEntryId}` : requestedEntryId;
assert.ok(input && out && url, 'Usage: tsx liveCase.mjs INPUT_CHECKPOINT_ROOT OUTPUT_DIR URL ENTRY_ID');
assert.equal(new URL(url).search, '', 'Use the default story delay; supply a bare base URL');
mkdirSync(out, { recursive: true });
const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url)));
const selected = cases.find(item => item.entryId === entryId);
assert.ok(selected, 'Case must be explicitly pinned in cases.json');
const contract = JSON.parse(readFileSync(new URL('../../design/engine-B-outcomes.json', import.meta.url)))
  .events.find(event => event.id === selected.entryId)?.choices.find(choice => choice.id === selected.choice);
assert.ok(contract, 'Exact chosen option must exist in the outcome contract');
assert.deepEqual(selected.contractOutcomeIds, contract.outcomes.filter(row => row.effectKind === 'conditional').map(row => row.id));
assert.ok(contract.outcomes.some(row => row.effectKind === 'conditional'
  && new RegExp(`^${row.target.traceTarget.replace(/<[^>]+>/g, '[^:]+')}$`).test(selected.expectedConsequence.target)),
'Expected result must belong to the actually chosen option, not another choice in the same event');
const ANSWER = selected.answerId, START = selected.startTick, LIMIT = selected.maximumTick;
const seedDirectory = join(input, `seed-${selected.seed}`);
const PRODUCT = '00125eb96838ea1143d496c41953159d631e6bd3';
const report = { navigationHashScope: NAVIGATION_HASH_SCOPE, trajectoryScope: 'resumed_old_input_under_new_rules', saveAdmissions, schemaVersion: 1, mode: 'one_historical_answer_current_UI_natural_10x', productRevision: PRODUCT,
  sourceRevision: '2485af40046793f1856829fa1161dc4431942aa7', entryId: selected.entryId, choice: selected.choice,
  answerId: ANSWER, startTick: START, maximumTick: LIMIT, defaultStoryDelay: true,
  historicalReference: { consequence: selected.consequence, originalObservationBound: selected.maximumTick, notCurrentEvidence: true },
  runtimeExpectation: { semantics: selected.expectedConsequence, observedEvidence: 'receipts and samples from this run only' },
  valid: false, automatic: null, manual: null, actions: [], states: [], samples: [], transitions: [],
  receipts: [], informationalContinues: [], resultNavigation: [], unansweredSuitContinues: [], errors: [],
  limits: ['Proof snapshots contain presentation walkers, not a raw store snapshot.',
    'This is one current-product replay from a genuine historical answer, not a fresh 125-year run.',
    'Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.',
    'A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.',
    'Historical consequence ID/tick is provenance only, never a required current outcome. The retained old bound is a limited diagnostic window; absence is not proof of impossibility under current rules.'] };
let browser, context, page, initialized = false;
const stateFiles = new Map();
const stateJson = () => page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));

async function snapshot(label) {
  const json = await stateJson(), digest = sha(json);
  let stateFile = stateFiles.get(digest);
  if (!stateFile) {
    stateFile = `${label}.state.json.gz`;
    writeFileSync(join(out, stateFile), gzipSync(json, { level: 9 }), { flag: 'wx' });
    stateFiles.set(digest, stateFile);
  }
  const screen = `${label}.jpg`;
  await page.screenshot({ path: join(out, screen), type: 'jpeg', quality: 55, timeout: 15000 });
  const item = { label, tick: JSON.parse(json).tick, sha256: digest, navigationSha256: navSha(json), stateFile,
    compressedSha256: sha(readFileSync(join(out, stateFile))), screen };
  report.states.push(item);
  return item;
}

// Native pointer input at a verified exposed centre; no force click or synthetic DOM dispatch.
async function press(selector) {
  const control = page.locator(selector);
  assert.equal(await control.count(), 1, `Unique control required: ${selector}`);
  assert.ok(await control.isVisible() && await control.isEnabled(), `Unavailable control: ${selector}`);
  const point = await control.evaluate(el => {
    const b = el.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2;
    const top = document.elementFromPoint(x, y);
    return b.width > 0 && b.height > 0 && x >= 0 && y >= 0 && x < innerWidth && y < innerHeight
      && top !== null && (el === top || el.contains(top)) ? { x, y } : null;
  });
  assert.ok(point, `Covered control: ${selector}`);
  await page.mouse.click(point.x, point.y);
  report.actions.push({ selector, input: 'native pointer click through normal UI', tick: (await sample()).tick });
}

async function sample() {
  const observation = await page.evaluate(({ answer, start, expected }) => {
    const state = window.__FEUDAL_PHASE10_PROOF__.state(), reads = window.__EB_WEIGHT_READS__;
    const from = state.tick - state.tick % reads.yearLength;
    const rows = reads.traceInRange(state, from, state.tick + 1).filter(row => row.decisionId === answer);
    const groups = reads.traceGroups(state, rows), results = reads.yearResults(state);
    const target = results?.items.find(item => item.decisionId === answer) ?? null;
    const probe = { tick: state.tick, timberOrder: state.timberOrder ?? 0,
      suits: state.estates?.suits ?? [], audits: state.stewardship?.audits ?? [] };
    const previous = window.__EB_WEIGHT_PREVIOUS_PROBE__;
    window.__EB_WEIGHT_PREVIOUS_PROBE__ = probe;
    window.__EB_WEIGHT_ACTUAL__ ??= new Map();
    const receipts = (state.history?.records ?? []).filter(record => !window.__EB_WEIGHT_INITIAL_IDS__.has(record.id)
      && record.kind !== 'decision' && record.tick > start && record.because?.some(cause => cause.decisionId === answer))
      .map(record => {
        const p = record.params;
        const semanticMatch = record.template === expected.template && p?.key === expected.key
          && p.target === expected.target && (!expected.category || p.category === expected.category);
        if (semanticMatch && !window.__EB_WEIGHT_ACTUAL__.has(record.id)) {
          let evidence = null;
          if (p.key === 'payment_flow') {
            const entries = (state.ledger?.entries ?? []).filter(row => row.tick === record.tick && row.category === p.category && row.amount !== 0);
            const income = entries.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
            const expense = entries.reduce((sum, row) => sum - Math.min(0, row.amount), 0);
            if (income + expense > 0 && income === p.income && expense === p.expense) evidence = { kind: 'actual_ledger_postings', entries, income, expense };
          } else if (previous && previous.tick < record.tick) {
            if (p.key === 'goods_delivered' && p.brought > 0 && previous.timberOrder - probe.timberOrder === p.brought)
              evidence = { kind: 'actual_order_decrease', before: previous.timberOrder, after: probe.timberOrder, delta: -p.brought };
            if (p.key === 'suit_turned') {
              const id = p.target.slice('suit:'.length), before = previous.suits.find(row => row.id === id), after = probe.suits.find(row => row.id === id);
              if (before && after && after.stage === p.stage && (p.verdict === undefined || after.verdict === p.verdict)
                && (before.stage !== after.stage || before.verdict !== after.verdict || before.enforced !== after.enforced))
                evidence = { kind: 'actual_suit_transition', before, after };
            }
            if (p.key === 'audit') {
              const audits = probe.audits.filter(row => !previous.audits.some(old => old.id === row.id)
                && `estate:${row.estateId}` === p.target && row.status === p.status && row.revealedKept + row.revealedErrors === p.revealed);
              if (audits.length === 1) evidence = { kind: 'actual_new_audit_result', audit: audits[0] };
            }
          }
          if (evidence) window.__EB_WEIGHT_ACTUAL__.set(record.id, evidence);
        }
        return { id: record.id, tick: record.tick, kind: record.kind, template: record.template,
          params: record.params, because: record.because, semanticMatch,
          actualEvidence: window.__EB_WEIGHT_ACTUAL__.get(record.id) ?? null };
      });
    const visible = el => {
      const b = el.getBoundingClientRect(), style = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const exposed = el => {
      if (!visible(el)) return false;
      const b = el.getBoundingClientRect(), top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight
        && top !== null && (el === top || el.contains(top));
    };
    const chips = [...document.querySelectorAll('.event-chip[data-story="decision_trace"]')].map(el => ({
      id: el.getAttribute('data-chip-id'), text: el.textContent?.trim(), visible: visible(el), exposed: exposed(el) }));
    const panels = [...document.querySelectorAll('[role="dialog"]')].filter(visible).map(el => {
      const yearReview = el.className === 'story-modal petition-card results-card year-review';
      const controls = [...el.querySelectorAll(yearReview ? 'button.results-card-continue' : 'button.season-ledger-resume')];
      return { className: el.className, season: el.getAttribute('data-season'), year: el.getAttribute('data-year-review'), text: el.textContent?.slice(0, 700),
        continueCount: controls.length, continueAvailable: controls.length === 1 && !controls[0].disabled && (yearReview || exposed(controls[0])) };
    });
    return { tick: state.tick, yearStartTick: from, receipts, targetRows: rows, targetGroups: groups,
      results, target, expectedChipText: results ? reads.copy.trace.yearChip(results.count) : null,
      expectedFact: target ? reads.copy.trace.yearItem(target.title, target.count) : null, chips, panels,
      targetDecisionPresent: state.history?.records.some(row => row.id === answer) ?? false,
      automaticCardOpen: [...document.querySelectorAll('.event-card[data-story="decision_trace"]')].some(visible),
      paused: document.querySelector('.speed-seal[data-seal="pause"]')?.getAttribute('aria-pressed') === 'true',
      ten: document.querySelector('.speed-seal[data-seal="fast"] [data-step="10"]')?.getAttribute('data-on') === 'true',
      autoplayOff: document.querySelector('.autoplay-control > button')?.getAttribute('aria-pressed') === 'false' };
  }, { answer: ANSWER, start: START, expected: selected.expectedConsequence });
  await observeChipRail(page, report, observation.target ? `results:${observation.results.year}` : null, 'sample');
  return observation;
}

function automaticMatch(observation) {
  if (!observation.results || !observation.target) return null;
  if (report.initial.results?.year === observation.results.year
    && report.initial.chips.some(chip => chip.id === `results:${observation.results.year}` && chip.visible)
    && report.initial.results.count === observation.results.count) return null;
  const chips = observation.chips.filter(chip => chip.exposed && chip.id === `results:${observation.results.year}`
    && chip.text === observation.expectedChipText);
  if (chips.length !== 1) return null;
  const links = observation.receipts.filter(receipt => receipt.semanticMatch && receipt.actualEvidence).flatMap(receipt => observation.targetRows.filter(row => row.recordId === receipt.id
    && row.tick === receipt.tick && row.decisionTick === START && receipt.tick <= observation.tick
    && receipt.because.some(cause => cause.decisionId === ANSWER && cause.key === row.key && (cause.part === true) === row.part)));
  const group = observation.targetGroups.find(item => item.decisionId === ANSWER && item.by !== 'steward');
  if (!links.length || !group || observation.target.count !== group.rows.length) return null;
  return { observedTick: observation.tick, evidenceKind: 'automatic_yearly_aggregation', chip: chips[0],
    results: observation.results, target: observation.target, expectedFact: observation.expectedFact, exactNewRows: links,
    automaticCardOpen: observation.automaticCardOpen };
}

function informational(observation) {
  const panel = observation.panels[0];
  return observation.panels.length === 1 && panel.continueCount === 1 && panel.continueAvailable
    && ((panel.className === 'season-ledger-card' && /^(\d+):([0-3])$/.test(panel.season ?? ''))
      || (panel.className === 'story-modal petition-card results-card year-review' && /^\d{4}$/.test(panel.year ?? '')));
}

async function continueInformation(observation) {
  assert.ok(report.informationalContinues.length < 16, 'Bounded informational-report limit');
  const before = await snapshot(`information-${report.informationalContinues.length + 1}`);
  const isYear = observation.panels[0].year !== null;
  const selector = isYear ? '.results-card.year-review .results-card-continue' : '.season-ledger-card button.season-ledger-resume';
  if (isYear) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const exposed = await page.locator(selector).evaluate(el => {
        const b = el.getBoundingClientRect(), top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return b.top >= 0 && b.bottom <= innerHeight && top !== null && el.contains(top);
      });
      if (exposed) break;
      const box = await page.locator('.results-card.year-review .results-card-body').boundingBox(); assert.ok(box);
      await page.mouse.move(box.x + box.width / 2, Math.min(700, box.y + box.height / 2));
      await page.mouse.wheel(0, 400); await page.clock.runFor(64);
      assert.equal(navSha(await stateJson()), before.navigationSha256, 'Year report scroll changed state');
    }
  }
  await press(selector);
  const after = await stateJson();
  assert.equal(navSha(after), before.navigationSha256, 'Informational Continue changed presentation state');
  const resumed = await sample();
  assert.equal(resumed.tick, observation.tick, 'Informational Continue advanced time');
  assert.equal(resumed.panels.length, 0, 'Another dialog followed the informational report');
  report.informationalContinues.push({ tick: observation.tick, season: observation.panels[0].season, year: observation.panels[0].year,
    beforeSha256: before.navigationSha256, afterSha256: navSha(after), rawBeforeSha256: before.sha256, rawAfterSha256: sha(after) });
}

// Normal Later leaves the offer unanswered; its deadline continues on the natural path.
async function deferCoveringRegistryCard(observation) {
  const selector = '.story-modal[data-registry-offer] .story-modal-later';
  const control = page.locator(selector);
  if (observation.panels.length !== 1 || !observation.paused || await control.count() !== 1) return false;
  assert.ok(report.resultNavigation.length < 16, 'Bounded registry deferral count');
  const number = report.resultNavigation.length + 1;
  const offer = await page.locator('.story-modal[data-registry-offer]').getAttribute('data-registry-offer');
  const pending = await page.evaluate(async () => {
    const { openRegistryOffers } = await import('/src/engine/registry.ts');
    return openRegistryOffers(window.__FEUDAL_PHASE10_PROOF__.state());
  });
  assert.ok(pending.some(row => row.entryId === offer), 'Deferral requires a genuine current offer');
  const before = await snapshot(`registry-covered-${number}`);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const point = await control.evaluate(el => {
      const b = el.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      const top = document.elementFromPoint(x, y);
      return b.top >= 0 && b.bottom <= innerHeight && top && el.contains(top);
    });
    if (point) break;
    const body = page.locator('.story-modal[data-registry-offer] .decision-card-body');
    const box = await body.boundingBox(); assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, Math.min(700, box.y + box.height / 2));
    await page.mouse.wheel(0, 400); await page.clock.runFor(64);
    assert.equal(navSha(await stateJson()), before.navigationSha256, 'Deferred-card scroll changed state');
  }
  await press(selector);
  const after = await snapshot(`registry-after-later-${number}`);
  assert.equal(after.navigationSha256, before.navigationSha256, 'Normal Later changed game state');
  assert.equal((await sample()).tick, observation.tick, 'Later advanced time before the next clock sample');
  assert.equal((await sample()).panels.length, 0, 'Another dialog followed Later');
  report.resultNavigation.push({ kind: 'normal_registry_later_without_answer', offer, pending,
    beforeSha256: before.navigationSha256, afterSha256: after.navigationSha256, rawBeforeSha256: before.sha256, rawAfterSha256: after.sha256, coveredObservation: observation,
    policy: 'No choice selected; normal time may expire this unanswered offer.' });
  return true;
}

async function continueUnansweredNotice(observation) {
  const notice = '.auto-pause-notice[data-mode="stopped"]';
  const selector = `${notice} .auto-pause-resume`;
  if (!observation.paused || observation.panels.length || await page.locator(selector).count() !== 1) return false;
  const rawReasons = await page.locator(notice).getAttribute('data-reasons');
  const reasons = rawReasons?.split(/\s+/).filter(Boolean) ?? [];
  const allowed = new Set(['counter_offer', 'major_death', 'inheritance', 'judgment', 'rights_petition',
    'estate_crisis', 'estate_gained', 'estate_lost', 'will_change', 'contested', 'suit_defence', 'entry_threat']);
  if (!reasons.length || reasons.some(reason => !allowed.has(reason))) return false;
  assert.ok(await page.locator(selector).isVisible(), 'Stopped notice Continue must be visible');
  assert.ok(report.unansweredSuitContinues.length < 16, 'Bounded unanswered-notice continuation count');
  const matters = await page.evaluate(async () => {
    const { lordMattersDue } = await import('/src/engine/lordDue.ts');
    return lordMattersDue(window.__FEUDAL_PHASE10_PROOF__.state());
  });
  const before = await snapshot(`unanswered-notice-${report.unansweredSuitContinues.length + 1}`);
  const text = await page.locator(notice).innerText();
  await press(selector);
  const after = await stateJson();
  assert.equal(navSha(after), before.navigationSha256, 'Notice Continue changed state before normal clock progression');
  assert.equal(JSON.parse(after).tick, observation.tick);
  report.unansweredSuitContinues.push({ tick: observation.tick, rawReasons, reasons, matters, text,
    beforeSha256: before.navigationSha256, afterSha256: navSha(after), rawBeforeSha256: before.sha256, rawAfterSha256: sha(after),
    policy: 'Continue normal time without answering any pending matter; all deadlines still run. Event notices may have no pending matter.' });
  await selectTen();
  return true;
}

async function selectTen() {
  for (let attempt = 0; attempt < 2 && !(await sample()).ten; attempt += 1) await press('.speed-seal[data-seal="fast"]');
  const observed = await sample();
  assert.ok(observed.ten && !observed.paused && observed.autoplayOff, 'Normal 10x required; autoplay must stay off');
}

try {
  report.toolRevision = git('rev-parse', 'HEAD');
  assert.equal(git('diff', PRODUCT, 'HEAD', '--', 'src', 'package.json', 'package-lock.json'), '', 'Product source must match the agreed revision');
  const manifestBytes = readFileSync(join(seedDirectory, 'manifest.json'));
  const pinnedManifestBytes = readFileSync(join(repo, selected.manifestFile));
  assert.equal(sha(manifestBytes), sha(pinnedManifestBytes), 'Remote manifest must match retained original bytes');
  const pair = JSON.parse(manifestBytes).pairs.find(row => row.entryId === selected.entryId);
  assert.deepEqual(pair.answer, selected.answer);
  assert.equal(pair.decisionId, ANSWER);
  assert.equal(pair.decisionTick, START);
  assert.equal(basename(pair.answer.file), pair.answer.file);
  const compressed = readFileSync(join(seedDirectory, pair.answer.file));
  assert.equal(compressed.length, pair.answer.bytes);
  assert.equal(sha(compressed), pair.answer.fileSha256);
  const raw = gunzipSync(compressed);
  assert.equal(sha(raw), pair.answer.encodedSaveSha256);
  const [{ decodeSave }, { withResidentWalkers }, { loadChromium }, scene] = await Promise.all([
    import('./reviewedSaveAdmission.mjs'), import('../../../src/render/presentation/residentWalkerState.ts'),
    import('../../../scripts/renderCommitProbe.mjs'), import('../../../scripts/sceneInjection.mjs')]);
  const original = JSON.parse(raw), decoded = decodeSave(raw), state = decoded.envelope.state;
  assert.equal(state.seed, selected.seed); assert.equal(state.tick, START);
  assert.equal(state.trace.decisions.find(row => row.id === ANSWER)?.source, selected.source);
  report.input = { manifestSha256: sha(manifestBytes), answer: pair.answer, decisionId: pair.decisionId,
    rawSchemaVersion: original.schemaVersion, currentSchemaVersion: decoded.envelope.schemaVersion,
    rawStateSha256: sha(JSON.stringify(original.state)), decodedStateSha256: sha(JSON.stringify(state)),
    changedTopLevelKeys: [...new Set([...Object.keys(original.state), ...Object.keys(state)])]
      .filter(key => JSON.stringify(original.state[key]) !== JSON.stringify(state[key])).sort() };
  browser = await (await loadChromium()).launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'ko-KR' });
  page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.clock.install();
  await context.addInitScript("globalThis.__name ??= target => target; localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));");
  await page.routeWebSocket('**', socket => socket.close());
  await scene.routeSceneState(page, raw.toString('utf8'));
  const refused = scene.sceneStateRefusal(page);
  await page.goto(`${url}?phase10-proof=1`, { timeout: 90000 });
  await Promise.race([page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 90000 }), refused]);
  initialized = true;
  await page.evaluate(async () => {
    const [reads, thread, years, words, config] = await Promise.all([import('/src/engine/decisionReads.ts'),
      import('/src/ui/results/decisionThread.ts'), import('/src/ui/results/yearResults.ts'),
      import('/src/ui/results/resultsCopy.ko.ts'), import('/src/content/balanceConfig.ts')]);
    window.__EB_WEIGHT_READS__ = { traceInRange: reads.traceInRange, traceGroups: thread.traceGroups,
      yearResults: years.yearResults, copy: words.RESULTS_COPY, yearLength: config.BALANCE.TICKS_PER_YEAR };
    window.__EB_WEIGHT_INITIAL_IDS__ = new Set(window.__FEUDAL_PHASE10_PROOF__.state().history.records.map(row => row.id));
  });
  report.expectedPresentationSha256 = sha(JSON.stringify(withResidentWalkers(state)));
  const initial = await snapshot('initial');
  assert.equal(initial.sha256, report.expectedPresentationSha256, 'Initial presentation differs from the genuine codec-admitted save');
  if (await page.locator('.welcome-dismiss-layer').isVisible()) await press('.welcome-dismiss-layer');
  assert.ok((await sample()).paused && (await sample()).autoplayOff, 'Initial game must be paused with autoplay off');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.clock.runFor(32);
  assert.equal(sha(await stateJson()), initial.sha256, 'Pre-input state drift');
  report.initial = await sample();
  if (informational(report.initial)) await continueInformation(report.initial);
  if ((await sample()).panels.length) report.stop = 'pre_input_substantive_or_unknown_dialog';
  else {
    await selectTen();
    const started = Date.now(); let previousTick = START, signature = '';
    for (let frame = 0; frame < 160000 && Date.now() - started < 900000; frame += 1) {
      // Stop a few ticks early rather than risk a normal 10x frame crossing the pinned tick ceiling.
      if (previousTick >= LIMIT - 4) { report.stop = 'bounded_original_first_result_plus_200_ticks'; break; }
      await page.clock.runFor(16);
      let observation = await sample();
      assert.ok(observation.tick >= previousTick && observation.tick <= LIMIT, 'Observed tick reversal/overshoot');
      assert.ok(observation.autoplayOff, 'Autoplay was enabled');
      report.samples.push([frame, observation.tick, observation.paused, observation.ten, observation.results?.count ?? 0,
        observation.target?.count ?? 0, observation.receipts.length, observation.panels.length]);
      const nextSignature = JSON.stringify([observation.paused, observation.ten, observation.chips, observation.panels,
        observation.targetRows, observation.results?.count]);
      if (signature !== nextSignature) { report.transitions.push({ frame, ...observation }); signature = nextSignature; }
      if (!report.receipts.length && observation.receipts.length) await snapshot('first-exact-receipt');
      report.receipts = observation.receipts;
      if (observation.tick > previousTick && observation.ten) report.progressAtTen = true;
      if (observation.panels.length && !informational(observation)) {
        if (await deferCoveringRegistryCard(observation)) { await selectTen(); observation = await sample(); }
        else { report.stop = 'substantive_or_unknown_intervention_required'; break; }
      }
      const match = observation.panels.length === 0 ? automaticMatch(observation) : null;
      if (match) {
        report.automatic = { ...match, initialCount: report.initial.results?.count ?? 0,
          initialTargetCount: report.initial.target?.count ?? 0,
          countChangedFromInitial: report.initial.results?.count !== match.results.count,
          chipExistedInitially: report.initial.chips.some(chip => chip.id === match.chip.id && chip.visible) };
        await snapshot('automatic-chip'); report.stop = 'new_exact_result_in_automatic_year_chip'; break;
      }
      if (informational(observation)) {
        await continueInformation(observation); await selectTen();
        assert.equal((await sample()).tick, observation.tick, 'Resume advanced time outside the clock sampler');
      } else if (observation.paused) {
        if (!await continueUnansweredNotice(observation)) { report.stop = 'substantive_or_unknown_intervention_required'; break; }
      } else assert.ok(observation.ten, '10x was no longer selected');
      previousTick = observation.tick;
    }
    report.stop ??= 'frame_or_wall_time_bound';
  }
  if (report.automatic) {
    const beforePause = await snapshot('before-manual');
    if (!(await sample()).paused) await press('.speed-seal[data-seal="pause"]');
    assert.ok((await sample()).paused, 'Normal pause control did not pause');
    await page.clock.runFor(32);
    assert.equal(navSha(await stateJson()), beforePause.navigationSha256, 'Pause changed presentation state');
    await press(`.event-chip[data-story="decision_trace"][data-chip-id="${report.automatic.chip.id}"]`);
    await page.clock.runFor(32);
    const card = page.locator('.event-card[data-story="decision_trace"]:visible');
    assert.equal(await card.count(), 1, 'Exactly one actual yearly results card required');
    const facts = await card.locator('.event-card-facts li').allTextContents();
    const visibleFacts = await card.locator('.event-card-facts li').evaluateAll(elements => elements.map(el => {
      const b = el.getBoundingClientRect(), style = getComputedStyle(el), top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return { text: el.textContent, exposed: b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0
        && b.right <= innerWidth && b.bottom <= innerHeight && style.display !== 'none' && style.visibility !== 'hidden'
        && top !== null && (el === top || el.contains(top)) };
    }));
    const after = await snapshot('manual-card');
    report.manual = { facts, visibleFacts, expectedFact: report.automatic.expectedFact,
      targetCaptured: visibleFacts.filter(row => row.text === report.automatic.expectedFact).length === 1
        && visibleFacts.some(row => row.text === report.automatic.expectedFact && row.exposed),
      beforeSha256: beforePause.navigationSha256, afterSha256: after.navigationSha256, rawBeforeSha256: beforePause.sha256, rawAfterSha256: after.sha256, stateUnchanged: beforePause.navigationSha256 === after.navigationSha256 };
    assert.ok(report.manual.targetCaptured && report.manual.stateUnchanged, 'Actual card or navigation-state invariant failed');
  }
  report.final = await sample();
  report.absence = report.automatic ? null : !report.receipts.length ? 'no_new_exact_because_result_in_observed_window'
    : !report.receipts.some(row => row.semanticMatch) ? 'expected_result_semantics_not_observed'
      : !report.receipts.some(row => row.semanticMatch && row.actualEvidence) ? 'actual_effect_evidence_missing'
    : !report.final.targetDecisionPresent ? 'target_decision_record_missing'
      : !report.final.targetRows.length ? 'new_result_outside_current_year_or_not_exposed_by_trace_read'
        : report.final.targetGroups.some(group => group.by === 'steward') ? 'steward_excluded'
          : !report.final.target ? 'trace_rows_not_in_year_results'
            : 'canonical_membership_exists_but_matching_uncovered_chip_not_observed';
  await snapshot('final');
  report.valid = Boolean(report.automatic && report.manual?.targetCaptured && report.manual.stateUnchanged
    && report.progressAtTen && report.errors.length === 0);
} catch (error) {
  report.errors.push(String(error));
  if (initialized) {
    try { report.failureObservation = await sample(); await snapshot('failure'); }
    catch (captureError) { report.errors.push(`Failure capture: ${captureError}`); }
  }
} finally {
  if (context) await context.close().catch(error => report.errors.push(`Context close: ${error}`));
  if (browser) await browser.close().catch(error => report.errors.push(`Browser close: ${error}`));
  if (report.errors.length) report.valid = false;
  report.sampleColumns = ['frame', 'tick', 'paused', 'ten', 'yearCount', 'targetCount', 'newExactReceipts', 'dialogs'];
  writeFileSync(join(out, 'live-case.json'), `${JSON.stringify(report, null, 2)}\n`);
}
process.exitCode = report.valid ? 0 : 1;
