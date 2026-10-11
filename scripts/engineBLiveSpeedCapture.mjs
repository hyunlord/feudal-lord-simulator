// Bounded evidence tooling: one original answer, normal UI controls, no bot or direct engine tick.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withResidentWalkers } from '../src/render/presentation/residentWalkerState.ts';
import { readCheckpoints, presentationDifference } from './engineBVisibleCapture.mjs';
import { assertAutoplayDisabled, playwrightProvenance, stopOwnedServer, startOwnedServer } from './engineBSeasonReportCapture.mjs';
import { loadChromium } from './renderCommitProbe.mjs';
import { routeSceneState, sceneStateRefusal } from './sceneInjection.mjs';
import { refuseHeavyOnMac } from './remote/localGuard.mjs';
import { createTraceThreadEvidence, isInformationalSeasonLedger } from './engineBLiveThreadEvidence.mjs';
const SOURCE = '2485af40046793f1856829fa1161dc4431942aa7';
const MANIFEST = 'e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d';
const ANSWER = 'h-002653', START = 40015, LIMIT = START + 3000;
const check = (condition, message) => { if (!condition) throw new Error(message); };
const sha = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const save = (out, name, value) => writeFileSync(join(out, name), `${JSON.stringify(value)}\n`, { flag: 'wx' });

/** Keeps receipt identities separate from independently observed automatic presentation identities. */
export function createLiveReceiptEvidence(answerId, answerTick, span, initialIds) {
  const known = new Set(initialIds), receipts = new Map(), visible = new Map();
  let lastTick = answerTick;
  return {
    observe(tick, rows, presentations) {
      check(Number.isSafeInteger(tick) && tick >= lastTick && tick <= answerTick + span, 'Observed tick reversal/overshoot');
      lastTick = tick;
      for (const row of rows) {
        if (known.has(row.id)) continue;
        known.add(row.id);
        if (row.kind !== 'decision' && row.tick > answerTick && row.tick <= tick && row.tick <= answerTick + span
          && row.because?.some(cause => cause.decisionId === answerId)) receipts.set(row.id, { id: row.id, tick: row.tick, because: row.because });
      }
      for (const item of presentations) if (item.origin === 'automatic' && receipts.has(item.recordId) && !visible.has(item.recordId)) visible.set(item.recordId, { ...item, observedTick: tick });
    },
    snapshot: () => ({ receipts: [...receipts.values()], automaticPresentations: [...visible.values()], automaticVisible: visible.size > 0,
      lastTick }),
  };
}
export function shouldDismissInformationalSeasonLedger(observation) {
  return isInformationalSeasonLedger(observation?.panels);
}
async function press(page, selector, evidence) {
  const control = typeof selector === 'string' ? page.locator(selector) : selector;
  check(await control.count() === 1 && await control.isVisible() && await control.isEnabled(), `Unavailable unique control: ${selector}`);
  await control.scrollIntoViewIfNeeded();
  check(await control.evaluate(el => { const b = el.getBoundingClientRect(), top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return top !== null && (el === top || el.contains(top)); }), `Covered control: ${selector}`);
  await control.dispatchEvent('click'); evidence.actions.push({ selector: typeof selector === 'string' ? selector : String(selector), input: 'synthetic DOM click through normal handler' });
}
async function verifyNormalScrollInput(browser, out) {
  const context = await browser.newContext({ viewport: { width: 640, height: 480 } });
  const page = await context.newPage();
  const evidence = { valid: false, actions: [], cases: [] };
  try {
    await page.setContent('<div id="scroller" style="position:absolute;top:80px;left:40px;width:300px;height:100px;overflow:auto"><div style="height:180px"></div><button id="below" style="height:40px">Below viewport</button><div style="height:100px"></div><button id="partial" style="height:40px">Partially clipped</button><div style="height:200px"></div></div>');
    await page.evaluate(() => { for (const button of document.querySelectorAll('button')) button.addEventListener('click', () => { button.dataset.clicked = 'true'; }); });
    for (const id of ['below', 'partial']) {
      if (id === 'partial') await page.evaluate(() => {
        const box = document.querySelector('#scroller'), button = document.querySelector('#partial');
        box.scrollTop += button.getBoundingClientRect().top - box.getBoundingClientRect().top - 80;
      });
      const before = await page.locator('#scroller').evaluate(el => el.scrollTop);
      await page.screenshot({ path: join(out, `scroll-fixture-${id}-before.png`) });
      await press(page, `#${id}`, evidence);
      const after = await page.locator('#scroller').evaluate(el => el.scrollTop);
      check(after !== before && await page.locator(`#${id}`).getAttribute('data-clicked') === 'true', `Normal scrolling did not expose/click ${id}`);
      evidence.cases.push({ id, beforeScrollTop: before, afterScrollTop: after, clicked: true });
      await page.screenshot({ path: join(out, `scroll-fixture-${id}-after.png`) });
    }
    evidence.valid = true; return evidence;
  } finally { await context.close(); }
}
async function fullSnapshot(page, out, label) {
  const json = await page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));
  writeFileSync(join(out, `${label}.json`), json, { flag: 'wx' });
  await page.screenshot({ path: join(out, `${label}.png`) });
  return { state: JSON.parse(json), sha256: sha(json) };
}
// Install a passive browser-local identity set, never written into GameState or used by gameplay.
async function sample(page) {
  return page.evaluate(() => {
    const state = window.__FEUDAL_PHASE10_PROOF__.state();
    const seen = window.__EB_LIVE_HISTORY_IDS__;
    const records = [];
    for (const row of state.history?.records ?? []) if (!seen.has(row.id)) {
      seen.add(row.id); records.push({ id: row.id, tick: row.tick, kind: row.kind, because: row.because ?? [] });
    }
    const visible = el => { const b = el.getBoundingClientRect(), style = getComputedStyle(el); return b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && style.visibility !== 'hidden' && style.display !== 'none'; };
    const exposed = el => { if (!visible(el)) return false; const b = el.getBoundingClientRect(), top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return top !== null && (el === top || el.contains(top)); };
    const chips = [...document.querySelectorAll('.event-chip[data-chip-id], .event-card[data-chip-id]')].filter(exposed)
      .map(el => ({ chipId: el.getAttribute('data-chip-id'), text: el.textContent, tag: el.tagName }));
    const presentations = chips.filter(row => row.chipId.startsWith('lord-moment:h-')).map(row => ({ ...row, recordId: row.chipId.slice('lord-moment:'.length), origin: 'automatic' }));
    const panels = [...document.querySelectorAll('[role="dialog"]')].filter(el => { const b = el.getBoundingClientRect(), style = getComputedStyle(el); return b.width > 0 && b.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'; }).map(el => {
      const controls = [...el.querySelectorAll('button.season-ledger-resume')];
      return { className: el.className, text: el.textContent?.slice(0, 1000), season: el.getAttribute('data-season'),
        continueCount: controls.length, continueAvailable: controls.length === 1 && !controls[0].disabled && exposed(controls[0]) };
    });
    const reads = window.__EB_LIVE_READ_MODELS__, from = state.tick - state.tick % reads.seasonLength;
    return { tick: state.tick, records, chips, presentations, panels,
      traceRows: reads.traceInRange(state, from, state.tick + 1), traceNews: reads.traceNews(state),
      paused: document.querySelector('.speed-seal[data-seal="pause"]')?.getAttribute('aria-pressed') === 'true',
      ten: document.querySelector('.speed-seal[data-seal="fast"] [data-step="10"]')?.getAttribute('data-on') === 'true' };
  });
}
export function manualReceiptTarget(receipts, threads) {
  return receipts.automaticPresentations[0]?.recordId ?? threads?.threadPresentations?.[0]?.receiptId ?? receipts.receipts[0]?.id;
}
async function manualTrace(page, out, evidence, target, tick) {
  const result = { attempted: true, verified: false, targetId: target, answerId: ANSWER };
  evidence.manualDiscovery = result;
  const settle = async () => {
    await page.clock.runFor(32);
    check(await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick) === tick, 'Tick advanced during paused manual navigation');
  };
  const before = await fullSnapshot(page, out, 'manual-before-keyc');
  await page.keyboard.press('KeyC'); evidence.actions.push({ input: 'KeyC independent manual chronicle; no decision dismissed or answered' }); await settle();
  const after = await fullSnapshot(page, out, 'manual-after-keyc');
  const identity = state => ({ tick: state.tick, occurrences: state.registry?.occurrences ?? [],
    decisions: (state.history?.records ?? []).filter(row => row.kind === 'decision') });
  result.navigation = { beforeSha256: before.sha256, afterSha256: after.sha256,
    before: identity(before.state), after: identity(after.state),
    stateUnchanged: before.sha256 === after.sha256, chronicleVisible: await page.locator('.chronicle-screen').isVisible(),
    panels: (await sample(page)).panels };
  check(result.navigation.stateUnchanged, 'Manual KeyC changed presentation state');
  check(result.navigation.chronicleVisible, 'Manual chronicle did not open; current decision was preserved');
  const year = String(1300 + Math.floor(START / 4000));
  for (const [label, option] of [['중요도', '모든 기록'], ['부터', year], ['까지', year]]) {
    await press(page, page.locator('.chronicle-screen').getByRole('button', { name: new RegExp(`^${label}:`) }), evidence);
    const optionControl = page.getByRole('listbox', { name: label, exact: true }).getByRole('option', { name: option, exact: true });
    await press(page, optionControl, evidence); await settle();
  }
  const list = page.locator('.chronicle-list'); check(await list.count() === 1, 'Unique chronicle list required');
  await list.evaluate(el => { el.scrollTop = 0; });
  const answer = `.chronicle-card[data-record="${ANSWER}"] .chronicle-card-body`;
  let found = false;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await settle();
    if (await page.locator(answer).count() === 1 && await page.locator(answer).isVisible()) { found = true; break; }
    if (!await list.evaluate(el => { const before = el.scrollTop; el.scrollTop += Math.max(100, el.clientHeight - 100); return before !== el.scrollTop; })) break;
  }
  check(found, 'Answer missing within bounded chronicle traversal');
  await press(page, answer, evidence); await settle();
  check(await page.locator(`.chronicle-card[data-selected="true"][data-record="${ANSWER}"]`).count() === 1, 'Wrong manually selected answer');
  await fullSnapshot(page, out, 'manual-answer');
  const forward = `.chronicle-thread[data-thread="decision"] .chronicle-thread-link[data-record="${target}"]`;
  await press(page, forward, evidence); await settle();
  check(await page.locator(`.chronicle-card[data-selected="true"][data-record="${target}"]`).count() === 1, 'Wrong manually selected receipt');
  await fullSnapshot(page, out, 'manual-receipt');
  const back = `.chronicle-thread[data-thread="because"] .chronicle-thread-link[data-record="${ANSWER}"]`;
  await press(page, back, evidence); await settle();
  check(await page.locator(`.chronicle-card[data-selected="true"][data-record="${ANSWER}"]`).count() === 1, 'Wrong cause return');
  await fullSnapshot(page, out, 'manual-return'); result.verified = true;
}
async function capture(browser, item, out, url, evidence) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'ko-KR' });
  const page = await context.newPage(); page.setDefaultTimeout(5000); let initialized = false;
  page.on('pageerror', error => evidence.errors.push(String(error)));
  const accumulator = createLiveReceiptEvidence(ANSWER, START, 3000, item.checkpoint.state.history.records.map(row => row.id));
  try {
    await page.clock.install();
    await context.addInitScript("globalThis.__name ??= target => target; localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));");
    await page.routeWebSocket('**', socket => socket.close());
    await routeSceneState(page, item.checkpoint.text); const refused = sceneStateRefusal(page);
    await page.goto(`${url}?phase10-proof=1`, { timeout: 90000 });
    await Promise.race([page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 90000 }), refused]);
    initialized = true;
    const seasonLength = await page.evaluate(async () => {
      const [reads, news, config] = await Promise.all([import('/src/engine/decisionReads.ts'), import('/src/ui/results/decisionThread.ts'), import('/src/content/balanceConfig.ts')]);
      window.__EB_LIVE_READ_MODELS__ = { traceInRange: reads.traceInRange, traceNews: news.traceNews, seasonLength: config.BALANCE.TICKS_PER_YEAR / 4 };
      return window.__EB_LIVE_READ_MODELS__.seasonLength;
    });
    const threads = createTraceThreadEvidence(ANSWER, START, seasonLength);
    const initial = await fullSnapshot(page, out, 'initial');
    evidence.initialDifference = presentationDifference(withResidentWalkers(item.checkpoint.state), initial.state);
    check(initial.sha256 === sha(JSON.stringify(withResidentWalkers(item.checkpoint.state))), 'Initial presentation mismatch');
    if (await page.locator('.welcome-dismiss-layer').isVisible()) await press(page, '.welcome-dismiss-layer', evidence);
    await assertAutoplayDisabled(page);
    check(await page.locator('.speed-seal[data-seal="pause"]').getAttribute('aria-pressed') === 'true', 'Initial state not paused');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.clock.runFor(32);
    const before = await fullSnapshot(page, out, 'before-input');
    check(before.sha256 === initial.sha256, 'Pre-input presentation drift');
    await page.evaluate(() => { window.__EB_LIVE_HISTORY_IDS__ = new Set((window.__FEUDAL_PHASE10_PROOF__.state().history?.records ?? []).map(row => row.id)); });
    const readiness = await sample(page); evidence.readiness = readiness;
    threads.observe(readiness, []);
    if (readiness.panels.length) { evidence.stop = 'pre_input_blocking_dialog'; return; }
    const fast = '.speed-seal[data-seal="fast"]';
    await press(page, fast, evidence);
    check(await page.locator(`${fast} [data-step="5"]`).getAttribute('data-on') === 'true', 'First fast press not5x');
    await press(page, fast, evidence);
    check(await page.locator(`${fast} [data-step="10"]`).getAttribute('data-on') === 'true', 'Second fast press not10x');
    evidence.tenSelected = true;
    const started = Date.now(); let lastSignature = '', priorTick = START;
    for (let frame = 0; frame < 40000 && Date.now() - started < 900000; frame += 1) {
      await page.clock.runFor(16); const observation = await sample(page);
      evidence.frames.push({ frame, tick: observation.tick, paused: observation.paused, ten: observation.ten });
      check(observation.tick >= priorTick && observation.tick <= LIMIT, 'Tick reversal/overshoot');
      accumulator.observe(observation.tick, observation.records, observation.presentations);
      threads.observe(observation, accumulator.snapshot().receipts);
      evidence.threadEvidence = threads.snapshot();
      evidence.newHistory.push(...observation.records);
      const signature = JSON.stringify([observation.paused, observation.panels, observation.chips]);
      if (signature !== lastSignature) {
        evidence.transitions.push({ frame, ...observation });
        await fullSnapshot(page, out, `transition-${evidence.transitions.length}`); lastSignature = signature;
      }
      if (observation.ten && observation.tick > priorTick) evidence.progressAtTen = true;
      if (evidence.manualAdmission === 'first_exact_receipt' && accumulator.snapshot().receipts.length > 0) {
        evidence.stop = 'first_exact_receipt_manual_pause'; break;
      }
      if (accumulator.snapshot().automaticVisible || evidence.threadEvidence.automaticThreadVisible) {
        evidence.stop = accumulator.snapshot().automaticVisible ? 'automatic_exact_receipt_visible' : 'automatic_trace_thread_indicator_visible'; break;
      }
      if (shouldDismissInformationalSeasonLedger(observation)) {
        const label = `information-${evidence.informationalContinues.length + 1}`;
        const beforeContinue = await fullSnapshot(page, out, `${label}-before`);
        await press(page, '.season-ledger-card button.season-ledger-resume', evidence);
        const afterContinue = await fullSnapshot(page, out, `${label}-after`);
        check(beforeContinue.sha256 === afterContinue.sha256 && afterContinue.state.tick === observation.tick, 'Informational Continue changed presentation state');
        check((await sample(page)).panels.length === 0, 'Another dialog after informational Continue');
        for (let attempt = 0; attempt < 2 && !await page.locator(`${fast} [data-step="10"]`).getAttribute('data-on').then(value => value === 'true'); attempt += 1) await press(page, fast, evidence);
        const resumed = await sample(page);
        check(resumed.ten && !resumed.paused && resumed.tick === observation.tick, 'Informational resume failed or advanced time');
        evidence.informationalContinues.push({ tick: observation.tick, season: observation.panels[0].season, beforeSha256: beforeContinue.sha256, afterSha256: afterContinue.sha256 });
        priorTick = observation.tick; continue;
      }
      if (observation.panels.length || observation.paused) { evidence.stop = 'intervention_required_unknown_or_substantive_blocker'; break; }
      check(observation.ten, '10x no longer selected');
      if (observation.tick > priorTick) evidence.progressAtTen = true;
      priorTick = observation.tick;
      if (observation.tick === LIMIT) { evidence.stop = 'three_season_bound'; break; }
    }
    evidence.stop ??= 'frame_or_wall_time_bound';
    const beforePause = await sample(page);
    if (await page.locator('.speed-seal[data-seal="pause"]').getAttribute('aria-pressed') !== 'true') await press(page, '.speed-seal[data-seal="pause"]', evidence);
    const afterPause = await sample(page);
    evidence.manualPause = { beforeTick: beforePause.tick, afterTick: afterPause.tick,
      paused: afterPause.paused, panels: afterPause.panels, receiptIds: accumulator.snapshot().receipts.map(row => row.id) };
    check(afterPause.paused, 'Manual navigation requires normal pause control');
    const manualTarget = manualReceiptTarget(accumulator.snapshot(), evidence.threadEvidence);
    if (manualTarget !== undefined) {
      try { await manualTrace(page, out, evidence, manualTarget, afterPause.tick); }
      catch (error) { evidence.manualDiscovery ??= { attempted: true, verified: false }; evidence.manualDiscovery.error = String(error); }
    }
    evidence.final = await fullSnapshot(page, out, 'final'); delete evidence.final.state;
  } catch (error) {
    if (initialized) {
      try { const captured = await fullSnapshot(page, out, 'failure'); evidence.failureSnapshot = { sha256: captured.sha256, tick: captured.state.tick }; }
      catch (failure) { evidence.failureSnapshotError = String(failure); }
    }
    throw error;
  } finally {
    evidence.receiptEvidence = accumulator.snapshot(); await context.close();
  }
}
async function main() {
  refuseHeavyOnMac('EB bounded live10x', { entry: import.meta.url, remote: 'DGX heavy experiment only' });
  check(process.platform === 'linux' && process.version === 'v24.21.0', 'Pinned DGX Node only');
  const [directory, manifestSha256, out, url, revision, ...extra] = process.argv.slice(2);
  check(directory && manifestSha256 === MANIFEST && out && url && /^[a-f0-9]{40}$/.test(revision ?? '') && extra.length === 0, 'Usage: tsx scripts/engineBLiveSpeedCapture.mjs checkpointDirectory MANIFEST_SHA NEW_OUTPUT URL browserRevision');
  check(git('rev-parse', 'HEAD') === revision && git('status', '--porcelain') === '', 'Clean pinned checkout required');
  check(sha(readFileSync('package-lock.json')) === sha(execFileSync('git', ['show', `${SOURCE}:package-lock.json`])), 'Original lock mismatch');
  const changes = git('diff', SOURCE, '--name-only', '--', 'src').split('\n').filter(Boolean);
  check(changes.every(path => path === 'src/App.tsx' || /^src\/(ui|styles)\//.test(path)), 'Engine/presentation dependencies changed');
  const loaded = readCheckpoints(directory, MANIFEST); check(loaded.manifest.sourceRevision === SOURCE, 'Checkpoint source mismatch');
  const item = loaded.cases.find(row => row.name === 'ck_evt_005-answer');
  check(item?.pair.decisionId === ANSWER && item.checkpoint.state.tick === START, 'Wrong answer');
  const playwright = playwrightProvenance(); mkdirSync(out);
  const evidence = { valid: false, manualAdmission: process.env.EB_MANUAL_ON_RECEIPT === '1' ? 'first_exact_receipt' : 'after_continuation', sourceRevision: SOURCE, browserRevision: revision, manifestSha256: MANIFEST, input: item.checkpoint.record,
    playwright, changedUiFiles: changes, rawInputStateSha256: sha(JSON.stringify(item.checkpoint.state)),
    expectedPresentationSha256: sha(JSON.stringify(withResidentWalkers(item.checkpoint.state))), manualDiscovery: { attempted: false, verified: false }, informationalContinues: [], actions: [], frames: [], transitions: [], newHistory: [], errors: [], cleanupErrors: [],
    limits: ['New no-bot continuation, not original replay parity.', 'Proof exposes presentation, not raw browser store.',
      'Direct receipt identity and canonical trace-thread indication are separate; a thread chip does not prove visible receipt text.',
      'Manual navigation independently targets an observed exact-answer receipt; substantive decisions are never dismissed or answered. Automatic visibility remains a separate gate.',
      'Informational acknowledgements interrupt the continuation; unknown or substantive blockers stop without answering.', 'Synthetic DOM control input; no native pointer or real-time performance claim.'] };
  let owned, browser;
  try {
    owned = await startOwnedServer(url, out); evidence.server = owned.provenance;
    browser = await (await loadChromium()).launch({ headless: true, channel: 'chrome' });
    evidence.scrollFixture = await verifyNormalScrollInput(browser, out);
    await capture(browser, item, out, url, evidence);
    check(git('rev-parse', 'HEAD') === revision && git('status', '--porcelain') === '' && owned.server.exitCode === null, 'Source/server changed');
    evidence.valid = evidence.tenSelected === true && evidence.progressAtTen === true
      && (evidence.receiptEvidence.automaticVisible || evidence.threadEvidence?.automaticThreadVisible === true)
      && evidence.manualDiscovery?.verified === true && evidence.errors.length === 0;
    if (!evidence.valid) process.exitCode = 1;
  } catch (error) { evidence.error = String(error); process.exitCode = 1; }
  finally {
    try { if (browser) await browser.close(); } catch (error) { evidence.cleanupErrors.push(String(error)); }
    try { if (owned) await stopOwnedServer(owned.server); } catch (error) { evidence.cleanupErrors.push(String(error)); }
    if (evidence.cleanupErrors.length) { evidence.valid = false; process.exitCode = 1; }
    save(out, 'manifest.json', evidence);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
