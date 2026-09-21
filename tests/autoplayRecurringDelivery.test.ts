import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';
import type { GameState } from '../src/engine/engine.types';
import { recordRecurringDelivery, recurringDeliveryHomes } from '../src/engine/autoplayRecurringDelivery';

function town(): GameState {
  const buildings: Building[] = ([
    { id: 'g', kind: 'granary', tx: 1, ty: 1 },
    { id: 'f', kind: 'wheat_farm', tx: 4, ty: 1 },
    { id: 'm', kind: 'mill', tx: 7, ty: 2 },
    { id: 'h', kind: 'house', tx: 20, ty: 2 },
    { id: 'well', kind: 'well', tx: 18, ty: 2 },
  ] as const).map(b => ({ ...b, workers: BUILDING_CONFIG_BY_KIND[b.kind].workersRequired,
    inventory: { bread: 100 }, reserved: {}, stockReserved: {}, productionProgress: 0 }));
  return { ...structuredClone(DEFAULT_GAME_STATE), tick: 6000, width: 32, height: 8,
    buildings, constructionSites: [], walkers: [], palisade: null, era: 'hamlet', population: 22,
    houses: [{ buildingId: 'h', level: 3, residents: 22, hasWater: true, breadStock: 0,
      emptyFoodTicks: 500, lastServicedTick: 0, unmetRequirementTicks: 0 }],
    tiles: Array.from({ length: 256 }, (_, n) => ({ tx: n % 32, ty: Math.floor(n / 32), terrain: 'grass',
      hasRoad: Math.floor(n / 32) === 3, buildingId: buildings.find(b => n % 32 >= b.tx && n % 32 < b.tx + BUILDING_CONFIG_BY_KIND[b.kind].width
        && Math.floor(n / 32) >= b.ty && Math.floor(n / 32) < b.ty + BUILDING_CONFIG_BY_KIND[b.kind].height)?.id ?? null })), pathCache: {} };
}
function observe(s: GameState, bread: number, starving = true): GameState {
  const servedHouses = s.houses.map(h => ({ ...h, breadStock: bread }));
  return recordRecurringDelivery({ ...s, houses: s.houses.map(h => ({ ...h, breadStock: 0, emptyFoodTicks: starving ? 500 : 0 })) },
    { servedHouses, deliveryEvents: [] });
}
function window(s: GameState, bread: number, starving = true): GameState {
  for (let n = 0; n < 1600; n++) s = observe({ ...s, tick: s.tick + 1 }, bread, starving);
  return s;
}
test('Derived seed4: recurring missed rations and starvation mature despite intervening small deliveries', () => {
  let s = town();
  for (let n = 0; n < 1600; n++) {
    s = observe({ ...s, tick: s.tick + 1 }, n % 600 === 0 ? 3 : 0);
  }
  assert.deepEqual(recurringDeliveryHomes(s).map(h => h.buildingId), ['h']);
});
test('Healthy periodic empty stock with all meals consumed is not a delivery deficit', () => {
  assert.deepEqual(recurringDeliveryHomes(window(town(), 3, false)), []);
});
test('An actual stock outage during missed meals cannot be mistaken for distribution deficit', () => {
  let s = town();
  for (let n = 0; n < 1600; n++) {
    s = { ...s, tick: s.tick + 1, buildings: s.buildings.map(b => b.id === 'g' ? { ...b, inventory: { bread: s.tick % 400 === 399 ? 0 : 100 } } : b) };
    s = observe(s, 0);
  }
  assert.deepEqual(recurringDeliveryHomes(s), []);
});
test('Token delivery and route changes do not reopen an attempted deficient episode', () => {
  let s = window(town(), 0);
  s = { ...s, autoplayFoodObservation: { kind: 'granary', siteId: 'attempt', placedTick: s.tick, targetHouseIds: ['h'] } };
  s = observe({ ...s, tick: s.tick + 1 }, 1);
  s = window({ ...s, roadRevision: s.roadRevision + 1 }, 0);
  assert.deepEqual(recurringDeliveryHomes(s), []);
});
test('Full healthy comparable opportunity clears an episode and permits a later real deficit', () => {
  let s = window(town(), 0);
  s = { ...s, autoplayFoodObservation: { kind: 'granary', siteId: 'attempt', placedTick: s.tick, targetHouseIds: ['h'] } };
  s = observe({ ...s, tick: s.tick + 1 }, 0);
  s = window(window(s, 3, false), 3, false);
  s = window(window(s, 0), 0);
  assert.deepEqual(recurringDeliveryHomes(s).map(h => h.buildingId), ['h']);
});

test('A route generation change must requalify measurement without clearing the attempted episode', () => {
  let s = window(town(), 0);
  s = { ...s, buildings: s.buildings.map(b => b.id === 'h' ? { ...b, tx: 21 } : b), roadRevision: s.roadRevision + 1 };
  s = observe({ ...s, tick: s.tick + 1 }, 0);
  assert.deepEqual(recurringDeliveryHomes(s), []);
});
test('Deleting a home and rewinding a save discard old deficits', () => {
  const s = window(town(), 0);
  assert.deepEqual(recurringDeliveryHomes(observe({ ...s, tick: 5000 }, 0)), []);
  assert.deepEqual(recurringDeliveryHomes(recordRecurringDelivery({ ...s, tick: s.tick + 1, houses: [] }, { servedHouses: [], deliveryEvents: [] })), []);
});

test('Existing food-priority allocation can staff recovery despite zero global idle without taking food staff', async () => {
  const { canStaffRecurringGranary } = await import('../src/engine/autoplayRecurringDeliveryStaffing');
  const s = town();
  const candidate: Building = { id: 'new', kind: 'granary', tx: 24, ty: 1, workers: 0,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  assert.equal(canStaffRecurringGranary({ ...s, idleWorkers: 0 }, candidate), true);
  assert.equal(canStaffRecurringGranary({ ...s, population: 18, idleWorkers: 0 }, candidate), false);
});
test('Pending food commitments consume future staffing headroom', async () => {
  const { canStaffRecurringGranary } = await import('../src/engine/autoplayRecurringDeliveryStaffing');
  const { createConstructionSite } = await import('../src/economy/construction');
  const s = town();
  const candidate: Building = { id: 'new', kind: 'granary', tx: 24, ty: 1, workers: 0,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  s.constructionSites = [createConstructionSite({ ordinal: 99, kind: 'mill', tx: 10, ty: 2, startedTick: s.tick })];
  assert.equal(canStaffRecurringGranary(s, candidate), false);
});
test('Normal tick records actual delivered meal and consumption once', async () => {
  const { advanceTick } = await import('../src/engine/tick');
  let s = town();
  s.tick = 6399;
  s.houses = s.houses.map(h => ({ ...h, breadStock: 3, emptyFoodTicks: 0 }));
  s = advanceTick(s);
  const w = s.autoplayRecurringDelivery?.homes.find(h => h.buildingId === 'h')?.window;
  assert.equal(w?.requested, 3);
  assert.equal(w?.consumed, 3);
  assert.equal(w?.actionableMissed, 0);
});

test('Actual same-tick distributor delivery is consumed and credited exactly once', async () => {
  const { advanceTick } = await import('../src/engine/tick');
  let s = town();
  s.tick = 6399;
  s.houses = s.houses.map(h => ({ ...h, residents: 8, breadStock: 0, emptyFoodTicks: 0 }));
  s.walkers = [{ id: 'delivery', kind: 'distributor', phase: 'roaming', homeBuildingId: 'g',
    position: { tx: 20, ty: 3 }, path: [{ tx: 20, ty: 3 }], pathIndex: 0, previousTile: null,
    cargo: { resource: 'bread', amount: 1 }, spawnedTick: 6399, junctionVisits: 0, tilesTravelled: 0, priorTile: null }];
  s = advanceTick(s);
  const w = s.autoplayRecurringDelivery?.homes.find(h => h.buildingId === 'h')?.window;
  assert.equal(w?.delivered, 1);
  assert.equal(w?.requested, 1);
  assert.equal(w?.consumed, 1);
  assert.equal(s.houses[0]?.breadStock, 0);
  assert.deepEqual(recordRecurringDelivery(s, { servedHouses: s.houses, deliveryEvents: [] }), s);
});
test('Exact finite deadline closes the measurement, not one tick early', () => {
  let s = observe({ ...town(), tick: 6001 }, 0);
  const deadline = s.autoplayRecurringDelivery?.homes[0]?.window.untilTick;
  assert.ok(deadline);
  while (s.tick < deadline - 1) s = observe({ ...s, tick: s.tick + 1 }, 0);
  assert.deepEqual(recurringDeliveryHomes(s), []);
  s = observe({ ...s, tick: deadline }, 0);
  assert.deepEqual(recurringDeliveryHomes(s).map(h => h.buildingId), ['h']);
});
for (const scenario of ['empty-new', 'grace', 'missing-chain', 'understaffed-provider'] as const) {
  test(`${scenario} does not create a recurring recovery target`, () => {
    let s = town();
    if (scenario === 'empty-new') s.houses = s.houses.map(h => ({ ...h, residents: 0 }));
    if (scenario === 'grace') s.houses = s.houses.map(h => ({ ...h, starvationGraceUntilTick: 10000 }));
    if (scenario === 'missing-chain') s.buildings = s.buildings.filter(b => b.kind !== 'mill');
    if (scenario === 'understaffed-provider') s.buildings = s.buildings.map(b => b.id === 'g' ? { ...b, workers: 0 } : b);
    assert.deepEqual(recurringDeliveryHomes(window(s, 0)), []);
  });
}
test('Unrelated road revision keeps comparable observation; provider readiness restoration requalifies', () => {
  let s = window(town(), 0);
  s = observe({ ...s, tick: s.tick + 1, roadRevision: s.roadRevision + 1 }, 0);
  assert.equal(recurringDeliveryHomes(s).length, 1);
  s = observe({ ...s, tick: s.tick + 1, buildings: s.buildings.map(b => b.id === 'g' ? { ...b, workers: 0 } : b) }, 0);
  s = observe({ ...s, tick: s.tick + 1, buildings: s.buildings.map(b => b.id === 'g' ? { ...b, workers: 2 } : b) }, 0);
  assert.deepEqual(recurringDeliveryHomes(s), []);
});

test('A cancelled or replaced action cannot erase a deficient attempt latch', () => {
  let s = window(town(), 0);
  s = { ...s, autoplayFoodObservation: { kind: 'granary', siteId: 'cancelled', placedTick: s.tick, targetHouseIds: ['h'] } };
  s = observe({ ...s, tick: s.tick + 1 }, 0);
  s = { ...s, autoplayFoodObservation: { kind: 'mill', siteId: 'other', placedTick: s.tick } };
  s = window(s, 0);
  assert.equal(s.autoplayRecurringDelivery?.homes[0]?.attemptedSiteId, 'cancelled');
  assert.deepEqual(recurringDeliveryHomes(s), []);
});
test('House expansion requalifies its changing ration while keeping an existing failed attempt', () => {
  let s = window(town(), 0);
  s = { ...s, autoplayFoodObservation: { kind: 'granary', siteId: 'attempt', placedTick: s.tick, targetHouseIds: ['h'] } };
  s = observe({ ...s, tick: s.tick + 1 }, 0);
  s = { ...s, buildings: s.buildings.map(b => b.id === 'h' ? { ...b, houseLot: 'horizontal' } : b) };
  s = observe({ ...s, tick: s.tick + 1 }, 0);
  assert.equal(s.autoplayRecurringDelivery?.homes[0]?.attemptedSiteId, 'attempt');
  assert.equal(s.autoplayRecurringDelivery?.homes[0]?.qualified, false);
});

test('Recurring selection and granary observation attribute the same actual reachable home at zero idle', async () => {
  const { foodCoverageAction, granaryCoverageTargetIds } = await import('../src/engine/autoplayFoodCoverage');
  const s = { ...window(town(), 0), idleWorkers: 0, treasuryTimber: 1000 };
  const action = foodCoverageAction(s);
  assert.equal(action.kind, 'place_building');
  if (action.kind !== 'place_building') return;
  assert.equal(action.building, 'granary');
  assert.deepEqual(granaryCoverageTargetIds(s, action), ['h']);
});

test('An unrelated outside-range home does not change recurring target selection or attribution', async () => {
  const { foodCoverageAction, granaryCoverageTargetIds } = await import('../src/engine/autoplayFoodCoverage');
  const s = { ...window(town(), 0), idleWorkers: 0, treasuryTimber: 1000, width: 64, population: 23 };
  s.buildings.push({ id: 'outside', kind: 'house', tx: 61, ty: 2, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 });
  s.houses.push({ buildingId: 'outside', level: 0, residents: 1, hasWater: false, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 });
  s.tiles = Array.from({ length: 512 }, (_, n) => ({ tx: n % 64, ty: Math.floor(n / 64), terrain: 'grass', hasRoad: Math.floor(n / 64) === 3,
    buildingId: s.buildings.find(b => n % 64 >= b.tx && n % 64 < b.tx + BUILDING_CONFIG_BY_KIND[b.kind].width
      && Math.floor(n / 64) >= b.ty && Math.floor(n / 64) < b.ty + BUILDING_CONFIG_BY_KIND[b.kind].height)?.id ?? null }));
  s.roadRevision += 1;
  const action = foodCoverageAction(s);
  assert.equal(action.kind, 'place_building');
  if (action.kind !== 'place_building') return;
  assert.deepEqual(granaryCoverageTargetIds(s, action), ['h']);
});
