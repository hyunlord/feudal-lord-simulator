import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { decodeSave } from '../../../src/save/saveCodec.ts';
import { withResidentWalkers } from '../../../src/render/presentation/residentWalkerState.ts';
import { yearResults } from '../../../src/ui/results/yearResults.ts';
import { RESULTS_COPY } from '../../../src/ui/results/resultsCopy.ko.ts';
import { loadChromium, openScene } from '../../../scripts/renderCommitProbe.mjs';

assert.equal(process.platform, 'linux');
assert.ok(process.env.FLS_REMOTE);
const [root, out, url] = process.argv.slice(2);
assert.ok(root && out && url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const directory = join(root, 'seed-1');
const manifestBytes = readFileSync(join(directory, 'manifest.json'));
assert.equal(sha(manifestBytes), 'e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d');
const pair = JSON.parse(manifestBytes).pairs.find(row => row.entryId === 'ck_evt_024');
assert.equal(pair.decisionId, 'h-019919');
const browser = await (await loadChromium()).launch({ channel: 'chrome', headless: true });
const rows = [];
try {
  for (const stage of ['answer', 'consequence']) {
    const input = pair[stage];
    const compressed = readFileSync(join(directory, input.file));
    assert.equal(sha(compressed), input.fileSha256);
    const raw = gunzipSync(compressed);
    assert.equal(sha(raw), input.encodedSaveSha256);
    const state = decodeSave(raw).envelope.state;
    const model = yearResults(state);
    const target = model?.items.find(row => row.decisionId === pair.decisionId);
    const row = { stage, input, model, target, errors: [], actions: [], screenshots: [] };
    rows.push(row);
    const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings[0];
    assert.ok(seat);
    const { context, page } = await openScene(browser, { state: raw.toString('utf8'), tile: [seat.tx, seat.ty],
      baseUrl: url, width: 1280, height: 800, run: false, query: '&story-delay=0', loadTimeout: 90000,
      initScript: "globalThis.__name ??= target => target; localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));" });
    page.on('pageerror', error => row.errors.push(String(error)));
    const screenshot = async label => {
      const file = `024-${stage}-${label}.png`;
      await page.screenshot({ path: join(out, file) }); row.screenshots.push(file);
    };
    try {
      const expected = JSON.stringify(withResidentWalkers(state));
      const initial = await page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));
      row.expectedPresentationSha256 = sha(expected); row.initialPresentationSha256 = sha(initial);
      assert.equal(sha(initial), sha(expected), 'Current page must load the genuine decoded checkpoint exactly');
      const chip = page.locator('.event-chip[data-story="decision_trace"]:visible');
      await screenshot('initial');
      row.initialChipCount = await chip.count();
      for (const selector of ['.season-ledger-resume', '.results-card-continue']) {
        const button = page.locator(`${selector}:visible`);
        if (await button.count() === 1) {
          await button.click(); row.actions.push(selector);
          assert.equal(sha(await page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()))), sha(initial));
        }
      }
      row.chipCount = await chip.count();
      if (row.chipCount === 1) {
        row.chipTitle = await chip.innerText();
        row.chipId = await chip.getAttribute('data-chip-id');
        assert.ok(model);
        assert.equal(row.chipTitle, RESULTS_COPY.trace.yearChip(model.count));
        assert.equal(row.chipId, `results:${model.year}`);
        await chip.click({ timeout: 10000 });
        row.actions.push('open-year-results-chip');
        const card = page.locator('.event-card[data-story="decision_trace"]:visible');
        await card.waitFor({ timeout: 10000 });
        row.cardText = await card.innerText();
        row.facts = await card.locator('.event-card-facts li').allTextContents();
        row.expectedFact = target ? RESULTS_COPY.trace.yearItem(target.title, target.count) : null;
        row.targetCaptured = row.expectedFact !== null && row.facts.includes(row.expectedFact);
        await screenshot('card');
      } else row.targetCaptured = false;
      row.finalPresentationSha256 = sha(await page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state())));
      assert.equal(row.finalPresentationSha256, row.initialPresentationSha256, 'Navigation cannot change the saved state');
    } catch (error) {
      row.errors.push(String(error)); await screenshot('failure');
    } finally { await context.close(); }
    writeFileSync(join(out, 'browser.json'), JSON.stringify({ mode: 'paused_genuine_checkpoint_current_UI', rows }, null, 2));
  }
} finally { await browser.close(); }
assert.ok(rows.every(row => row.errors.length === 0), 'Browser verification errors; see browser.json');
assert.equal(rows.find(row => row.stage === 'consequence')?.targetCaptured, true, '024 result must be present in the actual yearly card');
