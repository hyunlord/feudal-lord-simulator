import assert from 'node:assert/strict';
import test from 'node:test';
import type { DistributorWalker } from '../src/agents/walker.types';
import type { GameState } from '../src/engine/engine.types';
import { BALANCE } from '../src/content/balanceConfig';
import { advanceTick } from '../src/engine/tick';
import { building, routedStockTown } from './helpers/autoplayFoodFixtures';

function distributor(homeBuildingId: string): DistributorWalker {
  return {
    id: `distributor:${homeBuildingId}:test`,
    kind: 'distributor',
    phase: 'roaming',
    homeBuildingId,
    position: { tx: 7, ty: 1 },
    path: [{ tx: 7, ty: 1 }],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: 'bread', amount: 2 },
    spawnedTick: 0,
    junctionVisits: 0,
    tilesTravelled: 0,
    priorTile: null,
  };
}

test('Given another granary feeds a starving home during new granary observation Then delivery is not credited', () => {
  const base = routedStockTown(true);
  const oldGranary = { ...building('old-granary', 'granary', 1, 2, 2), reserved: { bread: 2 } };
  const newGranary = building('new-granary', 'granary', 4, 2, 2);
  const state = {
    ...base,
    tick: BALANCE.DISTRIBUTOR_INTERVAL - 2,
    buildings: [oldGranary, newGranary, ...base.buildings.filter(candidate => candidate.kind !== 'granary')],
    walkers: [distributor(oldGranary.id)],
    autoplayFoodObservation: {
      kind: 'granary' as const,
      siteId: newGranary.id,
      placedTick: 10,
      completedTick: BALANCE.DISTRIBUTOR_INTERVAL - 3,
      observeUntilTick: BALANCE.DISTRIBUTOR_INTERVAL + 100,
      baseline: { outputTotal: 0, houseBread: 14, starvingHomes: 1 },
      latest: { outputTotal: 0, houseBread: 14, starvingHomes: 1 },
      outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false },
    },
  };
  const next = advanceTick(state);
  assert.equal(next.houses.find(house => house.buildingId === 'home7')?.breadStock, 2);
  assert.equal(next.autoplayFoodObservation?.outcome?.deliveredBreadDelta, 0);
  assert.equal(next.autoplayFoodObservation?.outcome?.starvingHomesDelta, 1);
  assert.equal(next.autoplayFoodObservation?.outcome?.effective, false);
});

test('Given observed granary feeds a starving home during observation Then delivery is credited', () => {
  const base = routedStockTown(true);
  const observedGranary = { ...building('new-granary', 'granary', 4, 2, 2), reserved: { bread: 2 } };
  const state = {
    ...base,
    tick: BALANCE.DISTRIBUTOR_INTERVAL - 2,
    buildings: [observedGranary, ...base.buildings.filter(candidate => candidate.kind !== 'granary')],
    walkers: [distributor(observedGranary.id)],
    autoplayFoodObservation: {
      kind: 'granary' as const,
      siteId: observedGranary.id,
      placedTick: 10,
      completedTick: BALANCE.DISTRIBUTOR_INTERVAL - 3,
      observeUntilTick: BALANCE.DISTRIBUTOR_INTERVAL + 100,
      baseline: { outputTotal: 0, houseBread: 14, starvingHomes: 1 },
      latest: { outputTotal: 0, houseBread: 14, starvingHomes: 1 },
      outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false },
    },
  };
  const next = advanceTick(state);
  assert.equal(next.houses.find(house => house.buildingId === 'home7')?.breadStock, 2);
  assert.equal(next.autoplayFoodObservation?.outcome?.deliveredBreadDelta, 2);
  assert.equal(next.autoplayFoodObservation?.outcome?.effective, true);
});

for (const scenario of ['vacant', 'occupied-empty', 'other-provider'] as const) {
  test(`Given ${scenario} delivery When the actual tick services an empty home Then only the observed granary receives useful delivery credit`, () => {
    const base = routedStockTown(true);
    const observedGranary = { ...building('new-granary', 'granary', 4, 2, 2), reserved: { bread: 2 } };
    const oldGranary = { ...building('old-granary', 'granary', 1, 2, 2), reserved: { bread: 2 } };
    const state = {
      ...base,
      tick: BALANCE.DISTRIBUTOR_INTERVAL - 2,
      houses: base.houses.map(house => house.buildingId === 'home7'
        ? { ...house, residents: scenario === 'occupied-empty' ? 8 : 0, breadStock: 0, emptyFoodTicks: 0 }
        : house),
      buildings: [observedGranary, oldGranary, ...base.buildings.filter(candidate => candidate.kind !== 'granary')],
      walkers: [distributor(scenario === 'other-provider' ? oldGranary.id : observedGranary.id)],
      autoplayFoodObservation: {
        kind: 'granary' as const, siteId: observedGranary.id, placedTick: 10,
        completedTick: BALANCE.DISTRIBUTOR_INTERVAL - 3, observeUntilTick: BALANCE.DISTRIBUTOR_INTERVAL + 100,
        baseline: { outputTotal: 0, houseBread: 14, starvingHomes: 0 },
        latest: { outputTotal: 0, houseBread: 14, starvingHomes: 0 },
        outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false },
      },
    };
    const next = advanceTick(state);
    assert.equal(next.houses.find(house => house.buildingId === 'home7')?.breadStock, 1);
    assert.equal(next.autoplayFoodObservation?.outcome?.deliveredBreadDelta, scenario === 'other-provider' ? 0 : 1);
    assert.equal(next.autoplayFoodObservation?.outcome?.effective, scenario !== 'other-provider');
  });
}

for (const target of ['home7', 'home0']) {
  test(`Given observed granary targets ${target} When it feeds empty home7 Then only targeted delivery validates recovery`, () => {
    const base = routedStockTown(true);
    const provider = { ...building('observed', 'granary', 4, 2, 2), reserved: { bread: 2 } };
    const state = { ...base, tick: BALANCE.DISTRIBUTOR_INTERVAL - 2,
      buildings: [provider, ...base.buildings.filter(candidate => candidate.kind !== 'granary')],
      walkers: [distributor(provider.id)],
      autoplayFoodObservation: { kind: 'granary' as const, siteId: provider.id, placedTick: 10,
        targetHouseIds: [target], completedTick: 100, observeUntilTick: 500,
        baseline: { outputTotal: 0, houseBread: 14, starvingHomes: 1 },
        latest: { outputTotal: 0, houseBread: 14, starvingHomes: 1 } },
    };
    const next = advanceTick(state);
    assert.equal(next.houses.find(house => house.buildingId === 'home7')?.breadStock, 2);
    assert.equal(next.autoplayFoodObservation?.outcome?.deliveredBreadDelta, target === 'home7' ? 2 : 0);
    assert.equal(next.autoplayFoodObservation?.outcome?.effective, target === 'home7');
    assert.deepEqual(next.autoplayFoodObservation?.deliveredTargetHouseIds ?? [], target === 'home7' ? ['home7'] : []);
    const bread = (input: GameState) => input.houses.reduce((sum, home) => sum + home.breadStock, 0)
      + input.buildings.reduce((sum, candidate) => sum + (candidate.inventory.bread ?? 0), 0)
      + input.walkers.reduce((sum, walker) => sum + (walker.cargo?.resource === 'bread' ? walker.cargo.amount : 0), 0);
    assert.equal(bread(next), bread(state));
  });
}
