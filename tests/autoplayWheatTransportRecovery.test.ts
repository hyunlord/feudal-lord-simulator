import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { GameState } from '../src/engine/engine.types';
import { decideNextAction } from '../src/engine/autoplay';
import { measuredFoodDecision } from '../src/engine/autoplayFoodMeasuredDecision';
import type { FoodDiagnosticCollector } from '../src/engine/autoplayFoodDiagnostic';
import { migrateStateV9ToV10 } from '../src/save/migrations/v9ToV10';

// AF-13/AF-12: this natural fixture predates the arable-fields work order (a raw wheat_farm town, no zones), so
// the v9->v10 migration (wheat farms -> arable strips + a tending farmstead) is applied on load, the same way an
// old save is opened, before exercising the current grain/mill/transport rules against it.
function loadWheatTransportTown(): GameState {
  const raw: GameState = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/autoplay-recovery/wheat-transport-seed1.json.gz', import.meta.url))).toString());
  return migrateStateV9ToV10(raw);
}

test('R-T15 an observed transport bottleneck yields a bounded recovery action in the natural seed 1 town', async () => {
  // Given the unchanged A5-1 seed 1 natural final state, migrated to v10 (as an old save opens) and run a
  // fixed, deterministic 3,600 ticks so the newly-placed farmstead is staffed and the expected-harvest
  // measurement settles (the tick right after migration is a transient staffing/measurement window, not the
  // town's steady state).
  const { advanceTick } = await import('../src/engine/tick');
  const { replayFoodObservation } = await import('./foodEfficiencyObservationFixture');
  let state: GameState = loadWheatTransportTown();
  for (let tick = 0; tick < 3600; tick += 1) state = advanceTick(state);
  // LB-7 (C3): with an intake cart per mill and granary pushes, the measured bread deficit behind stocked mills that
  // this town showed under the one-cart rule is gone: every mill holds wheat and the supply is sufficient.
  assert.ok(state.buildings.filter(b => b.kind === 'mill').every(b => (b.inventory.wheat ?? 0) > 0));
  assert.deepEqual(measuredFoodDecision(state), { kind: null, reason: 'food_supply_sufficient' });
  // When the same town then observes a window where bread falls short behind those stocked mills (replayed flow).
  const short = replayFoodObservation(state, { wheat: 1000, bread: 40, exports: 0 });
  assert.deepEqual(measuredFoodDecision(short), { kind: 'mill', reason: 'actual_bread_deficit' });
  const diagnostic: FoodDiagnosticCollector = {};
  // When the full advisor evaluates it through its actual priority and search budget.
  const action = decideNextAction(short, { maxHousingLots: 24 }, diagnostic);
  // Then the cause has an actionable response rather than an eternal none.
  assert.notEqual(action.kind, 'none');
  assert.equal(diagnostic.food?.reason, 'recovery_selected');
  assert.equal(diagnostic.food?.recovery, 'mill');
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
  // When normal ticks execute the complete advisor's real actions every 120 ticks.
  for (let tick = 0; tick < 24000; tick += 1) {
    if (state.tick % 120 === 0) {
      const action = decideNextAction(state, { maxHousingLots: 24 });
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
  // AF-13: the guardrail that used to keep mills at or under the farm count is now the expected-harvest-based
  // mill limit (foodFacilityWithinLimit), which lets grain capacity grow (farmsteads) alongside mills rather
  // than pinning it to the (now-vestigial) wheat_farm count.
  assert.ok(placements.includes('farmstead'), 'grain capacity grows alongside mill capacity, not pinned to the old farm count');
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
