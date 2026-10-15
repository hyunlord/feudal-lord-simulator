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
assert.equal(process.platform, 'linux'); assert.equal(process.env.FLS_REMOTE, '1');
const [input, out, url, caseId] = process.argv.slice(2);
assert.ok(input && out && url && caseId); mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const product = '53407fe6946921ddd448fcffeb417ae07e7351f2';
const cases = {
  '034': [171999, 'precedent', 'registry:ck_evt_034:steward.precedent|:171', '6034332a3877ebfecc9bd82c009fec694c0ba7003c69183e6d4e2c67e939f06d'],
  '058': [126999, 'remit', 'registry:ck_evt_058:petition.charterFee|ck_evt_058@126000:126', '4b71ac273c1bf3cc4cd4ae64b953fd88d44e31bf727a3b68079d91ccb2209e5e'],
  '144': [415999, 'b', 'registry:ck_evt_144:ck_evt_144|:415', 'fa8cb60fc5dd8603d4c0815f5b19b846540988d9b38441431b02c767c20bad4f'],
  '163': [450999, 'b', 'registry:ck_evt_163:ck_evt_163|:450', 'ff419760d923be57065626d1c5cebc81c166acbcb7d209e8be94f4239c1e27a3'],
};
assert.ok(Object.hasOwn(cases, caseId));
const [tick, choice, occurrenceId, gzipSha] = cases[caseId], entryId = 'ck_evt_' + caseId;
const report = { trajectoryScope: 'resumed_old_input_under_new_rules', saveAdmissions, product, entryId, choice, occurrenceId, toolRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  valid: false, lord56Pass: false, route: 'steward-season-report', actions: [], screenshots: [], errors: [],
  limits: ['Historical steward answer already occurred before input. This observes its actual season report becoming visible, not a fresh lord answer.',
    'One occurrence only; this event ID is not asserted to be exclusively steward-owned.', 'DOM checks require separate human screenshot review.'] };
let browser, context, page;
async function state() { return page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state()); }
async function snapshot(label) {
  const s = await state(), json = JSON.stringify(s), file = label + '.state.json.gz';
  writeFileSync(join(out, file), gzipSync(json, { level: 9 }));
  await page.screenshot({ path: join(out, label + '.jpg'), type: 'jpeg', quality: 55 });
  report.screenshots.push({ label, file, sha256: sha(json), image: label + '.jpg' }); return s;
}
async function press(selector, click = true) {
  const el = page.locator(selector); assert.equal(await el.count(), 1); assert.ok(await el.isEnabled());
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const scroll = await el.evaluate(el => {
      const target = el.getBoundingClientRect();
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), b = parent.getBoundingClientRect();
        if (!['auto', 'scroll'].includes(style.overflowY) || parent.scrollHeight <= parent.clientHeight) continue;
        const visibleTop = Math.max(2, b.top), visibleBottom = Math.min(innerHeight - 2, b.bottom);
        if (target.top >= visibleTop && target.bottom <= visibleBottom) return null;
        const x = Math.min(innerWidth - 2, Math.max(2, b.x + b.width / 2));
        const y = Math.min(innerHeight - 2, Math.max(2, b.y + b.height / 2));
        const top = document.elementFromPoint(x, y);
        return top && parent.contains(top) ? { x, y, delta: target.bottom > visibleBottom ? Math.min(300, target.bottom - visibleBottom + 20) : Math.max(-300, target.top - visibleTop - 20),
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
  assert.ok(point, `Unavailable/covered control: ${selector}`);
  if (!click) return point;
  await page.mouse.click(point.x, point.y);
  report.actions.push({ selector, tick: (await state()).tick }); await page.clock.runFor(32);
}

try {
  assert.equal(execFileSync('git', ['diff', product, 'HEAD', '--', 'src', 'package.json', 'package-lock.json'], { encoding: 'utf8' }), '');
  const manifestBytes = readFileSync(join(input, 'manifest.json')), manifest = JSON.parse(manifestBytes);
  const validity = JSON.parse(readFileSync(join(input, 'validity.json')));
  assert.equal(sha(manifestBytes), '71f4d346b18376878f56816063723cffe883b48a9e09fb6b7f1ee3e55be0b6ac');
  assert.equal(validity.manifestSha256, sha(manifestBytes));
  assert.ok(validity.valid && validity.browserEligible && manifest.valid && manifest.browserEligible);
  assert.equal(manifest.sourceRevision, '2485af40046793f1856829fa1161dc4431942aa7'); assert.equal(manifest.seed, 1);
  const records = manifest.captures.filter(row => row.tick === tick); assert.equal(records.length, 1);
  const record = records[0]; assert.equal(record.browserEligible, true);
  assert.equal(record.phase, 'after_all_bot_commands_before_advanceTick');
  assert.equal(record.file, entryId + '-preclose-' + tick + '.save.json.gz');
  const packed = readFileSync(join(input, record.file)); assert.equal(sha(packed), gzipSha); assert.equal(sha(packed), record.fileSha256);
  const raw = gunzipSync(packed), original = JSON.parse(raw), decoded = decodeSave(raw), admitted = decoded.envelope.state;
  assert.equal(sha(raw), record.encodedSha256); assert.equal(original.checksum, record.checksum);
  assert.deepEqual(admitted, original.state); assert.equal(sha(JSON.stringify(admitted)), record.stateSha256);
  assert.equal(admitted.tick, tick); assert.equal(admitted.seed, 1); assert.equal(admitted.scenarioId, 'core:lord_slice');
  const occurrence = admitted.registry.occurrences.find(row => row.id === occurrenceId);
  assert.equal(occurrence?.choiceId, choice); assert.equal(occurrence?.decidedBy, 'steward'); assert.equal(occurrence?.policy, 'customary');
  assert.deepEqual(occurrence, record.occurrence);
  report.input = { record, manifestSha256: sha(manifestBytes), schemaBefore: original.schemaVersion,
    schemaAfter: decoded.envelope.schemaVersion, changedTopLevelKeys: [], stateSha256: sha(JSON.stringify(admitted)) };
  browser = await (await loadChromium()).launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'ko-KR' });
  page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => report.errors.push(String(e)));
  await page.clock.install();
  await context.addInitScript("globalThis.__name ??= target => target; localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));");
  await page.routeWebSocket('**', socket => socket.close()); await routeSceneState(page, raw.toString('utf8'));
  const refused = sceneStateRefusal(page); await page.goto(url + '?phase10-proof=1', { timeout: 90000 });
  await Promise.race([page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined), refused]);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  if (await page.locator('.welcome-dismiss-layer').isVisible()) await press('.welcome-dismiss-layer');
  const before = await snapshot('before'); assert.equal(sha(JSON.stringify(before)), sha(JSON.stringify(withResidentWalkers(admitted))));
  assert.equal(await page.locator('.speed-seal[data-seal="pause"]').getAttribute('aria-pressed'), 'true');
  const autoplay = page.locator('.autoplay-control > button').filter({ hasText: /^\s*자동 발전\s*$/ });
  assert.equal(await autoplay.count(), 1); assert.equal(await autoplay.getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('.season-band:visible').count(), 0, 'Loaded preclose must not invent a newly closed report');
  await press('.speed-seal[data-seal="normal"]');
  for (let frame = 0; frame < 100 && (await state()).tick === tick; frame += 1) await page.clock.runFor(16);
  assert.equal((await state()).tick, tick + 1, 'Observe only the first natural 1x tick');
  if (await page.locator('.speed-seal[data-seal="pause"]').getAttribute('aria-pressed') !== 'true') await press('.speed-seal[data-seal="pause"]');
  const closed = await snapshot('closed'); assert.equal(closed.tick, tick + 1);
  report.readers = await page.evaluate(async ({ occurrenceId, tick, entryId, choice }) => {
    const [{ stewardReport }, { seasonStewardView }, { yearResults }, { SEASON_BAND_COPY }, { V4_COPY }] = await Promise.all([
      import('/src/engine/decisionReads.ts'), import('/src/ui/lord/steward/seasonStewardModel.ts'), import('/src/ui/results/yearResults.ts'),
      import('/src/ui/lord/seasonBand/seasonBandCopy.ko.ts'), import('/src/content/registry/v4Copy.generated.ts')]);
    const s = window.__FEUDAL_PHASE10_PROOF__.state(), from = tick - 999;
    const answerRecords = s.history.records.filter(row => row.template === 'decision.steward'
      && row.params?.subjectId === occurrenceId);
    const ids = new Set(answerRecords.map(row => row.id));
    return { canonical: { title: V4_COPY[entryId].title, body: V4_COPY[entryId].body, ...V4_COPY[entryId].choices[choice] },
      expectedBandSteward: SEASON_BAND_COPY.steward(seasonStewardView(s, from)?.items.length ?? 0),
      season: s.seasons.history.at(-1), report: stewardReport(s, from, tick + 1),
      item: seasonStewardView(s, from)?.items.find(row => row.id === occurrenceId), answerRecords,
      decisions: s.trace.decisions.filter(row => ids.has(row.id)), yearResults: yearResults(s),
      wronglyIncluded: yearResults(s)?.items.filter(row => ids.has(row.decisionId)) ?? [] };
  }, { occurrenceId, tick, entryId, choice });
  const readers = report.readers;
  assert.equal(readers.season.startTick, tick - 999); assert.equal(readers.season.endTick, tick + 1);
  assert.ok(readers.report.events.some(row => row.occurrenceId === occurrenceId && row.entryId === entryId && row.choiceId === choice && row.policy === 'customary'));
  assert.ok(readers.item); assert.ok(readers.decisions.length > 0); assert.ok(readers.decisions.every(row => row.by === 'steward'));
  assert.equal(readers.answerRecords.length, 1);
  assert.equal(readers.answerRecords[0].params.chosen, choice);
  assert.equal(readers.answerRecords[0].decision.chosen, choice);
  assert.equal(readers.answerRecords[0].params.source, 'registry:' + entryId + ':' + choice);
  assert.deepEqual(readers.wronglyIncluded, []);
  report.bandText = await page.locator('.season-band:visible').textContent();
  assert.equal(await page.locator('.season-band:visible [data-item="steward"]').textContent(), readers.expectedBandSteward);
  const beforeNavigation = sha(JSON.stringify(await state()));
  await press('.season-band[data-season="' + readers.season.year + ':' + readers.season.season + '"]');
  const selector = 'li[data-steward-item="' + occurrenceId + '"]';
  await press(selector + ' summary');
  const item = page.locator(selector); assert.equal(await item.locator('details').getAttribute('open'), '');
  assert.equal(await item.locator('summary').textContent(), readers.item.summary);
  const expected = [readers.item.where, readers.item.what, readers.item.policy, ...readers.item.results];
  const actual = await item.locator('dd').allTextContents(); assert.deepEqual(actual, expected);
  // Separate canon checks prevent a wrong selected choice in the presentation model from validating itself.
  const summary = await item.locator('summary').textContent();
  assert.ok(summary.includes(readers.canonical.title)); assert.ok(summary.includes(readers.canonical.label));
  assert.equal(actual[1], readers.canonical.body);
  assert.ok(actual[2].includes(readers.canonical.label));
  assert.equal(actual.at(-1), readers.canonical.chronicle);
  report.navigation = { beforeSha256: beforeNavigation, afterSha256: sha(JSON.stringify(await state())), expected, actual };
  assert.equal(report.navigation.beforeSha256, report.navigation.afterSha256);
  await snapshot('expanded');
  report.exposedDetails = [];
  for (let index = 0; index < expected.length; index += 1) {
    const point = await press(selector + ' dd:nth-of-type(' + (index + 1) + ')', false);
    assert.equal(sha(JSON.stringify(await state())), beforeNavigation, 'Detail navigation changed state');
    await snapshot('detail-' + index); report.exposedDetails.push({ index, text: actual[index], point });
  }
  report.valid = report.errors.length === 0;
} catch (error) {
  report.errors.push(String(error)); report.failureClass = 'steward_route_requires_classification';
  if (page) await snapshot('failure').catch(() => {});
} finally {
  if (context) await context.close().catch(error => report.errors.push('Context close: ' + error));
  if (browser) await browser.close().catch(error => report.errors.push('Browser close: ' + error));
  if (report.errors.length) report.valid = false;
  writeFileSync(join(out, 'steward.json.gz'), gzipSync(JSON.stringify(report, null, 2), { level: 9 }));
}
console.log(JSON.stringify({ entryId, valid: report.valid, lord56Pass: false, errors: report.errors }));
process.exitCode = report.valid ? 0 : 1;
