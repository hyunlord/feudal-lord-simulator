import assert from 'node:assert/strict';
import test from 'node:test';
import { createConstructionSite } from '../src/economy/construction';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { foodAction } from '../src/engine/autoplayFood';
import { hasActiveFoodObservation } from '../src/engine/autoplayFoodThroughput';
import { completeEligibleConstruction } from '../src/engine/constructionLifecycle';
import { advanceTick } from '../src/engine/tick';
import { gameReducer } from '../src/state/gameStore';
import { BALANCE } from '../src/content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND } from '../src/content/buildingConfig';
import { foodBuildRequest, routedStockTown } from './helpers/autoplayFoodFixtures';

test('Given an active food observation When a house is hungry Then advisor waits for production and hauling evidence', () => {
  const state = { ...routedStockTown(true), autoplayFoodObservation: {
    kind: 'mill' as const, siteId: 'mill', placedTick: 5000, completedTick: 5600, observeUntilTick: 7000,
  } };
  assert.deepEqual(foodAction(state, foodBuildRequest), { kind: 'none' });
});

test('Given manual or rejected food placement When the reducer handles it Then observation is not recorded', () => {
  const state = { ...routedStockTown(true), treasuryTimber: 1000 };
  const manual = gameReducer(state, { type: 'place_building', kind: 'mill', tx: 12, ty: 2 });
  assert.equal(manual.autoplayFoodObservation, undefined);
  const rejected = gameReducer(
    { ...state, treasuryTimber: 0 },
    { type: 'place_building', kind: 'mill', tx: 12, ty: 2, autoplayFoodObservation: true },
  );
  assert.equal(rejected.autoplayFoodObservation, undefined);
});

test('Given observed food construction is cancelled before completion When reducer handles it Then observation is cleared', () => {
  const site = createConstructionSite({ ordinal: 1, kind: 'mill', tx: 12, ty: 2, startedTick: 0 });
  const state = {
    ...routedStockTown(true),
    constructionSites: [site],
    autoplayFoodObservation: { kind: 'mill' as const, siteId: site.id, placedTick: 5000 },
  };
  const next = gameReducer(state, { type: 'cancel_construction', siteId: site.id });
  assert.equal(next.autoplayFoodObservation, undefined);
  assert.equal(next.constructionSites.some(candidate => candidate.id === site.id), false);
});

test('Given autoplay places a food building When the reducer accepts it Then food observation records the site', () => {
  const state = { ...routedStockTown(true), treasuryTimber: 1000 };
  const action = autoplayActionToGameAction({ kind: 'place_building', building: 'mill', tx: 12, ty: 2 });
  assert.ok(action);
  const next = gameReducer(state, action);
  assert.equal(next.autoplayFoodObservation?.kind, 'mill');
  assert.equal(next.autoplayFoodObservation?.siteId, 'construction-site-000001');
  assert.equal(next.autoplayFoodObservation?.placedTick, state.tick);
});

test('Given an observed food site completes When completion runs Then production and hauling observation gets a deadline', () => {
  const site = {
    ...createConstructionSite({ ordinal: 1, kind: 'mill', tx: 12, ty: 2, startedTick: 0 }),
    delivered: { timber: 30 },
    builderTicks: 600,
  };
  const state = {
    ...routedStockTown(true),
    wallTick: 1000,
    constructionSites: [site],
    autoplayFoodObservation: { kind: 'mill' as const, siteId: site.id, placedTick: 5000 },
  };
  const next = completeEligibleConstruction(state);
  assert.equal(next.autoplayFoodObservation?.completedTick, state.tick);
  assert.equal(hasActiveFoodObservation(next), true);
  assert.ok((next.autoplayFoodObservation?.observeUntilTick ?? 0) > state.tick);
});

test('Given an observed food site already completed When another site completes Then the observation window is not reset', () => {
  const otherSite = {
    ...createConstructionSite({ ordinal: 2, kind: 'well', tx: 15, ty: 2, startedTick: 0 }),
    delivered: { timber: 10 },
    builderTicks: 600,
  };
  const state = {
    ...routedStockTown(true),
    tick: 7000,
    wallTick: 1000,
    constructionSites: [otherSite],
    autoplayFoodObservation: {
      kind: 'mill' as const, siteId: 'mill', placedTick: 5000, completedTick: 5600, observeUntilTick: 6900,
      baseline: { outputTotal: 10, houseBread: 14, starvingHomes: 1 },
      latest: { outputTotal: 10, houseBread: 14, starvingHomes: 1 },
      outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false },
    },
  };
  const next = completeEligibleConstruction(state);
  assert.equal(next.autoplayFoodObservation?.completedTick, 5600);
  assert.equal(next.autoplayFoodObservation?.observeUntilTick, 6900);
});

test('Given observation window has ended When observed mill later produces Then outcome remains frozen', () => {
  const millProduction = BUILDING_CONFIG_BY_KIND.mill.production;
  assert.ok(millProduction);
  const base = routedStockTown(true);
  const state = {
    ...base,
    tick: 8000,
    buildings: base.buildings.map((candidate) => candidate.id === 'mill'
      ? { ...candidate, inventory: { wheat: millProduction.inputPerOutput }, productionProgress: millProduction.ticksPerOutput - 1 }
      : candidate),
    autoplayFoodObservation: {
      kind: 'mill' as const, siteId: 'mill', placedTick: 10, completedTick: 100, observeUntilTick: 7000,
      baseline: { outputTotal: 0, houseBread: 14, starvingHomes: 1 },
      latest: { outputTotal: 0, houseBread: 14, starvingHomes: 1 },
      outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false },
    },
  };
  const next = advanceTick(state);
  assert.deepEqual(next.autoplayFoodObservation?.latest, state.autoplayFoodObservation.latest);
  assert.deepEqual(next.autoplayFoodObservation?.outcome, state.autoplayFoodObservation.outcome);
});

test('Given a different mill produces during observation When the tick loop runs Then observed output is not credited', () => {
  const millProduction = BUILDING_CONFIG_BY_KIND.mill.production;
  assert.ok(millProduction);
  const base = routedStockTown(true);
  const state = {
    ...base,
    tick: BALANCE.DISTRIBUTOR_INTERVAL - 2,
    buildings: base.buildings.map((candidate) => candidate.id === 'mill'
      ? { ...candidate, inventory: { wheat: millProduction.inputPerOutput }, productionProgress: millProduction.ticksPerOutput - 1 }
      : candidate),
    autoplayFoodObservation: {
      kind: 'mill' as const, siteId: 'new-mill', placedTick: 10,
      completedTick: BALANCE.DISTRIBUTOR_INTERVAL - 3, observeUntilTick: BALANCE.DISTRIBUTOR_INTERVAL + 100,
      baseline: { outputTotal: 0, houseBread: 14, starvingHomes: 1 }, latest: { outputTotal: 0, houseBread: 14, starvingHomes: 1 },
    },
  };
  const next = advanceTick(state);
  assert.equal(next.autoplayFoodObservation?.outcome?.outputDelta, 0);
  assert.equal(next.autoplayFoodObservation?.outcome?.effective, false);
});

test('Given an observed mill produces during the tick loop When observation updates Then actual output delta is recorded', () => {
  const millProduction = BUILDING_CONFIG_BY_KIND.mill.production;
  assert.ok(millProduction);
  const state = {
    ...routedStockTown(true),
    tick: BALANCE.DISTRIBUTOR_INTERVAL - 2,
    buildings: routedStockTown(true).buildings.map((candidate) => candidate.id === 'mill'
      ? { ...candidate, inventory: { wheat: millProduction.inputPerOutput }, productionProgress: millProduction.ticksPerOutput - 1 }
      : candidate),
    autoplayFoodObservation: {
      kind: 'mill' as const, siteId: 'mill', placedTick: 10,
      completedTick: BALANCE.DISTRIBUTOR_INTERVAL - 3, observeUntilTick: BALANCE.DISTRIBUTOR_INTERVAL + 100,
      baseline: { outputTotal: 0, houseBread: 14, starvingHomes: 1 }, latest: { outputTotal: 0, houseBread: 14, starvingHomes: 1 },
    },
  };
  const next = advanceTick(state);
  assert.ok(next.autoplayFoodObservation?.latest);
  assert.equal(next.autoplayFoodObservation.latest.outputTotal, 1);
  assert.equal(next.autoplayFoodObservation?.outcome?.outputDelta, 1);
  assert.equal(next.autoplayFoodObservation?.outcome?.effective, true);
});

test('Given expired facility observation without a full actual flow window Then advisor waits for measured capacity', () => {
  const state = { ...routedStockTown(true), tick: 7200, autoplayFoodObservation: {
    kind: 'mill' as const, siteId: 'mill', placedTick: 5000, completedTick: 5600, observeUntilTick: 7000,
  } };
  const action = foodAction(state, foodBuildRequest);
  assert.equal(action.kind, 'none');
});

test('Given an expired ineffective mill observation When starvation remains Then advisor does not repeat the same mill expansion', () => {
  const state = { ...routedStockTown(true), tick: 7200, autoplayFoodObservation: {
    kind: 'mill' as const, siteId: 'mill', placedTick: 5000, completedTick: 5600, observeUntilTick: 7000,
    baseline: { outputTotal: 30, houseBread: 14, starvingHomes: 1 },
    latest: { outputTotal: 30, houseBread: 14, starvingHomes: 1 },
    outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false },
  } };
  const action = foodAction(state, foodBuildRequest);
  assert.notDeepEqual(action, { kind: 'place_building', building: 'mill', tx: 0, ty: 0 });
});
