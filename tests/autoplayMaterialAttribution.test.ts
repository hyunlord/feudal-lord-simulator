import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceTick } from '../src/engine/tick';
import { materialTown } from './autoplayMaterialFixtures';
import type { GameState } from '../src/engine/engine.types';
function untilOutput(input: GameState): GameState {
  let state = input;
  for (let i = 0; i < 1600; i++) {
    state = advanceTick(state);
    if (state.walkers.some(w => w.kind === 'carter' && w.homeBuildingId === 'masonry' && w.mission === 'deliver' && w.phase === 'outbound' && w.cargo?.resource === 'stone')) return state;
  }
  throw new Error('No ordinary output dispatch within fixture bound');
}
test('Given a save imported midway through raw fetch When it returns and produces Then only a newly observed later dispatch can start its cycle', () => {
  const original = advanceTick(materialTown(40));
  const fetched = original.walkers.find(w => w.kind === 'carter' && w.homeBuildingId === 'masonry'); assert.ok(fetched);
  const { autoplayMaterialRecovery: _old, ...imported } = original;
  let state: GameState = imported;
  for (let i = 0; i < 800; i++) {
    state = advanceTick(state);
    const record = state.autoplayMaterialRecovery;
    assert.ok(record?.status === 'observing');
    assert.notEqual(record.cycle?.fetchWalkerId, fetched.id);
    assert.notEqual(record.completedCycle?.fetchWalkerId, fetched.id);
  }
});
test('Given real outbound stone When its target is removed Then cancelled or logically recovered cargo never becomes accepted wall delivery or a completed cycle', () => {
  let state = untilOutput(materialTown());
  state = { ...state, constructionSites: [] };
  for (let i = 0; i < 200; i++) state = advanceTick(state);
  const record = state.autoplayMaterialRecovery;
  assert.ok(record?.status === 'observing');
  assert.equal(record.completedCycle, undefined);
  assert.equal(record.cycle?.wallDelivered ?? 0, 0);
});
test('Given an accepted output delivery When the return road is broken Then physical-return qualification never comes from cancellation recovery', () => {
  let state = untilOutput(materialTown(40));
  for (let i = 0; i < 200; i++) {
    state = advanceTick(state);
    const record = state.autoplayMaterialRecovery;
    if (record?.status === 'observing' && (record.cycle?.wallDelivered ?? 0) > 0) break;
  }
  const before = state.autoplayMaterialRecovery; assert.ok(before?.status === 'observing' && before.cycle && before.cycle.wallDelivered > 0);
  state = { ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: false })), roadRevision: state.roadRevision + 1, pathCache: {} };
  for (let i = 0; i < 20; i++) state = advanceTick(state);
  const after = state.autoplayMaterialRecovery; assert.ok(after?.status === 'observing');
  assert.equal(after.completedCycle, undefined);
});
