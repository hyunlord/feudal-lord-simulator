// Run with tsx on the DGX; owns one localhost Vite process, never runs a replay.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync, realpathSync, readlinkSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { decodeSave } from '../src/save/saveCodec.ts';
import { stewardReport } from '../src/engine/decisionReads.ts';
import { withResidentWalkers } from '../src/render/presentation/residentWalkerState.ts';
import { loadChromium } from './renderCommitProbe.mjs';
import { routeSceneState, sceneStateRefusal } from './sceneInjection.mjs';
import { presentationDifference } from './engineBVisibleCapture.mjs';
import { refuseHeavyOnMac } from './remote/localGuard.mjs';
import { spawnServer } from './serverProcess.ts';
const SOURCE = '2485af40046793f1856829fa1161dc4431942aa7';
const TARGETS = [
  [126999, 'ck_evt_058', 'remit', 'registry:ck_evt_058:petition.charterFee|ck_evt_058@126000:126'],
  [171999, 'ck_evt_034', 'precedent', 'registry:ck_evt_034:steward.precedent|:171'],
  [415999, 'ck_evt_144', 'b', 'registry:ck_evt_144:ck_evt_144|:415'],
  [450999, 'ck_evt_163', 'b', 'registry:ck_evt_163:ck_evt_163|:450'],
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const check = (condition, message) => { if (!condition) throw new Error(message); };
const save = (directory, name, value) => writeFileSync(join(directory, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const proof = page => page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));
const PAUSE = '.speed-seal[data-seal="pause"]';
const NORMAL = '.speed-seal[data-seal="normal"]';
const CARD = '.season-ledger-card[role="dialog"][data-frame="season-ledger"]';
export function playwrightProvenance(env = process.env) {
  check(env.PLAYWRIGHT_MODULE?.startsWith('/'), 'Absolute PLAYWRIGHT_MODULE required');
  const modulePath = realpathSync(env.PLAYWRIGHT_MODULE);
  const standardShim = realpathSync(fileURLToPath(new URL('./remote/playwright-chrome-shim.mjs', import.meta.url)));
  const coreInput = modulePath === standardShim ? env.FLS_PLAYWRIGHT_CORE : env.PLAYWRIGHT_MODULE;
  check(coreInput?.startsWith('/'), 'Absolute backing core path required');
  const corePath = realpathSync(coreInput);
  check(basename(corePath) === 'index.mjs', 'Expected playwright-core/index.mjs, not an arbitrary shim');
  const packagePath = join(dirname(corePath), 'package.json'), packageBytes = readFileSync(packagePath);
  const pkg = JSON.parse(packageBytes);
  check(pkg.name === 'playwright-core', 'Expected playwright-core package');
  check(typeof env.EB_PLAYWRIGHT_VERSION === 'string' && env.EB_PLAYWRIGHT_VERSION.length > 0
    && pkg.version === env.EB_PLAYWRIGHT_VERSION, 'Explicit Playwright version pin required');
  return { version: pkg.version, modulePath, corePath, packagePath,
    moduleSha256: sha(readFileSync(modulePath)), coreSha256: sha(readFileSync(corePath)), packageSha256: sha(packageBytes) };
}
export function readPrecloses(directory, expectedSha) {
  const bytes = readFileSync(join(directory, 'manifest.json'));
  const validity = JSON.parse(readFileSync(join(directory, 'validity.json'), 'utf8'));
  const manifest = JSON.parse(bytes);
  check(/^[a-f0-9]{64}$/.test(expectedSha) && sha(bytes) === expectedSha && validity.manifestSha256 === expectedSha, 'Replay manifest SHA mismatch');
  check(validity.valid === true && validity.browserEligible === true && manifest.valid === true && manifest.browserEligible === true, 'Replay is not eligible');
  check(manifest.sourceRevision === SOURCE && manifest.seed === 1 && manifest.raw?.provenance?.sourceRevision === SOURCE
    && manifest.raw.provenance.dirtyPaths === '' && manifest.source?.revision === SOURCE, 'Wrong replay source/seed');
  check(manifest.final?.hit === true && manifest.final.tick === 500000 && manifest.classification?.unresolved?.length === 0, 'Replay verification incomplete');
  check(Array.isArray(manifest.captures) && manifest.captures.length === 4, 'Expected four actual preclose captures');
  return TARGETS.map(([tick, entry, choice, id]) => {
    const matches = manifest.captures.filter(row => row.tick === tick);
    check(matches.length === 1, `Missing/duplicate preclose ${tick}`);
    const record = matches[0];
    check(record.browserEligible === true && record.phase === 'after_all_bot_commands_before_advanceTick'
      && record.from === tick - 999 && record.to === tick + 1 && typeof record.file === 'string' && basename(record.file) === record.file, 'Invalid preclose phase/file');
    const compressed = readFileSync(join(directory, record.file));
    check(sha(compressed) === record.fileSha256, 'Compressed save hash mismatch');
    const encoded = gunzipSync(compressed), text = encoded.toString('utf8'), envelope = JSON.parse(text);
    check(sha(encoded) === record.encodedSha256 && envelope.checksum === record.checksum, 'Envelope hash/checksum mismatch');
    const state = decodeSave(encoded).envelope.state;
    check(JSON.stringify(state) === JSON.stringify(envelope.state) && sha(JSON.stringify(state)) === record.stateSha256, 'Decoded state changed or hash mismatch');
    check(state.tick === tick && state.seed === 1 && state.scenarioId === 'core:lord_slice', 'Wrong saved tick/seed/scenario');
    const occurrence = state.registry?.occurrences.find(row => row.id === id);
    check(occurrence?.entryId === entry && occurrence.choiceId === choice && occurrence.decidedBy === 'steward'
      && occurrence.policy === 'customary' && occurrence.offeredTick === record.from
      && JSON.stringify(occurrence) === JSON.stringify(record.occurrence), 'Actual occurrence identity mismatch');
    check(stewardReport(state, record.from, record.to).events.some(row => row.occurrenceId === id && row.choiceId === choice), 'Actual report membership absent');
    return { tick, entry, choice, id, record, state, text };
  });
}
async function press(page, selector, actions) {
  const control = page.locator(selector).first();
  check(await control.isVisible() && await control.isEnabled(), `Control unavailable: ${selector}`);
  check(await control.evaluate(el => { const b = el.getBoundingClientRect(); const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return top !== null && (el.contains(top) || top.contains(el)); }), `Control covered: ${selector}`);
  await control.dispatchEvent('click'); actions.push({ input: 'synthetic DOM click through existing handler', selector });
}
async function snapshot(page, row, label, expected) {
  const json = await proof(page), state = JSON.parse(json);
  row.states.push({ label, tick: state.tick, sha256: sha(json), ...(expected ? { difference: presentationDifference(expected, state) } : {}) });
  return { json, state };
}
async function inspect(browser, item, output, url) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'ko-KR' });
  const row = { entry: item.entry, occurrenceId: item.id, valid: false, uiReportVerified: false, canonicalTickPresentationVerified: false, actions: [], states: [], clock: [], errors: [],
    rawExpectedStateSha256: item.record.stateSha256, expectedPresentationSha256: sha(JSON.stringify(withResidentWalkers(item.state))),
    limits: ['Proof port exposes presentation state, not raw store state; exact raw engine input/output identity is not observable here.',
      'Input is the original codec-admitted save. Only resident-walker presentation projection is expected; all other pre-input drift fails.',
      'Synthetic DOM input invokes existing UI controls; this is not native pointer evidence.'] };
  const page = await context.newPage();
  page.on('pageerror', error => row.errors.push(String(error)));
  try {
    check(page.clock?.install && page.clock?.pauseAt && page.clock?.runFor, 'Playwright clock API missing');
    await page.clock.install();
    await context.addInitScript("globalThis.__name ??= target => target; localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));");
    await page.routeWebSocket('**', socket => socket.close());
    await routeSceneState(page, item.text);
    const refused = sceneStateRefusal(page);
    await page.goto(`${url}?phase10-proof=1`, { timeout: 90000 });
    await Promise.race([page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 90000 }), refused]);
    await snapshot(page, row, 'initial-paused-load', withResidentWalkers(item.state));
    row.initialPreference = await page.evaluate(() => localStorage.getItem('feudal.seasonLedgerAuto'));
    if (await page.locator('.welcome-dismiss-layer').isVisible()) await press(page, '.welcome-dismiss-layer', row.actions);
    check(await page.locator(PAUSE).getAttribute('aria-pressed') === 'true', 'Initial UI not paused');
    check(await page.locator('.autoplay-toggle').getAttribute('aria-pressed') === 'false', 'Autoplay unexpectedly enabled');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    for (let index = 0; index < 2; index += 1) { await page.clock.runFor(16); row.clock.push({ phase: 'paused-init', ms: 16 }); }
    const before = await snapshot(page, row, 'exact-before-normal-input', withResidentWalkers(item.state));
    row.strictPreInputPresentationEqual = before.json === JSON.stringify(withResidentWalkers(item.state));
    check(row.strictPreInputPresentationEqual, 'Pre-input presentation drift; not canonical tick evidence');
    await press(page, NORMAL, row.actions);
    let immediate;
    for (let frame = 0; frame < 32; frame += 1) {
      await page.clock.runFor(16);
      immediate = await snapshot(page, row, `running-frame-${frame}`);
      row.clock.push({ phase: 'normal', ms: 16, tick: immediate.state.tick });
      check(immediate.state.tick >= item.tick && immediate.state.tick <= item.tick + 1, 'Tick overshoot/reversal');
      if (immediate.state.tick === item.tick + 1) break;
    }
    check(immediate.state.tick === item.tick + 1, 'No single tick within bounded clock frames');
    row.canonicalTickPresentationVerified = false;
    row.immediateObservedPresentationSha256 = sha(immediate.json);
    if (item.expectedOutput) {
      row.independentExpectedTickOutput = { verified: false, comparison: 'presentation projection only', rawSha256: item.expectedOutput.rawSha256, presentationSha256: sha(JSON.stringify(withResidentWalkers(item.expectedOutput.state))) };
      row.independentExpectedTickOutput.difference = presentationDifference(withResidentWalkers(item.expectedOutput.state), immediate.state);
      check(immediate.json === JSON.stringify(withResidentWalkers(item.expectedOutput.state)), 'Independent pinned tick-output presentation mismatch');
      row.independentExpectedTickOutput.verified = true;
      row.canonicalTickPresentationVerified = true;
    } else throw new Error('Independent pinned expected output required for acceptance');
    save(output, `${item.entry}-immediate-presentation.json`, immediate.state);
    if (await page.locator(PAUSE).getAttribute('aria-pressed') !== 'true') await press(page, PAUSE, row.actions);
    check(await page.locator(PAUSE).getAttribute('aria-pressed') === 'true', 'Pause did not take effect');
    for (let frame = 0; frame < 50; frame += 1) {
      await page.clock.runFor(16); row.clock.push({ phase: 'paused-ui', ms: 16 });
      check(JSON.parse(await proof(page)).tick === item.tick + 1, 'Extra tick during UI settle');
    }
    if (!await page.locator(CARD).isVisible()) await press(page, '.season-notice[data-season-notices]', row.actions);
    const after = await snapshot(page, row, 'report-visible', immediate.state);
    const ledger = after.state.seasons?.history.at(-1);
    check(ledger?.startTick === item.record.from && ledger.endTick === item.record.to, 'Wrong genuine closed season');
    check(await page.locator(CARD).getAttribute('data-season') === `${ledger.year}:${ledger.season}`, 'Wrong report card season');
    check(stewardReport(after.state, ledger.startTick, ledger.endTick).events.some(event => event.occurrenceId === item.id), 'Post-tick report membership missing');
    check(JSON.stringify(after.state.registry?.occurrences.find(event => event.id === item.id)) === JSON.stringify(item.record.occurrence), 'Target occurrence changed during UI tick');
    const selector = `${CARD} .season-steward li[data-steward-item=${JSON.stringify(item.id)}]`;
    const target = page.locator(selector);
    check(await target.count() === 1, 'Full occurrence report row absent/duplicate');
    await target.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await press(page, `${selector} .season-steward-summary`, row.actions);
    check(await target.locator('.season-steward-detail').isVisible(), 'Actual report detail not expanded');
    row.report = { from: ledger.startTick, to: ledger.endTick, season: `${ledger.year}:${ledger.season}`, text: await target.innerText(), occurrence: after.state.registry.occurrences.find(event => event.id === item.id) };
    await page.screenshot({ path: join(output, `${item.entry}-viewport.png`) });
    const box = await target.boundingBox();
    check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1280 && box.y + box.height <= 800, 'Full expanded row clipped; no full-row acceptance');
    await page.screenshot({ path: join(output, `${item.entry}-row.png`), clip: box });
    const final = await snapshot(page, row, 'after-screenshots', immediate.state);
    check(final.state.tick === item.tick + 1 && row.errors.length === 0, 'Final tick/runtime error');
    row.uiReportVerified = true;
    row.valid = row.canonicalTickPresentationVerified;
  } catch (error) { row.error = String(error); } finally {
    save(output, `${item.entry}-evidence.json`, row); await context.close();
  }
  return row;
}
export async function stopOwnedServer(server) {
  if (!server.pid) return;
  const signalGroup = signal => {
    try { process.kill(-server.pid, signal); } catch (error) { if (error?.code !== 'ESRCH') throw error; }
  };
  if (server.exitCode !== null || server.signalCode !== null) { signalGroup('SIGKILL'); return; }
  await new Promise((resolveStop, rejectStop) => {
    const finish = error => {
      clearTimeout(force); clearTimeout(deadline); server.off('exit', exited);
      if (error) rejectStop(error); else resolveStop();
    };
    const exited = () => { try { signalGroup('SIGKILL'); finish(); } catch (error) { finish(error); } };
    const force = setTimeout(() => { try { signalGroup('SIGKILL'); } catch (error) { finish(error); } }, 3000);
    const deadline = setTimeout(() => finish(new Error(`Owned Vite PID ${server.pid} did not exit after SIGKILL`)), 6000);
    server.once('exit', exited);
    try { signalGroup('SIGTERM'); } catch (error) { finish(error); }
  });
}
async function startOwnedServer(url, output) {
  const address = new URL(url);
  check(address.protocol === 'http:' && address.hostname === '127.0.0.1' && address.port && address.pathname === '/' && !address.search && !address.hash && !address.username && !address.password, 'Owned localhost URL with explicit port required');
  const port = Number(address.port), cwd = realpathSync(process.cwd());
  const log = openSync(join(output, 'vite.log'), 'wx');
  const server = spawnServer(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd, stdio: ['ignore', log, log] });
  closeSync(log);
  let spawnError; server.on('error', error => { spawnError = error; });
  try {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      check(!spawnError && server.exitCode === null, `Owned Vite exited: ${spawnError ?? server.exitCode}`);
      const sockets = readFileSync('/proc/net/tcp', 'utf8').trim().split('\n').slice(1).map(line => line.trim().split(/\s+/));
      const owned = readdirSync(`/proc/${server.pid}/fd`).flatMap(fd => { try { return [readlinkSync(`/proc/${server.pid}/fd/${fd}`)]; } catch { return []; } });
      const listener = sockets.find(fields => fields[1] === `0100007F:${port.toString(16).toUpperCase().padStart(4, '0')}` && fields[3] === '0A' && owned.includes(`socket:[${fields[9]}]`));
      if (listener && (await fetch(url, { signal: AbortSignal.timeout(1000) }).catch(() => null))?.ok) {
        check(realpathSync(`/proc/${server.pid}/cwd`) === cwd, 'Vite cwd mismatch');
        return { server, provenance: { pid: server.pid, cwd, url, port, listenerInode: listener[9], command: server.spawnargs } };
      }
      await new Promise(done => setTimeout(done, 100));
    }
    throw new Error('Owned Vite did not become ready');
  } catch (error) {
    try { await stopOwnedServer(server); } catch (cleanup) { throw new AggregateError([error, cleanup], `Vite startup failed: ${error}; cleanup failed: ${cleanup}`); }
    throw error;
  }
}
async function main() {
  refuseHeavyOnMac('EB actual season report capture', { entry: import.meta.url, remote: 'DGX: npx tsx scripts/engineBSeasonReportCapture.mjs …' });
  check(process.platform === 'linux' && process.version === 'v24.21.0', 'DGX/Linux with pinned Node v24.21.0 only; no local override');
  const [directory, expectedManifestSha, output, url, browserRevision, ...extra] = process.argv.slice(2);
  check(directory && output && url && /^[a-f0-9]{40}$/.test(browserRevision ?? '') && extra.length === 0, 'Usage: tsx scripts/engineBSeasonReportCapture.mjs replayDir manifestSHA newOutputDir URL browserRevision');
  check(git('rev-parse', 'HEAD') === browserRevision && git('status', '--porcelain') === '', 'Browser checkout source pin/cleanliness mismatch');
  check(sha(readFileSync('package-lock.json')) === sha(execFileSync('git', ['show', `${SOURCE}:package-lock.json`])), 'Dependency lock differs from2485');
  const changes = git('diff', SOURCE, '--name-only', '--', 'src').split('\n').filter(Boolean);
  check(changes.every(path => path === 'src/App.tsx' || /^src\/(ui|styles)\//.test(path)), 'Engine/presentation dependency source differs from2485');
  const inputs = readPrecloses(directory, expectedManifestSha);
  check(process.env.EB_EXPECTED_TICK_OUTPUTS && process.env.EB_EXPECTED_TICK_OUTPUTS_SHA256, 'Independent pinned tick outputs required');
  if (process.env.EB_EXPECTED_TICK_OUTPUTS) {
    const path = process.env.EB_EXPECTED_TICK_OUTPUTS, bytes = readFileSync(path);
    check(sha(bytes) === process.env.EB_EXPECTED_TICK_OUTPUTS_SHA256, 'Independent expected-output manifest pin mismatch');
    const expected = JSON.parse(bytes);
    check(expected.sourceRevision === SOURCE && expected.replayManifestSha256 === expectedManifestSha && expected.outputs?.length === 4, 'Independent expected-output source/count mismatch');
    for (const item of inputs) {
      const records = expected.outputs.filter(row => row.entryId === item.entry && row.tick === item.tick + 1);
      check(records.length === 1 && basename(records[0].file) === records[0].file, 'Expected-output identity/file invalid');
      check(records[0].inputStateSha256 === item.record.stateSha256 && records[0].inputFileSha256 === item.record.fileSha256, 'Expected-output preclose input mismatch');
      const raw = readFileSync(join(dirname(path), records[0].file));
      check(sha(raw) === records[0].fileSha256, 'Independent expected-output file hash mismatch');
      const state = JSON.parse(raw);
      check(state.tick === item.tick + 1 && state.seed === 1 && state.scenarioId === 'core:lord_slice', 'Independent expected-output state identity mismatch');
      item.expectedOutput = { state, rawSha256: sha(raw) };
    }
  }
  const playwright = playwrightProvenance();
  mkdirSync(output);
  const evidence = { valid: false, scope: 'Single UI tick and actual report presentation; not raw store identity or whole UI acceptance',
    serverProvenance: null, sourceRevision: SOURCE, browserRevision, changedUiFiles: changes, replayManifestSha256: expectedManifestSha,
    playwrightVersion: playwright.version, playwright, expectedTickOutputsManifestSha256: process.env.EB_EXPECTED_TICK_OUTPUTS_SHA256 ?? null, viewport: { width: 1280, height: 800, dpr: 1 }, cases: [] };
  let browser, owned;
  try {
    owned = await startOwnedServer(url, output); evidence.serverProvenance = owned.provenance;
    browser = await (await loadChromium()).launch({ headless: true, channel: 'chrome' });
    for (const item of inputs) {
      check(owned.server.exitCode === null && owned.server.signalCode === null, 'Owned server stopped');
      evidence.cases.push(await inspect(browser, item, output, url));
    }
    check(owned.server.exitCode === null && git('rev-parse', 'HEAD') === browserRevision && git('status', '--porcelain') === '', 'Server/source changed during capture');
    evidence.valid = evidence.cases.every(row => row.valid);
    check(evidence.valid, 'One or more actual report captures failed; inspect evidence');
  } catch (error) { evidence.error = String(error); process.exitCode = 1; }
  finally {
    evidence.cleanupErrors = [];
    try { if (browser) await browser.close(); } catch (error) { evidence.cleanupErrors.push(`Browser: ${error}`); }
    try { if (owned) await stopOwnedServer(owned.server); } catch (error) { evidence.cleanupErrors.push(`Vite: ${error}`); }
    finally {
      if (evidence.cleanupErrors.length) { evidence.valid = false; process.exitCode = 1; }
      save(output, 'manifest.json', evidence);
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
