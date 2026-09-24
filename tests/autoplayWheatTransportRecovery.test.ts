import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { GameState } from '../src/engine/engine.types';
import { foodAction } from '../src/engine/autoplayFood';
import { measuredFoodDecision } from '../src/engine/autoplayFoodMeasuredDecision';
import type { FoodDiagnosticCollector } from '../src/engine/autoplayFoodDiagnostic';

test('R-T15 an observed transport bottleneck yields a bounded recovery action in the natural seed 1 town', () => {
  // Given the unchanged A5-1 seed 1 natural final state.
  const state: GameState = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/autoplay-recovery/wheat-transport-seed1.json.gz', import.meta.url))).toString());
  assert.equal(measuredFoodDecision(state).reason, 'wheat_transport_blocked');
  const diagnostic: FoodDiagnosticCollector = {};
  // When the actual food planner evaluates it.
  const action = foodAction(state, () => ({ kind: 'none' }), diagnostic);
  // Then the cause has an actionable response rather than an eternal none.
  assert.notEqual(action.kind, 'none');
  assert.equal(diagnostic.food?.reason, 'transport_capacity_selected');
});

test('R-T15 normal construction and deliveries clear every empty home within 24000 ticks', async () => {
  // Given the portable, unedited natural state, with no injected resources or roads.
  let state: GameState = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/autoplay-recovery/wheat-transport-seed1.json.gz', import.meta.url))).toString());
  const { advanceTick } = await import('../src/engine/tick');
  const { autoplayActionToGameAction } = await import('../src/engine/autoplayActions');
  const { gameReducer } = await import('../src/state/gameStore');
  const startedTick = state.tick;
  let firstSuppliedTick: number | null = null;
  const placements: string[] = [];
  // When normal ticks execute the food advisor's real actions every 120 ticks.
  for (let tick = 0; tick < 24000; tick += 1) {
    if (state.tick % 120 === 0) {
      const action = foodAction(state, () => ({ kind: 'none' }));
      const command = autoplayActionToGameAction(action, state);
      if (command !== null) {
        if (action.kind === 'place_building') placements.push(action.building);
        state = gameReducer(state, command);
      }
    }
    state = advanceTick(state);
    if (firstSuppliedTick === null && state.houses.every(house => house.breadStock > 0)) firstSuppliedTick = state.tick;
  }
  // Then actual delivery clears the empty homes, without breaching either facility cap.
  assert.ok(firstSuppliedTick !== null && firstSuppliedTick - startedTick <= 24000);
  assert.equal(state.houses.filter(house => house.breadStock === 0).length, 0);
  assert.ok(placements.includes('mill'));
  assert.ok(state.buildings.filter(b => b.kind === 'mill').length <= state.buildings.filter(b => b.kind === 'wheat_farm').length);
  assert.equal(state.buildings.filter(b => b.kind === 'granary').length, 7);
});

test('transport capacity recovery preserves the existing prohibition on adding mills with empty input', async () => {
  // Given the natural town with a deliberately emptied existing mill.
  const state: GameState = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/autoplay-recovery/wheat-transport-seed1.json.gz', import.meta.url))).toString());
  const mill = state.buildings.find(b => b.kind === 'mill');
  assert.ok(mill);
  const blocked = { ...state, buildings: state.buildings.map(b => b.id === mill.id ? { ...b, inventory: { ...b.inventory, wheat: 0 } } : b) };
  const { wheatTransportCapacityAction } = await import('../src/engine/autoplayWheatTransportRecovery');
  // When additional local conversion is considered.
  const action = wheatTransportCapacityAction(blocked);
  // Then hauling must recover before another mill can be built.
  assert.equal(action.kind, 'none');
});
