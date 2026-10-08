// Actual saved checkpoints only. Run through engineBVisibleCapture.sh on the DGX; no ticking or generated scenes.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { decodeSave } from '../src/save/saveCodec.ts';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { refuseHeavyOnMac } from './remote/localGuard.mjs';

const IDS = ['ck_evt_005', 'ck_evt_092', 'ck_evt_211', 'ck_evt_201', 'ck_evt_038'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const CHIP = '.event-chip[data-story="decision_trace"]';
const CARD = '.event-card[data-story="decision_trace"]';
const INIT = `globalThis.__name ??= target => target; localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));`;
const visible = async (page, selector) => page.locator(`${selector}:visible`).count().then(n => n > 0);

export function readCheckpoints(directory, manifestSha256) {
  const manifestBytes = readFileSync(join(directory, 'manifest.json'));
  if (!/^[a-f0-9]{64}$/.test(manifestSha256) || sha(manifestBytes) !== manifestSha256) throw new Error('Manifest SHA-256 mismatch');
  const manifest = JSON.parse(manifestBytes);
  if (manifest.schemaVersion !== 1 || manifest.dirtyPaths !== '' || !/^[a-f0-9]{40}$/.test(manifest.sourceRevision)) throw new Error('Invalid checkpoint provenance');
  const read = record => {
    if (record === null || typeof record?.file !== 'string' || basename(record.file) !== record.file) throw new Error('Invalid checkpoint filename');
    const compressed = readFileSync(join(directory, record.file));
    if (sha(compressed) !== record.fileSha256 || compressed.length !== record.bytes) throw new Error(`Checkpoint hash/size mismatch: ${record.file}`);
    const bytes = gunzipSync(compressed);
    if (sha(bytes) !== record.encodedSaveSha256) throw new Error(`Encoded save hash mismatch: ${record.file}`);
    const decoded = decodeSave(bytes);
    const envelope = JSON.parse(bytes.toString('utf8'));
    if (JSON.stringify(decoded.envelope.state) !== JSON.stringify(envelope.state)) throw new Error(`Save migration would alter state: ${record.file}`);
    if (decoded.envelope.state.tick !== record.observedTick) throw new Error(`Checkpoint tick mismatch: ${record.file}`);
    return { record, text: bytes.toString('utf8'), state: decoded.envelope.state };
  };
  const cases = [];
  for (const id of IDS) {
    const matches = manifest.pairs.filter(pair => pair.entryId === id);
    if (matches.length !== 1) throw new Error(`Expected one smoke checkpoint pair: ${id}`);
    const pair = matches[0];
    const answer = read(pair.answer);
    const decision = answer.state.history?.records.find(record => record.id === pair.decisionId);
    if (decision?.kind !== 'decision' || decision.tick !== pair.decisionTick) throw new Error(`Missing actual answer history: ${id}`);
    cases.push({ name: `${id}-answer`, pair, checkpoint: answer });
    if (pair.consequence !== undefined) {
      const checkpoint = read(pair.consequence);
      const result = checkpoint.state.history?.records.find(record => record.id === pair.consequence.historyId);
      if (result === undefined || result.tick <= pair.decisionTick || !result.because?.some(cause => cause.decisionId === pair.decisionId)) throw new Error(`Missing actual consequence link: ${id}`);
      cases.push({ name: `${id}-consequence`, pair, checkpoint });
    } else cases.push({ name: `${id}-final-no-pair`, pair, checkpoint: read(manifest.finalSave) });
  }
  cases.push({ name: 'final-year-review', pair: null, checkpoint: read(manifest.finalSave) });
  return { manifest, manifestSha256, cases };
}

async function capture(page, out, name, selector) {
  await page.waitForTimeout(150);
  const shown = await visible(page, selector);
  const panel = shown ? await page.locator(`${selector}:visible`).first().evaluate(el => {
    const b = el.getBoundingClientRect();
    return { text: el.innerText, box: { x: b.x, y: b.y, width: b.width, height: b.height,
      inside: b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight }, recordId: el.getAttribute('data-record') };
  }) : null;
  const screenshot = `${name}.png`;
  await page.screenshot({ path: join(out, screenshot) });
  return { selector, shown, panel, screenshot };
}

async function clearOverlays(page, actions) {
  for (let i = 0; i < 8; i += 1) {
    let clicked = false;
    for (const button of ['.season-ledger-resume', '.story-modal-later', '.results-card-continue', '.chronicle-close']) {
      if (!await visible(page, button)) continue;
      await page.locator(`${button}:visible`).first().click(); actions.push(button); clicked = true;
      await page.waitForTimeout(150); break;
    }
    if (!clicked) break;
  }
}

async function findRecord(page, recordId, actions) {
  const selector = `.chronicle-card[data-record="${recordId}"] .chronicle-card-body`;
  const list = page.locator('.chronicle-list:visible');
  if (await list.count() === 0) return false;
  await list.evaluate(el => { el.scrollTop = 0; });
  for (let i = 0; i < 100; i += 1) {
    await page.waitForTimeout(60);
    if (await visible(page, selector)) { await page.locator(selector).click(); actions.push(selector); return true; }
    const moved = await list.evaluate(el => { const before = el.scrollTop; el.scrollTop += Math.max(100, el.clientHeight - 100); return el.scrollTop !== before; });
    if (!moved) break;
  }
  return false;
}

async function inspectCase(browser, item, out, url) {
  const { state, text, record } = item.checkpoint;
  const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings[0];
  if (seat === undefined) throw new Error('Checkpoint has no camera anchor');
  const { context, page } = await openScene(browser, { state: text, tile: [seat.tx, seat.ty], baseUrl: url,
    width: 1280, height: 800, run: false, query: '&story-delay=1500', initScript: INIT, loadTimeout: 90000 });
  const row = { name: item.name, checkpoint: record, pair: item.pair, actions: [], panels: [], errors: [],
    limits: ['openScene dismisses welcome/Escape and sets camera; tutorial disabled outside GameState.',
      'History navigation is manual. No first-season automatic visibility claim. No simulation resumed.'] };
  page.on('pageerror', error => row.errors.push(String(error)));
  try {
    const runtime = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state());
    row.loadedTick = runtime.tick;
    row.initialStateExact = JSON.stringify(runtime) === JSON.stringify(state);
    row.initialHistoryTraceExact = JSON.stringify([runtime.history, runtime.trace]) === JSON.stringify([state.history, state.trace]);
    if (runtime.tick !== state.tick || !row.initialHistoryTraceExact) throw new Error('Loaded tick/history/trace differs from checkpoint');
    row.panels.push(await capture(page, out, `${item.name}-initial`, 'body'));
    await page.waitForTimeout(2000);
    row.automaticYearReview = await visible(page, '.results-card.year-review');
    row.panels.push(await capture(page, out, `${item.name}-year`, '.results-card.year-review'));
    row.chipInitiallyShown = await visible(page, CHIP);
    if (item.pair !== null) {
      await clearOverlays(page, row.actions);
      row.chipAfterOverlayDismissal = await visible(page, CHIP);
      if (row.chipAfterOverlayDismissal) {
        await page.locator(`${CHIP}:visible`).first().click(); row.actions.push(CHIP);
        row.panels.push(await capture(page, out, `${item.name}-chip`, CARD));
        if (await visible(page, `${CARD} .event-card-chronicle`)) {
          await page.locator(`${CARD} .event-card-chronicle`).click(); row.actions.push(`${CARD} .event-card-chronicle`);
          row.panels.push(await capture(page, out, `${item.name}-chip-history`, '.chronicle-detail'));
        }
      }
      if (!await visible(page, '.chronicle-screen')) {
        await page.keyboard.press('Escape'); row.actions.push('Escape (close event card/pause)');
        if (await visible(page, '.pause-menu')) await page.keyboard.press('Escape');
        await clearOverlays(page, row.actions);
        await page.keyboard.press('KeyC'); row.actions.push('KeyC (manual history)');
      }
      row.historyOpened = await visible(page, '.chronicle-screen');
      row.decisionLocated = await findRecord(page, item.pair.decisionId, row.actions);
      row.panels.push(await capture(page, out, `${item.name}-decision`, '.chronicle-detail'));
      const target = item.pair.consequence?.historyId;
      const link = target === undefined ? null : `.chronicle-thread[data-thread="decision"] .chronicle-thread-link[data-record="${target}"]`;
      row.exactConsequenceLinkShown = row.decisionLocated && link !== null && await visible(page, link);
      if (row.exactConsequenceLinkShown) {
        await page.locator(link).click(); row.actions.push(link);
        row.panels.push(await capture(page, out, `${item.name}-because`, '.chronicle-thread[data-thread="because"]'));
        const back = `.chronicle-thread[data-thread="because"] .chronicle-thread-link[data-record="${item.pair.decisionId}"]`;
        row.exactCauseBackLinkShown = await visible(page, back);
        if (row.exactCauseBackLinkShown) { await page.locator(back).click(); row.actions.push(back); }
      }
    }
    const finalState = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state());
    row.finalTick = finalState.tick;
    row.tickUnchanged = finalState.tick === state.tick;
    row.finalHistoryTraceExact = JSON.stringify([finalState.history, finalState.trace]) === JSON.stringify([state.history, state.trace]);
    if (!row.tickUnchanged || !row.finalHistoryTraceExact) throw new Error('Capture changed tick/history/trace');
  } catch (error) { row.errors.push(String(error)); }
  finally { await context.close(); }
  return row;
}

async function main() {
  const [directory, expectedSha, out, url, extra] = process.argv.slice(2);
  if (!directory || !expectedSha || !out || !url || extra) throw new Error('Usage: engineBVisibleCapture.mjs CHECKPOINT_DIRECTORY MANIFEST_SHA256 OUT URL');
  refuseHeavyOnMac('EB saved-checkpoint browser capture', { remote: 'scripts/remote/run.sh render-EB-visible --light -- bash scripts/engineBVisibleCapture.sh ...', entry: import.meta.url });
  const input = readCheckpoints(directory, expectedSha);
  mkdirSync(out, { recursive: true });
  const results = { schemaVersion: 1, sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirtyPaths: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), checkpointSourceRevision: input.manifest.sourceRevision,
    checkpointDirectory: resolve(directory), manifestSha256: expectedSha, viewport: { width: 1280, height: 800 }, run: false, cases: [] };
  writeFileSync(join(out, 'source-manifest.json'), readFileSync(join(directory, 'manifest.json')));
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const item of input.cases) {
      try { results.cases.push(await inspectCase(browser, item, out, url)); }
      catch (error) { results.cases.push({ name: item.name, errors: [String(error)] }); }
      writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 2));
    }
  } finally { await browser.close(); }
  if (results.cases.some(row => row.errors.length > 0)) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
