import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';

import type { GameState } from '../src/engine/engine.types';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { gameReducer } from '../src/state/gameStore';
import { feasibleDistributorDistance } from '../src/engine/distributorAccess';

const target = 'construction-site-000062';
function derivedReplay(): GameState {
  return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/distribution-roads/seed5-qualified.json.gz', import.meta.url))).toString());
}

test('Given engine-replayed recurring starvation and seven granaries When the advisor repairs delivery Then three legal roads open a closer stocked granary exit', async () => {
  let state = derivedReplay();
  assert.ok(state.autoplayRecurringDelivery?.homes.find(home => home.buildingId === target)?.qualified);
  assert.equal(state.buildings.filter(building => building.kind === 'granary').length, 7);
  const source = state.buildings.find(building => building.id === 'construction-site-000039');
  assert.ok(source);
  const initial = feasibleDistributorDistance(state, source, target);
  assert.equal(initial, 78);
  // MARKET-1: in this old-rule town the advisor first relocates homes out of the markets' road reach (AR-5 under MK-2),
  // so the delivery repair is asked of its own recovery.
  const { distributionRoadRecoveryAction } = await import('../src/engine/autoplayDistributionRoads');
  for (let index = 0; index < 3; index++) {
    const action = distributionRoadRecoveryAction(state);
    assert.equal(action.kind, 'place_road');
    const command = autoplayActionToGameAction(action, state);
    assert.ok(command);
    const next = gameReducer(state, command);
    assert.notEqual(next, state);
    state = next;
  }
  assert.equal(feasibleDistributorDistance(state, source, target), 19);
  assert.equal(state.buildings.filter(building => building.kind === 'granary').length, 7);
});

test('Given no measured recurring deficit When a town has long delivery routes Then the advisor does not spend roads on speculation', async () => {
  const { distributionRoadRecoveryAction } = await import('../src/engine/autoplayDistributionRoads');
  const state = derivedReplay();
  const observation = state.autoplayRecurringDelivery;
  assert.ok(observation);
  const healthy = { ...state, autoplayRecurringDelivery: { ...observation, homes: observation.homes.map(entry => ({
    buildingId: entry.buildingId, identity: entry.identity, window: entry.window, qualified: false,
  })) } };
  assert.deepEqual(distributionRoadRecoveryAction(healthy), { kind: 'none' });
});

test('Given completed granaries are paused, understaffed or empty When the home remains deficient Then none is treated as an immediate bread source', async () => {
  const { distributionRoadRecoveryAction } = await import('../src/engine/autoplayDistributionRoads');
  const state = derivedReplay();
  for (const change of [
    { operationPaused: true }, { workers: 0 }, { inventory: {} },
  ]) {
    const blocked = { ...state, buildings: state.buildings.map(building => building.kind === 'granary' ? { ...building, ...change } : building) };
    assert.deepEqual(distributionRoadRecoveryAction(blocked), { kind: 'none' });
  }
});

test('Given the proven corridor already exists When the same shortage record is refreshed Then no equally long or worse road plan is returned', async () => {
  const { distributionRoadRecoveryAction } = await import('../src/engine/autoplayDistributionRoads');
  const { recurringDeliveryRoutes } = await import('../src/engine/autoplayRecurringDeliveryRoutes');
  const { placeRoadLine } = await import('../src/engine/gameActions');
  let state = derivedReplay();
  state = placeRoadLine(state, { tx: 38, ty: 9 }, { tx: 37, ty: 9 });
  state = placeRoadLine(state, { tx: 37, ty: 8 }, { tx: 37, ty: 3 });
  state = placeRoadLine(state, { tx: 36, ty: 3 }, { tx: 28, ty: 3 });
  const observation = state.autoplayRecurringDelivery;
  assert.ok(observation);
  const routes = recurringDeliveryRoutes(state);
  state = { ...state, autoplayRecurringDelivery: { ...observation, routes,
    homes: observation.homes.map(entry => ({ ...entry, identity: routes.homes.find(route => route.buildingId === entry.buildingId)?.identity ?? entry.identity })) } };
  assert.deepEqual(distributionRoadRecoveryAction(state), { kind: 'none' });
});

test('Given a sealed wall or pending building blocks the new granary exit When road recovery plans Then it never constructs through either obstacle', async () => {
  const { distributionRoadRecoveryAction } = await import('../src/engine/autoplayDistributionRoads');
  const { createConstructionSite } = await import('../src/economy/construction');
  const { recurringDeliveryRoutes } = await import('../src/engine/autoplayRecurringDeliveryRoutes');
  const state = derivedReplay();
  const wall = state.palisade;
  const segment = wall?.segments[0];
  assert.ok(wall && segment);
  const onlySource = state.buildings.map(building => building.kind === 'granary' && building.id !== 'construction-site-000039'
    ? { ...building, inventory: {} } : building);
  const variants = [
    { ...state, buildings: onlySource, palisade: { ...wall, gate: { x: -10, y: -10 }, additionalGates: [],
      segments: [{ ...segment, completed: true, edgePath: [{ x: 0, y: 3 }, { x: state.width, y: 3 }] }] }, roadRevision: state.roadRevision + 1 },
    { ...state, buildings: onlySource, constructionSites: [...state.constructionSites,
      ...Array.from({ length: 5 }, (_, index) => createConstructionSite({ ordinal: 900 + index, kind: 'storehouse', tx: 26 + index * 2, ty: 3, startedTick: state.tick }))] },
  ];
  for (let candidate of variants) {
    const observation = candidate.autoplayRecurringDelivery;
    assert.ok(observation);
    const routes = recurringDeliveryRoutes(candidate);
    candidate = { ...candidate, autoplayRecurringDelivery: { ...observation, routes,
      homes: observation.homes.map(entry => ({ ...entry, identity: routes.homes.find(route => route.buildingId === entry.buildingId)?.identity ?? entry.identity })) } };
    const action = distributionRoadRecoveryAction(candidate);
    assert.equal(action.kind, 'none');
  }
});


test('Given no remaining search budget When a deficient home could gain a new exit Then recovery returns no partial proof and marks the limit', async () => {
  const { distributionRoadRecoveryAction } = await import('../src/engine/autoplayDistributionRoads');
  const { runAutoplaySearch } = await import('../src/engine/autoplaySearchBudget');
  const { resetAutoplayServiceSearch } = await import('../src/engine/autoplayServiceSpace');
  const diagnostic: import('../src/engine/autoplaySearchBudget').SearchDiagnosticCollector = {};
  resetAutoplayServiceSearch();
  assert.deepEqual(runAutoplaySearch(() => distributionRoadRecoveryAction(derivedReplay()), diagnostic, 0), { kind: 'none' });
  assert.equal(diagnostic.search?.reason, 'search_budget_hit');
});
