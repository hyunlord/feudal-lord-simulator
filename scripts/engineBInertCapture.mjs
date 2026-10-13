import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { outcomeSha256 as sha } from './engineBOutcomeArchive.mjs';
import { canonicalTlinkRuleState, TLINK_PARITY_EXCLUSIONS } from './engineBTlinkParity.ts';
import { tlinkImmediateDifferences } from './engineBTlinkOutcomeCategoriesRun.mjs';

export const INERT_CAPTURE_TOOLS = ['engineBInertCapture.mjs', 'engineBInertRun.mjs', 'engineBInertMeasurement.mjs',
  'engineBInertReviewedSources.mjs', 'engineBTlinkOutcomeCategoriesRun.mjs', 'engineBTlinkOutcomeCategories.mjs', 'engineBTlinkOutcomeEvidence.mjs'];

/** A passive replay-side observer; its manifest is published only after the producer verifies original/replay equality. */
export function createInertCapture(seed, output) {
  assert.ok([1, 2, 3].includes(seed), 'Expected seed 1, 2 or 3');
  mkdirSync(output);
  const files = [], seen = new Set();
  let selected;
  return {
    toolFiles: INERT_CAPTURE_TOOLS,
    create(classification) {
      assert.equal(selected, undefined, 'Capture already initialized');
      selected = new Map(classification.rows.filter(row => row.status === 'unclassified'
        || row.status === 'classified' && row.cameHeavyToLord === true).map(row => [row.ordinal, row]));
      return (before, after, command, ordinal) => {
        const row = selected.get(ordinal);
        if (!row) return;
        assert.ok(!seen.has(ordinal), 'Duplicate capture ordinal');
        assert.ok(row.tick === before.tick && row.tick === after.tick && row.command === command.type, 'Capture command identity mismatch');
        if (row.historyId !== null) {
          assert.ok(!before.history?.records.some(item => item.id === row.historyId), 'Answer already existed');
          const matching = after.history?.records.filter(item => item.id === row.historyId);
          assert.equal(matching?.length, 1, 'Capture answer identity mismatch');
          assert.equal(matching[0].kind, 'decision'); assert.equal(matching[0].tick, row.tick);
        }
        const beforeProjection = canonicalTlinkRuleState(before), afterProjection = canonicalTlinkRuleState(after);
        const beforeValue = JSON.parse(beforeProjection), afterValue = JSON.parse(afterProjection);
        const record = { schemaVersion: 1, seed, ordinal, tick: row.tick, historyId: row.historyId, command,
          classificationStatus: row.status, cameHeavyToLord: row.cameHeavyToLord, mature: row.tick + 12000 <= 500000,
          exclusions: TLINK_PARITY_EXCLUSIONS, rawBeforeSha256: sha(JSON.stringify(before)), rawAfterSha256: sha(JSON.stringify(after)),
          beforeRuleSha256: sha(beforeProjection), afterRuleSha256: sha(afterProjection), before: beforeValue, after: afterValue,
          differences: tlinkImmediateDifferences(beforeValue, afterValue), observerStateHashesStable: true, categoriesAssigned: false };
        const bytes = Buffer.from(`${JSON.stringify(record)}\n`), compressed = gzipSync(bytes), file = `answer-${String(ordinal).padStart(6, '0')}.json.gz`;
        writeFileSync(join(output, file), compressed, { flag: 'wx' });
        files.push({ file, sha256: sha(compressed), rawSha256: sha(bytes), ordinal, historyId: row.historyId }); seen.add(ordinal);
      };
    },
    complete(directory) {
      assert.ok(selected, 'Capture not initialized');
      assert.equal(files.length, selected.size, 'Incomplete capture');
      const names = ['manifest.json', 'preflight.json', 'original-contexts.json.gz', 'answer-classification.json', 'collect-parity.json', 'original-final-state.json.gz'];
      const inputs = Object.fromEntries(names.map(name => [name, readFileSync(join(directory, name))]));
      const manifest = JSON.parse(inputs['manifest.json']), parity = JSON.parse(inputs['collect-parity.json']);
      assert.equal(manifest.valid, true); assert.equal(manifest.replayVerified, true);
      assert.equal(manifest.seed, seed); assert.equal(manifest.years, 125); assert.equal(manifest.final.tick, 500000);
      assert.equal(manifest.finalComparison.expectedSha256, manifest.finalComparison.actualSha256);
      for (const file of files) {
        const row = JSON.parse(gunzipSync(readFileSync(join(output, file.file))));
        const checkpoint = parity.checkpoints.filter(point => point.phase === 'command' && point.commandOrdinal === row.ordinal);
        assert.equal(checkpoint.length, 1); assert.equal(checkpoint[0].hash, row.afterRuleSha256, 'Captured after state differs from original');
      }
      const capture = { schemaVersion: 1, status: 'verified_original_replay_observer_capture', capturePhase: 'producer_replay',
        sourceRevision: manifest.sourceRevision, executionHead: manifest.sourceRevision, seed, years: 125, tick: manifest.final.tick,
        commandCount: manifest.commandCount, originalManifestSha256: sha(inputs['manifest.json']),
        inputHashes: Object.fromEntries(names.map(name => [name, sha(inputs[name])])), sourceFiles: manifest.sourceFiles,
        toolHashes: manifest.toolHashes, node: manifest.source.node, lockSha256: manifest.source.lock,
        helperSha256: sha(readFileSync(new URL(import.meta.url))), files,
        selectedHeavy: [...selected.values()].filter(row => row.status === 'classified').length,
        unclassified: [...selected.values()].filter(row => row.status === 'unclassified').length,
        commandStreamMatched: true, collectParityMatched: true, fullFinalStateMatched: true,
        originalFullFinalSha256: sha(gunzipSync(inputs['original-final-state.json.gz'])), exclusions: TLINK_PARITY_EXCLUSIONS,
        categoriesAssigned: false, limits: ['Capture is passive during the existing replay; producer verifies independent original/replay archive, command, context, parity and final-state equality.',
          'Immediate before states without an original same-tick checkpoint rely on this observer and original/replay determinism.'] };
      writeFileSync(join(output, 'manifest.json'), `${JSON.stringify(capture, null, 2)}\n`, { flag: 'wx' });
    },
  };
}
