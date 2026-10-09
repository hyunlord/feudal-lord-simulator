// DGX only. Existing variantStates.ts outputs are inputs; no state generation or engine command injection.
// node_modules/.bin/tsx scripts/engineBTlinkBrowser.mjs --states /home/hyunlord/fls-variant-states --url http://127.0.0.1:4300/ --out .remote/eb-tlink-browser
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { refuseHeavyOnMac } from './remote/localGuard.mjs';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { homePetitionView } from '../src/ui/lordCardsModel.ts';
import { registryOfferView } from '../src/ui/registryCardModel.ts';
import { decisionPresentation } from '../src/engine/decisionPresentation.ts';
import { decodeSave, encodeSave } from '../src/save/saveCodec.ts';

refuseHeavyOnMac('EB-TLINK actual browser answers', { remote: 'scripts/remote/run.sh render-EB-TLINK-browser-<sha7> --light -- <server wrapper>', entry: import.meta.url });
assert.equal(process.platform, 'linux', 'Browser verification runs on DGX/Linux only');
const args = process.argv.slice(2), flags = {};
for (let index = 0; index < args.length; index += 2) {
  assert.ok(['--states', '--url', '--out', '--playwright'].includes(args[index]) && args[index + 1], 'expected --states DIR --url URL [--out DIR] [--playwright MODULE]');
  flags[args[index].slice(2)] = args[index + 1];
}
assert.ok(flags.states && flags.url, '--states and --url are required');
const out = resolve(flags.out ?? '.remote/eb-tlink-browser');
assert.ok(!existsSync(out) || readdirSync(out).length === 0, 'output directory must be new or empty');
mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const artifact = (name, bytes) => { writeFileSync(join(out, name), bytes); return { path: name, bytes: bytes.length, sha256: sha(bytes) }; };
const metadataBytes = readFileSync(join(flags.states, 'states.json'));
const metadata = JSON.parse(metadataBytes.toString());
const result = { functionalPass: false, source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }),
  scriptSHA256: sha(readFileSync(new URL(import.meta.url))), url: flags.url, viewport: { width: 1280, height: 800 },
  statesManifest: artifact('states.json', metadataBytes), rows: [], errors: [],
  limits: ['Prepared fixture display/answer verification; not natural eligibility or 125-year evidence.',
    'No visual verdict is inferred from screenshots. Chronicle title observation is reported separately.',
    'State injection uses the existing openScene admission helper; answers use only rendered buttons.'] };
const INIT = `globalThis.__name = globalThis.__name || (target => target); localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] }));`;
const visible = async (page, selector) => await page.locator(`${selector}:visible`).count() > 0;
const observed = page => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state());
async function dismissOther(page, actions = []) {
  for (const selector of ['.story-modal-later', '.results-card-continue', '.season-ledger-resume', '.chronicle-close']) {
    if (await visible(page, selector)) { actions.push({ action: 'dismiss', selector, dialogs: await dialogs(page) }); await page.locator(`${selector}:visible`).first().click(); return true; }
  }
  return false;
}
const dialogs = page => page.locator('[role="dialog"]:visible').evaluateAll(nodes => nodes.map(node => ({ className: node.className, label: node.getAttribute('aria-label'), text: node.innerText.slice(0, 600) })));
async function cardUp(page, selector, chipId, actions) {
  const chip = `.event-chip[data-chip-id=${JSON.stringify(chipId)}]`;
  const detail = `.event-card[data-chip-id=${JSON.stringify(chipId)}] .event-card-decide`;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await visible(page, selector)) return;
    if (!await dismissOther(page, actions) && (await dialogs(page)).length === 0) {
      if (await visible(page, detail)) {
        actions.push({ action: 'open-decision', chipId });
        await page.locator(`${detail}:visible`).click();
      } else if (await visible(page, chip)) {
        actions.push({ action: 'open-chip', chipId });
        await page.locator(`${chip}:visible`).click();
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Target card not visible: ${selector}; dialogs=${JSON.stringify(await dialogs(page))}`);
}
async function screenshot(page, name) {
  const bytes = await page.screenshot({ type: 'png' });
  return artifact(name, bytes);
}
async function chronicle(page, recordId, title, name) {
  for (let attempt = 0; attempt < 8 && await dismissOther(page); attempt++) await page.waitForTimeout(150);
  await page.keyboard.press('KeyC');
  if (!await page.locator('.chronicle-screen').waitFor({ timeout: 5000 }).then(() => true, () => false))
    return { reached: false, titleObserved: null, reason: 'Normal C shortcut did not open chronicle' };
  const target = page.locator(`.chronicle-card[data-record="${recordId}"] .chronicle-card-body`);
  const list = page.locator('.chronicle-list');
  for (let step = 0; step < 32 && await target.count() === 0; step++) {
    await list.hover(); await page.mouse.wheel(0, step === 0 ? -100000 : 2400); await page.waitForTimeout(150);
  }
  if (await target.count() === 0) return { reached: false, titleObserved: null, reason: 'Own record outside bounded normal-scroll search', screenshot: await screenshot(page, `${name}-chronicle-search.png`) };
  await target.click();
  const detail = page.locator(`.chronicle-detail-body[data-detail="${recordId}"]`);
  await detail.waitFor();
  const text = await detail.innerText();
  return { reached: true, recordId, titleObserved: text.includes(title), text, screenshot: await screenshot(page, `${name}-chronicle.png`) };
}

let browser;
try {
  const chromium = await loadChromium(flags.playwright);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [name, expectedVariant] of [['home-041', 'ck_evt_041'], ['registry-067', 'ck_evt_067']]) {
    const bytes = readFileSync(join(flags.states, `${name}.json`));
    const state = JSON.parse(bytes.toString());
    const isHome = name.startsWith('home');
    const view = isHome ? homePetitionView(state) : registryOfferView(state);
    assert.ok(view && view.displayEntryId === expectedVariant, `${name}: fixture does not display required variant`);
    const subjectId = isHome ? view.petitionId : view.occurrenceId;
    const sourceEntryId = isHome ? `home:${view.kind}` : view.entryId;
    const choiceId = isHome ? 'grant' : view.choices.find(choice => choice.enabled && !choice.hold)?.id;
    assert.ok(choiceId, `${name}: no enabled acting answer`);
    assert.ok(metadata[name], `${name}: missing original fixture classification`);
    const row = { name, fixtureSHA256: sha(bytes), fixtureBytes: bytes.length, fixtureMetadata: metadata[name],
      expectedVariant, subjectId, sourceEntryId, choiceId, pass: false };
    result.rows.push(row);
    const seat = state.buildings.find(building => building.kind === 'manor_house') ?? state.buildings[0];
    assert.ok(seat, `${name}: no camera seat`);
    const { context, page } = await openScene(browser, { state, tile: [seat.tx, seat.ty], baseUrl: flags.url,
      run: false, initScript: INIT, width: 1280, height: 800, query: '&story-delay=3000', loadTimeout: 90000 });
    page.on('pageerror', error => result.errors.push(`${name}: ${String(error)}`));
    try {
      const selector = isHome ? '.story-modal.lord-card[data-home-petition]' : '.story-modal.lord-card[data-registry-offer]';
      row.admission = [];
      await cardUp(page, selector, `${isHome ? 'home-petition' : 'registry'}:${subjectId}`, row.admission);
      const card = page.locator(`${selector}:visible`).first();
      assert.equal(await card.getAttribute('data-subject'), subjectId);
      row.shownTitle = await card.locator('h2,h3').first().innerText();
      assert.equal(row.shownTitle, view.title);
      assert.ok((await card.innerText()).includes(isHome ? view.demand : view.body));
      row.cardScreenshot = await screenshot(page, `${name}-card.png`);
      const before = await observed(page);
      assert.equal(before.tick, state.tick, 'Paused browser scene unexpectedly advanced');
      const prior = new Set(before.history?.records.map(record => record.id));
      // This invokes AppModals' real click handler; no GameAction or provenance is injected into the page.
      await card.locator(`[data-choose="${choiceId}"]`).click();
      await page.waitForFunction(({ subject, old }) => window.__FEUDAL_PHASE10_PROOF__.state().history?.records.some(record =>
        !old.includes(record.id) && record.template === 'decision.card' && record.params?.subjectId === subject),
      { subject: subjectId, old: [...prior] }, { timeout: 10000 });
      const after = await observed(page);
      const records = after.history.records.filter(record => !prior.has(record.id) && record.template === 'decision.card' && record.params?.subjectId === subjectId);
      assert.equal(records.length, 1, 'Expected exactly one new own answer');
      const own = records[0];
      assert.deepEqual(decisionPresentation(own), { sourceEntryId, displayEntryId: expectedVariant });
      assert.equal(own.params.chosen, isHome ? 'granted' : choiceId);
      assert.equal(after.tick, before.tick, 'Answer verification must not advance simulation');
      row.ownAnswer = own;
      row.contribution = after.trace?.answers?.find(answer => answer.id === own.id) ?? null;
      assert.ok(row.contribution, 'Own contribution not retained');
      const saved = encodeSave({ state: after, createdAt: '2026-10-10T00:00:00Z', savedAt: '2026-10-10T00:00:00Z' });
      const restored = decodeSave(saved.bytes).envelope.state;
      assert.deepEqual(decisionPresentation(restored.history?.records.find(record => record.id === own.id)), decisionPresentation(own));
      row.savedAnswer = artifact(`${name}-answered.save.json.gz`, gzipSync(saved.bytes, { level: 9 }));
      row.uncompressedSaveSHA256 = sha(saved.bytes);
      row.chronicle = await chronicle(page, own.id, view.title, name);
      row.pass = true;
    } catch (error) {
      row.failureDialogs = await dialogs(page);
      row.failureText = (await page.locator('body').innerText()).slice(0, 6000);
      row.failureScreenshot = await screenshot(page, `${name}-failure.png`);
      const failureState = await observed(page);
      row.failureView = isHome ? homePetitionView(failureState) : registryOfferView(failureState);
      throw error;
    } finally { await context.close(); }
  }
  result.functionalPass = result.rows.length === 2 && result.rows.every(row => row.pass) && result.errors.length === 0;
} catch (error) {
  result.errors.push(error instanceof Error ? `${error.stack}` : String(error));
} finally {
  if (browser) await browser.close();
  writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify({ functionalPass: result.functionalPass, rows: result.rows.length, errors: result.errors, out }));
if (!result.functionalPass) process.exitCode = 1;
