#!/usr/bin/env bash
# Pass this script's literal contents as the command to run.sh --light; ignored files are not synced.
# Run from the DGX checkout root. No simulation; existing checkpoint envelopes only.
set -euo pipefail
: "${FLS_REMOTE_PORT:?run through scripts/remote/run.sh --light}"
: "${PLAYWRIGHT_MODULE:?existing playwright-core module required}"
. scripts/remote/devServers.sh
mkdir -p .remote/eb-visible-diagnostic
fls_serve .remote/eb-visible-diagnostic-vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$FLS_REMOTE_PORT" --strictPort
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:$FLS_REMOTE_PORT/" > /dev/null; then break; fi
  sleep 1
done
curl -sf "http://127.0.0.1:$FLS_REMOTE_PORT/" > /dev/null
node --import tsx --input-type=module <<'JS'
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { readCheckpoints } from './scripts/engineBVisibleCapture.mjs';
import { loadChromium, openScene } from './scripts/renderCommitProbe.mjs';
const directory = 'docs/verification/eb-weight/checkpoint15/saves';
const manifestSha = '20afdb37bf07735499d25fc5c59a82c527097b06267b3ec17e4a7553a426cd9e';
const input = readCheckpoints(directory, manifestSha);
const names = new Set(['ck_evt_005-consequence', 'ck_evt_092-consequence', 'final-year-review']);
const cases = input.cases.filter(item => names.has(item.name));
if (cases.length !== 3) throw new Error('Expected three diagnostic checkpoints');
const out = '.remote/eb-visible-diagnostic';
const hash = value => createHash('sha256').update(value).digest('hex');
const bounded = value => {
  if (value === undefined) return { absent: true };
  const text = JSON.stringify(value);
  return text.length <= 700 ? value : { preview: text.slice(0, 700), characters: text.length, sha256: hash(text) };
};
// Arrays preserve order; object keys do not. Missing keys differ from null/false/zero.
function differences(before, after) {
  const rows = []; let count = 0; const topLevel = new Set();
  const note = (path, left, right) => {
    count += 1; topLevel.add(path.split('/')[1] ?? '');
    if (rows.length < 100) rows.push({ path, before: bounded(left), after: bounded(right) });
  };
  const visit = (left, right, path) => {
    if (Object.is(left, right)) return;
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) { note(path, left, right); return; }
    if (Array.isArray(left)) {
      if (left.length !== right.length) note(`${path}/length`, left.length, right.length);
      for (let i = 0; i < Math.max(left.length, right.length); i += 1) visit(left[i], right[i], `${path}/${i}`);
      return;
    }
    for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
      const next = `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
      if (!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) note(next, left[key], right[key]);
      else visit(left[key], right[key], next);
    }
  };
  visit(before, after, '');
  return { count, topLevel: [...topLevel].sort(), details: rows, omitted: Math.max(0, count - rows.length) };
}
const visible = (page, selector) => page.locator(`${selector}:visible`).count().then(count => count > 0);
const readState = page => page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));
const invariant = (state, expected) => ({ tick: state.tick, expectedTick: expected.tick, tickUnchanged: state.tick === expected.tick,
  historyExact: differences(expected.history, state.history).count === 0, traceExact: differences(expected.trace, state.trace).count === 0 });
const INIT = `globalThis.__name ??= target => target; localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));`;
const result = { sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirtyPaths: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), checkpointSourceRevision: input.manifest.sourceRevision,
  manifestSha256: manifestSha, viewport: { width: 1280, height: 800 }, run: false,
  sampling: 'After openScene returns; helper dismisses welcome/Escape and waits. Not an instantaneous pre-effect sample.',
  cases: [] };
writeFileSync(`${out}/source-manifest.json`, readFileSync(`${directory}/manifest.json`));
const browser = await (await loadChromium()).launch({ channel: 'chrome', headless: true });
try {
  for (const item of cases) {
    const row = { name: item.name, checkpoint: item.checkpoint.record, expectedDecisionId: item.pair?.decisionId ?? null,
      actions: [], errors: [], automaticChip: null, steward: { routes: [], opened: false } };
    let context;
    try {
      const expected = item.checkpoint.state;
      const seat = expected.buildings.find(b => b.kind === 'manor_house') ?? expected.buildings[0];
      const scene = await openScene(browser, { state: item.checkpoint.text, tile: [seat.tx, seat.ty],
        baseUrl: `http://127.0.0.1:${process.env.FLS_REMOTE_PORT}/`, width: 1280, height: 800,
        run: false, query: '&story-delay=1500', initScript: INIT, loadTimeout: 90000 });
      context = scene.context; const page = scene.page;
      page.on('pageerror', error => row.errors.push(String(error)));
      const initialJson = await readState(page); const initial = JSON.parse(initialJson);
      row.initial = { ...invariant(initial, expected), jsonStringExact: initialJson === JSON.stringify(expected),
        jsonSha256: hash(initialJson), diff: differences(expected, initial) };
      if (!row.initial.tickUnchanged || !row.initial.historyExact || !row.initial.traceExact) throw new Error('Initial invariant failed');
      await page.screenshot({ path: `${out}/${item.name}-initial.png` });
      await page.waitForTimeout(2000);
      // Record any already-open actual season report before closing it for chip navigation.
      const inspectSteward = async () => {
        const selector = '.season-ledger-card .season-steward';
        if (!await visible(page, selector)) return false;
        row.steward.opened = true;
        row.steward.season = await page.locator('.season-ledger-card:visible').getAttribute('data-season');
        row.steward.itemIds = await page.locator(`${selector} [data-steward-item]`).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-steward-item')));
        for (const summary of await page.locator(`${selector} summary.season-steward-summary:visible`).all()) await summary.click();
        row.steward.text = await page.locator(selector).innerText();
        await page.screenshot({ path: `${out}/${item.name}-steward.png` });
        return true;
      };
      if (!await inspectSteward()) {
        for (const route of ['.season-notice', '.slice-season-card']) {
          const present = await visible(page, route); row.steward.routes.push({ selector: route, present });
          if (present) { await page.locator(`${route}:visible`).first().click(); row.actions.push(route); await page.waitForTimeout(200); await inspectSteward(); break; }
        }
      }
      if (!row.steward.opened) row.steward.status = 'No visible existing route/report; no modal or notice fabricated.';
      for (let attempt = 0; attempt < 5; attempt += 1) {
        let clicked = false;
        for (const selector of ['.season-ledger-resume', '.story-modal-later', '.results-card-continue']) {
          if (await visible(page, selector)) { await page.locator(`${selector}:visible`).first().click(); row.actions.push(selector); await page.waitForTimeout(150); clicked = true; break; }
        }
        if (!clicked) break;
      }
      const chip = '.event-chip[data-story="decision_trace"]';
      row.chipVisibleAfterDismissal = await visible(page, chip);
      if (row.chipVisibleAfterDismissal) {
        row.automaticChip = { chipText: await page.locator(`${chip}:visible`).first().innerText(), manualOpen: true };
        await page.locator(`${chip}:visible`).first().click(); row.actions.push(chip); await page.waitForTimeout(150);
        const card = '.event-card[data-story="decision_trace"]';
        row.automaticChip.cardText = await page.locator(card).innerText();
        await page.screenshot({ path: `${out}/${item.name}-chip.png` });
        const link = `${card} .event-card-chronicle`;
        if (await visible(page, link)) {
          await page.locator(link).click(); row.actions.push(link); await page.waitForTimeout(250);
          const selected = '.chronicle-card[data-selected="true"]';
          row.automaticChip.selected = await page.locator(selected).evaluateAll(nodes => nodes.map(node => ({ recordId: node.getAttribute('data-record'), text: node.innerText })));
          row.automaticChip.matchesExpected = row.automaticChip.selected.some(node => node.recordId === row.expectedDecisionId);
          row.automaticChip.detailText = await page.locator('.chronicle-detail').innerText();
          await page.screenshot({ path: `${out}/${item.name}-chip-selected.png` });
        }
      }
      const finalJson = await readState(page); const final = JSON.parse(finalJson);
      row.final = { ...invariant(final, expected), jsonSha256: hash(finalJson), diff: differences(expected, final), sinceInitial: differences(initial, final) };
      if (!row.final.tickUnchanged || !row.final.historyExact || !row.final.traceExact) throw new Error('Final invariant failed');
    } catch (error) { row.errors.push(String(error)); }
    finally { if (context) await context.close(); }
    result.cases.push(row); writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
  }
} finally { await browser.close(); }
if (result.cases.some(row => row.errors.length > 0)) process.exitCode = 1;
JS
