import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { encodeSave, decodeSave } from '../src/save/saveCodec';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { SAVE_SCHEMA_VERSION } from '../src/save/saveTypes';

test('schema v3 migration does not invent an elapsed timber shortage', () => {
  // Given a genuine prior schema envelope.
  const bytes = new Uint8Array(readFileSync(new URL('../fixtures/saves/v3/paused-farm.save.json', import.meta.url)));
  // When it migrates through v4.
  const result = decodeSave(bytes);
  // Then optional evidence remains absent rather than licensing instant expansion.
  assert.equal(result.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(result.migratedFrom, 3);
  assert.equal(result.envelope.state.timberProductionWindow?.expansionShortageSinceTick, undefined);
});

test('a measured timber shortage clock survives save and restore exactly', () => {
  // Given a prepared chronology used solely to verify the save contract.
  const state = { ...structuredClone(DEFAULT_GAME_STATE), tick: 3000,
    timberProductionWindow: { startTick: 601, throughTick: 3000, produced: 0, productionTicks: [], expansionShortageSinceTick: 2500 } };
  // When a normal save is round-tripped.
  const saved = encodeSave({ state, gameVersion: 'test', createdAt: '2026-09-24T00:00:00.000Z', savedAt: '2026-09-24T00:00:00.000Z' });
  const loaded = decodeSave(saved.bytes);
  // Then no shortage time is lost or fabricated.
  assert.deepEqual(loaded.envelope.state.timberProductionWindow, state.timberProductionWindow);
});
