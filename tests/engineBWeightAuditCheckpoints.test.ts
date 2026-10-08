import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRegistryCheckpointObserver } from '../scripts/engineBWeightAuditCheckpoints';
import { newGameState } from '../src/state/newGame';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig';
import type { GameState } from '../src/engine/engine.types';
import type { HistoryRecord } from '../src/engine/history.types';
import type { TracedDecision } from '../src/engine/decisionTrace.types';

const decision: TracedDecision = { id: 'h-checkpoint', tick: 10, by: 'lord', kind: 'registry', source: 'registry:ck_evt_057:a', weights: ['rights'], targets: ['dues'] };
const own: HistoryRecord = { id: decision.id, tick: 10, kind: 'decision', template: 'decision.card', severity: 1,
  subject: { type: 'town', id: 'town' }, decision: { chosen: 'a', alternatives: ['b'], predicted: {} } };
function fixture(tick: number, extra: readonly HistoryRecord[] = []): GameState {
  const initial = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 });
  assert.ok(initial);
  return { ...initial, tick, trace: { decisions: [decision], acts: [] }, history: { records: [own, ...extra], snapshots: [], nextOrdinal: 1, seasonDecisions: {}, milestones: [], pendingActuals: [] } };
}
const consequence = (tick: number): HistoryRecord => ({ id: `h-after-${tick}`, tick, kind: 'event', template: 'consequence', severity: 1,
  subject: { type: 'town', id: 'town' }, because: [{ decisionId: decision.id, key: 'payment_flow', part: true }] });

test('checkpoints preserve actual state, reject same-tick receipts, save only one pair, and hash official encoded bytes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'eb-checkpoints-'));
  try {
    const observer = createRegistryCheckpointObserver({ directory, sourceRevision: 'a'.repeat(40), dirtyPaths: '', enabledIds: ['ck_evt_057'], endTickExclusive: 4000 });
    const before = fixture(10, [consequence(10)]), fingerprint = JSON.stringify(before);
    observer.observe(before); observer.observe(before);
    assert.equal(JSON.stringify(before), fingerprint);
    assert.equal(readdirSync(directory).filter(name => name.endsWith('.gz')).length, 1);
    const after = fixture(11, [consequence(10), consequence(11)]);
    observer.observe(after);
    const repeated = fixture(12, [consequence(12), { ...own, id: 'h-second', tick: 12 }]);
    observer.observe({ ...repeated, trace: { decisions: [decision, { ...decision, id: 'h-second', tick: 12 }], acts: [] } });
    const manifest = observer.finish(fixture(12, [consequence(12)]));
    assert.equal(manifest.pairs.length, 1);
    assert.equal(manifest.pairs[0]?.status, 'paired');
    assert.equal(manifest.pairs[0]?.consequence?.historyTick, 11);
    assert.equal(manifest.pairs[0]?.consequence?.observedTick, 11);
    assert.equal(readdirSync(directory).filter(name => name.endsWith('.gz')).length, 3);
    const checkpoint = manifest.pairs[0]?.answer;
    assert.ok(checkpoint);
    const compressed = readFileSync(join(directory, checkpoint.file));
    assert.equal(createHash('sha256').update(compressed).digest('hex'), checkpoint.fileSha256);
    const decoded: unknown = JSON.parse(gunzipSync(compressed).toString('utf8'));
    assert.ok(typeof decoded === 'object' && decoded !== null && 'state' in decoded);
    assert.deepEqual(decoded.state, before);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('missing future links are censored until the full window; later than three years cannot pair', () => {
  const directory = mkdtempSync(join(tmpdir(), 'eb-checkpoint-window-'));
  try {
    const observer = createRegistryCheckpointObserver({ directory, sourceRevision: 'a'.repeat(40), dirtyPaths: '', enabledIds: ['ck_evt_057'], endTickExclusive: 16000 });
    observer.observe(fixture(10));
    const initialManifest: unknown = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
    assert.ok(JSON.stringify(initialManifest).includes('censored_without_observed_future_link'));
    observer.observe(fixture(12011, [consequence(12011)]));
    const manifest = observer.finish(fixture(12011));
    assert.equal(manifest.pairs[0]?.status, 'mature_without_observed_future_link');
    assert.equal(manifest.pairs[0]?.consequence, undefined);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('dirty provenance is rejected before artifacts are created', () => {
  assert.throws(() => createRegistryCheckpointObserver({ directory: '/unused', sourceRevision: 'a'.repeat(40), dirtyPaths: ' M src/file.ts', enabledIds: [], endTickExclusive: 1 }), /clean source/);
});


test('lapsed and endpoint answers are excluded from selected pairs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'eb-checkpoint-excluded-'));
  try {
    const observer = createRegistryCheckpointObserver({ directory, sourceRevision: 'a'.repeat(40), dirtyPaths: '', enabledIds: ['ck_evt_057'], endTickExclusive: 10 });
    const state = fixture(10);
    observer.observe({ ...state, trace: { decisions: [{ ...decision, tick: 9, lapsed: true }], acts: [] } });
    observer.observe(state);
    assert.equal(readdirSync(directory).length, 0);
    const manifest = observer.finish(state);
    assert.equal(manifest.pairs.length, 0);
    assert.deepEqual(manifest.enabledWithoutAnsweredCheckpoint, ['ck_evt_057']);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
