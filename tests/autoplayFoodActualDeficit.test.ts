import assert from 'node:assert/strict';
import test from 'node:test';
import { foodCoverageAction, granaryCoverageTargetIds } from '../src/engine/autoplayFoodCoverage';
import { foodObservationTicks, refreshFoodObservation } from '../src/engine/autoplayFoodThroughput';
import { gameReducer } from '../src/state/gameStore';
import { completeEligibleConstruction } from '../src/engine/constructionLifecycle';
import type { GameState } from '../src/engine/engine.types';
import { building, routedStockTown } from './helpers/autoplayFoodFixtures';

function emptyHomeTown() {
  const base = routedStockTown(true);
  return { ...base, treasuryTimber: 1000,
    buildings: base.buildings.map(building => building.kind === 'granary'
      ? { ...building, inventory: { bread: 100 } } : building),
    houses: base.houses.map(house => ({ ...house, breadStock: house.buildingId === 'home7' ? 0 : 6,
      residents: house.buildingId === 'home7' ? 0 : 16, emptyFoodTicks: 0 })),
  };
}

test('Given persistent actual in-range vacancy below ideal demand When delivery opportunities pass Then coverage requests recovery', () => {
  const observed = refreshFoodObservation(emptyHomeTown());
  const later = refreshFoodObservation({ ...observed, tick: observed.tick + 2000 });
  assert.notEqual(foodCoverageAction(later).kind, 'none');
});

test('Given newly observed never-serviced vacancy in an old world When coverage is assessed Then world age is not delivery persistence', () => {
  const observed = refreshFoodObservation({ ...emptyHomeTown(), tick: 1200000 });
  assert.deepEqual(foodCoverageAction(observed), { kind: 'none' });
});

for (const reset of ['positive-stock', 'delivery-consumed', 'removed'] as const) {
  test(`Given persistent empty home When ${reset} occurs Then stale deficit evidence is discarded`, () => {
    const observed = refreshFoodObservation(emptyHomeTown());
    const later = { ...observed, tick: observed.tick + 2000,
      houses: observed.houses.flatMap(house => house.buildingId !== 'home7' ? [house]
        : reset === 'removed' ? [] : [{ ...house, breadStock: reset === 'positive-stock' ? 1 : 0,
          lastServicedTick: observed.tick + 2000 }]),
    };
    assert.deepEqual(foodCoverageAction(refreshFoodObservation(later)), { kind: 'none' });
  });
}

test('Given no stock or labor or route When actual empty persistence passes Then coverage does not claim a granary remedy', () => {
  const observed = refreshFoodObservation(emptyHomeTown());
  const persistent = refreshFoodObservation({ ...observed, tick: observed.tick + 2000 });
  for (const state of [
    { ...persistent, buildings: persistent.buildings.map(building => ({ ...building, inventory: {} })) },
    { ...persistent, buildings: persistent.buildings.map(building => ({ ...building, workers: 0 })) },
    { ...persistent, tiles: persistent.tiles.map(tile => ({ ...tile, hasRoad: false })), pathCache: {} },
  ]) assert.deepEqual(foodCoverageAction(state), { kind: 'none' });
});

test('Given unchanged empty evidence When a tick passes Then records preserve their references', () => {
  const first = refreshFoodObservation(emptyHomeTown());
  const later = refreshFoodObservation({ ...first, tick: first.tick + 1 });
  assert.equal(later.autoplayEmptyHomes, first.autoplayEmptyHomes);
});

test('Given targeted granary placement When construction completes Then beneficiary IDs survive with a finite targeted travel opportunity', () => {
  const first = refreshFoodObservation(emptyHomeTown());
  const state = refreshFoodObservation({ ...first, tick: first.tick + 2000 });
  const placed = gameReducer(state, { type: 'place_building', kind: 'granary', tx: 12, ty: 2, autoplayFoodObservation: true });
  assert.deepEqual(placed.autoplayFoodObservation?.targetHouseIds, ['home7']);
  const site = placed.constructionSites.find(candidate => candidate.id === placed.autoplayFoodObservation?.siteId);
  assert.ok(site);
  const completed = completeEligibleConstruction({ ...placed, wallTick: placed.wallTick + 1000, constructionSites: [{ ...site, delivered: { timber: 40 }, builderTicks: site.requiredBuilderTicks }] });
  assert.deepEqual(completed.autoplayFoodObservation?.targetHouseIds, ['home7']);
  const provider = completed.buildings.find(building => building.id === site.id);
  assert.ok(provider);
  assert.equal(foodObservationTicks(completed, provider), 484);
  assert.equal(foodObservationTicks(completed, { ...provider, inventory: { bread: 1 } }, ['home7']), 970);
  assert.equal(completed.autoplayFoodObservation?.observeUntilTick, state.tick + 1190);
});

for (const scenario of ['same-unresolved', 'credited-other-target', 'removed-target', 'recovered-new-episode']) {
  test(`Given completed ineffective granary then another food project When ${scenario} is assessed Then only the unresolved target remains blocked`, () => {
    const first = refreshFoodObservation(emptyHomeTown());
    const persistent = refreshFoodObservation({ ...first, tick: first.tick + 2000 });
    const failed = { kind: 'granary' as const, siteId: 'failed', targetHouseIds: [scenario === 'removed-target' ? 'removed-home' : 'home7'],
      placedTick: first.tick + 100, completedTick: first.tick + 200, observeUntilTick: first.tick + 500,
      deliveredTargetHouseIds: scenario === 'credited-other-target' ? ['home0'] : [],
      outcome: { outputDelta: 0, deliveredBreadDelta: scenario === 'credited-other-target' ? 1 : 0, starvingHomesDelta: 0, effective: scenario === 'credited-other-target' } };
    const terminal = refreshFoodObservation({ ...persistent, autoplayFoodObservation: failed,
      ...(scenario === 'recovered-new-episode' ? { autoplayEmptyHomes: [{ buildingId: 'home7', sinceTick: first.tick + 200, lastServicedTick: 0 }] } : {}),
    });
    const state = { ...terminal,
      autoplayFoodObservation: { kind: 'mill' as const, siteId: 'other', placedTick: first.tick + 600, completedTick: first.tick + 700, observeUntilTick: first.tick + 800 },
      ...(scenario === 'recovered-new-episode' ? { autoplayEmptyHomes: [{ buildingId: 'home7', sinceTick: first.tick + 200, lastServicedTick: 0 }] } : {}),
    };
    assert.equal(foodCoverageAction(state).kind === 'none', scenario === 'same-unresolved' || scenario === 'credited-other-target');
  });
}

test('Given targeted granary construction is cancelled When the next recovery is assessed Then unfinished observation leaves no failed recovery lock', () => {
  const first = refreshFoodObservation(emptyHomeTown());
  const persistent = refreshFoodObservation({ ...first, tick: first.tick + 2000 });
  const placed = gameReducer(persistent, { type: 'place_building', kind: 'granary', tx: 12, ty: 2, autoplayFoodObservation: true });
  const observed = refreshFoodObservation(placed);
  const siteId = observed.autoplayFoodObservation?.siteId;
  assert.ok(siteId);
  const cancelled = gameReducer(observed, { type: 'cancel_construction', siteId });
  assert.equal(cancelled.autoplayEmptyHomes?.some(entry => entry.failedRecovery), false);
  assert.notEqual(foodCoverageAction(cancelled).kind, 'none');
});

test('Given an old failed range gap and a new opposite range gap When new target is covered Then the old gap does not subtract its score', () => {
  const source = { ...building('provider', 'granary', 64, 2, 2), inventory: { bread: 100 } };
  const state: GameState = { ...emptyHomeTown(), width: 128, height: 6,
    buildings: [source, building('old', 'house', 5, 0, 0), building('new', 'house', 120, 0, 0)],
    houses: ['old', 'new'].map(buildingId => ({ buildingId, level: 0, residents: 0, breadStock: 0, hasWater: true, lastServicedTick: 0, unmetRequirementTicks: 0 })),
    tiles: Array.from({ length: 768 }, (_, n) => ({ tx: n % 128, ty: Math.floor(n / 128), terrain: 'grass', buildingId: null, hasRoad: Math.floor(n / 128) === 1 })),
    autoplayFoodObservation: { kind: 'granary', siteId: 'failed', targetHouseIds: ['old'], placedTick: 5000, completedTick: 5100, observeUntilTick: 5500,
      outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false } },
  };
  const observed = refreshFoodObservation({ ...state, tick: 4900, autoplayFoodObservation: undefined });
  const terminal = refreshFoodObservation({ ...observed, tick: 6000, autoplayFoodObservation: state.autoplayFoodObservation });
  assert.equal(terminal.autoplayEmptyHomes?.find(entry => entry.buildingId === 'old')?.failedRecovery, true);
  const replaced = { ...terminal, autoplayFoodObservation: undefined };
  assert.notEqual(foodCoverageAction(replaced).kind, 'none');
});

test('Given a failed home is excluded from a new recovery When accepted placement captures beneficiaries Then the excluded old home cannot validate the new repair', () => {
  const base = emptyHomeTown();
  const first = refreshFoodObservation({ ...base, houses: base.houses.map(home => home.buildingId === 'home0' ? { ...home, breadStock: 0, residents: 0 } : home) });
  const persistent = refreshFoodObservation({ ...first, tick: first.tick + 2000 });
  const state = { ...persistent, autoplayFoodObservation: { kind: 'granary' as const, siteId: 'failed', targetHouseIds: ['home0'], placedTick: 6100, completedTick: 6200, observeUntilTick: 6500,
    outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false } } };
  assert.deepEqual(granaryCoverageTargetIds(state, { tx: 12, ty: 2 }), ['home7']);
});

test('Given missed target is fed after the finite window When it later becomes empty again Then actual recovery starts a new eligible episode', () => {
  const base = emptyHomeTown();
  const failed = { kind: 'granary' as const, siteId: 'failed', targetHouseIds: ['home7'], placedTick: 5000, completedTick: 5100, observeUntilTick: 5500,
    outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false } };
  const fed = refreshFoodObservation({ ...base, autoplayFoodObservation: failed,
    houses: base.houses.map(home => home.buildingId === 'home7' ? { ...home, breadStock: 1, lastServicedTick: base.tick } : home) });
  const emptied = refreshFoodObservation({ ...fed, tick: fed.tick + 400,
    houses: fed.houses.map(home => home.buildingId === 'home7' ? { ...home, breadStock: 0 } : home) });
  const persistent = refreshFoodObservation({ ...emptied, tick: emptied.tick + 2000 });
  assert.notEqual(foodCoverageAction(persistent).kind, 'none');
});

test('Given alternating failed granaries for two empty episodes When the second observation replaces the first Then neither failed episode can repeat', () => {
  const base = emptyHomeTown();
  const first = refreshFoodObservation({ ...base, houses: base.houses.map(home => ({ ...home, breadStock: ['home0', 'home7'].includes(home.buildingId) ? 0 : home.breadStock })) });
  const terminal = (state: GameState, target: string, tick: number) => refreshFoodObservation({ ...state, tick,
    autoplayFoodObservation: { kind: 'granary', siteId: target, targetHouseIds: [target], placedTick: tick - 1900, completedTick: tick - 1800, observeUntilTick: tick - 1400,
      outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false } } });
  const failedA = terminal(first, 'home0', first.tick + 2000);
  assert.notEqual(foodCoverageAction(failedA).kind, 'none');
  const failedB = terminal(failedA, 'home7', first.tick + 4000);
  assert.deepEqual(foodCoverageAction(failedB), { kind: 'none' });
  const delivered = refreshFoodObservation({ ...failedB, tick: failedB.tick + 1,
    houses: failedB.houses.map(home => home.buildingId === 'home0' ? { ...home, lastServicedTick: failedB.tick + 1 } : home) });
  assert.notEqual(foodCoverageAction(refreshFoodObservation({ ...delivered, tick: delivered.tick + 2000 })).kind, 'none');
});

test('Given completed targeted observation before its deadline When empty records refresh Then no failure is recorded before a finite delivery opportunity ends', () => {
  const first = refreshFoodObservation(emptyHomeTown());
  const observation = { kind: 'granary' as const, siteId: 'pending-window', targetHouseIds: ['home7'],
    placedTick: first.tick, completedTick: first.tick + 1, observeUntilTick: first.tick + 500 };
  const before = refreshFoodObservation({ ...first, tick: first.tick + 499, autoplayFoodObservation: observation });
  assert.equal(before.autoplayEmptyHomes?.some(entry => entry.failedRecovery), false);
  const terminal = refreshFoodObservation({ ...before, tick: first.tick + 500 });
  assert.equal(terminal.autoplayEmptyHomes?.find(entry => entry.buildingId === 'home7')?.failedRecovery, true);
});
