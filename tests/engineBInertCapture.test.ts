import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { newGameState } from '../src/state/newGame';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig';
import { observeOutcomeCommand } from '../scripts/engineBOutcomeProduce';
const capture = await import(new URL('../scripts/engineBInertCapture.mjs', import.meta.url).href);

test('capture writes exhaustive immediate differences without mutating its observed states', () => {
  const root = mkdtempSync(join(tmpdir(), 'inert-capture-'));
  try {
    const before = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 }); assert.ok(before);
    const after = { ...before, treasuryCoin: before.treasuryCoin + 1 };
    const recorder = capture.createInertCapture(1, join(root, 'capture'));
    const command = { type: 'order_timber', amount: 0 } as const;
    const observe = recorder.create({ rows: [{ ordinal: 1, tick: 0, command: command.type, status: 'classified', cameHeavyToLord: true, historyId: null }] });
    observeOutcomeCommand(observe, before, after, command, 1);
    const row = JSON.parse(gunzipSync(readFileSync(join(root, 'capture', 'answer-000001.json.gz'))).toString());
    assert.equal(row.before.treasuryCoin, before.treasuryCoin);
    assert.equal(row.after.treasuryCoin, after.treasuryCoin);
    assert.ok(row.differences.some((delta: { path: string }) => delta.path === '/treasuryCoin'));
    assert.equal(row.categoriesAssigned, false);
    assert.equal(readdirSync(join(root, 'capture')).includes('manifest.json'), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('capture rejects command identity drift and never publishes a manifest for partial capture', () => {
  const root = mkdtempSync(join(tmpdir(), 'inert-capture-'));
  try {
    const state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 }); assert.ok(state);
    const recorder = capture.createInertCapture(1, join(root, 'capture'));
    const observe = recorder.create({ rows: [{ ordinal: 1, tick: 2, command: 'order_timber', status: 'classified', cameHeavyToLord: true, historyId: null }] });
    assert.throws(() => observeOutcomeCommand(observe, state, state, { type: 'order_timber', amount: 0 }, 1), /identity/);
    assert.deepEqual(readdirSync(join(root, 'capture')), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
