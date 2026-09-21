import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from '../src/content/buildingConfig';
import type { House } from '../src/population/population.types';
import type { Tile } from '../src/world/world.types';
import type { GameState } from '../src/engine/engine.types';
import assert from 'node:assert/strict';
import test from 'node:test';
import { AdvisorDiagnosticError, createAutoplayTraceDriver, type AdvisorDiagnosticReceipt } from '../scripts/economyHarnessAutoplay';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';

for (const treasuryTimber of [500, 120]) test(`Given treasury ${treasuryTimber} When diagnostics collect Then full state and actions stay equal`, () => {
  const state = { ...structuredClone(DEFAULT_GAME_STATE), tick: 120, treasuryTimber };
  const plain = createAutoplayTraceDriver();
  const receipts: AdvisorDiagnosticReceipt[] = [];
  const noop = createAutoplayTraceDriver({ id: 'test', source: 'synthetic', onDiagnostic: () => {} });
  const collecting = createAutoplayTraceDriver({ id: 'test', source: 'synthetic', onDiagnostic: r => receipts.push(r) });
  const expected = plain.apply(structuredClone(state));
  assert.deepEqual(noop.apply(structuredClone(state)), expected);
  assert.deepEqual(collecting.apply(structuredClone(state)), expected);
  assert.deepEqual(collecting.appliedActions, plain.appliedActions);
  assert.equal(receipts.length, 1);
  assert.equal(collecting.apply(expected), expected);
  assert.equal(receipts.length, 1);
});

test('Given observer throws When action already applied Then error preserves result and driver never retries', () => {
  const state = { ...structuredClone(DEFAULT_GAME_STATE), tick: 120, treasuryTimber: 120 };
  const plain = createAutoplayTraceDriver();
  const expected = plain.apply(structuredClone(state));
  let calls = 0;
  const driver = createAutoplayTraceDriver({ id: 'throw', source: 'synthetic', onDiagnostic: () => { calls++; throw new Error('sink unavailable'); } });
  try { driver.apply(structuredClone(state)); assert.fail('observer must throw'); }
  catch (error) {
    assert.ok(error instanceof AdvisorDiagnosticError);
    assert.deepEqual(error.appliedState, expected);
    assert.equal(error.status, 'partial'); assert.equal(error.evidence, 'FAIL');
    assert.deepEqual(driver.appliedActions, plain.appliedActions);
    assert.equal(driver.apply(error.appliedState), error.appliedState);
  }
  assert.equal(calls, 1);
});

test('Given receipt mutation When callback writes nested data Then applied state and action trace stay detached', () => {
  const state = { ...structuredClone(DEFAULT_GAME_STATE), tick: 120, treasuryTimber: 120 };
  const plain = createAutoplayTraceDriver();
  const expected = plain.apply(structuredClone(state));
  const driver = createAutoplayTraceDriver({ id: 'mutate', source: 'synthetic', onDiagnostic: r => {
    Reflect.set(r.advisorAction, 'kind', 'none'); Reflect.set(r.food, 'tick', -1);
    Reflect.set(r.newSiteIds, '0', 'bad');
  } });
  assert.deepEqual(driver.apply(structuredClone(state)), expected);
  assert.deepEqual(driver.appliedActions, plain.appliedActions);
});

function building(id: string, kind: BuildingKind, tx: number, ty: number): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: BUILDING_CONFIG_BY_KIND[kind].workersRequired,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function house(buildingId: string): House {
  return {
    buildingId,
    level: 3,
    residents: 20,
    hasWater: true,
    breadStock: 50,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

function tiles(buildings: readonly Building[]): Tile[] {
  return Array.from({ length: 8 * 8 }, (_unused, index): Tile => {
    const tx = index % 8;
    const ty = Math.floor(index / 8);
    const owner = buildings.find((candidate) => {
      const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
      return tx >= candidate.tx &&
        tx < candidate.tx + definition.width &&
        ty >= candidate.ty &&
        ty < candidate.ty + definition.height;
    });
    return {
      tx,
      ty,
      terrain: "grass",
      buildingId: owner?.id ?? null,
      hasRoad: true,
    };
  });
}

function readyEdgeMapState(): GameState {
  const buildings = [
    building("house-a", "house", 0, 0),
    building("house-b", "house", 0, 1),
    building("house-c", "house", 0, 2),
    building("granary-a", "granary", 0, 3),
    building("chapel-a", "chapel", 0, 5),
  ];
  const homes = buildings.filter((candidate) => candidate.kind === "house").map((candidate) => house(candidate.id));
  return {
    tick: 0,
    seed: 1,
    width: 8,
    height: 8,
    tiles: tiles(buildings),
    buildings: [...buildings],
    constructionSites: [],
    houses: homes,
    walkers: [],
    population: 60,
    idleWorkers: 0,
    treasuryTimber: 250,
    treasuryCoin: 0,
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    forestHarvests: [],
    nextConstructionOrdinal: 1,
    roadRevision: 1,
    pathCache: {},
  };
}

for (const gate of [true, false]) test(`Given proclamation gate ${gate} When observer throws Then original gate or null result already committed`, () => {
  const state = readyEdgeMapState();let calls = 0;
  const driver = createAutoplayTraceDriver({ id: 'gate', source: 'synthetic', ...(gate ? { proclamationGateTick: 1000 } : {}), onDiagnostic: r => {
    assert.equal(r.result, gate ? 'gated' : 'no_action');calls++;throw new Error('write failed');
  } });
  assert.throws(() => driver.apply(state), error => {
    assert.ok(error instanceof AdvisorDiagnosticError);assert.equal(error.appliedState, state);return true;
  });
  assert.equal(driver.appliedActions.length, 0);assert.equal(driver.apply(state), state);assert.equal(calls, 1);
});
test('Given an early timber choice When recording Then food is explicitly not reached', () => {
  const state = { ...structuredClone(DEFAULT_GAME_STATE), tick: 120, treasuryTimber: 120 };
  const receipts: AdvisorDiagnosticReceipt[] = [];
  createAutoplayTraceDriver({ id: 'early', source: 'synthetic', onDiagnostic: r => receipts.push(r) }).apply(state);
  assert.equal(receipts[0]?.food.reason, 'not_reached');assert.equal(receipts[0]?.food.reached, false);
  assert.equal(receipts[0]?.newSiteIds.length, 1);
});

test('Given natural harness callback When one normal tick runs Then existing state callbacks and actions remain equal', async () => {
  const { runPhase19NaturalGrowth } = await import('../scripts/phase19NaturalGrowth');
  const plainStates: readonly [string, GameState][] = [];
  const enabledStates: readonly [string, GameState][] = [];
  const plain: [string, GameState][] = [...plainStates], enabled: [string, GameState][] = [...enabledStates];
  const receipts: AdvisorDiagnosticReceipt[] = [];
  const a = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 1, seed: 1, onState: (label, state) => plain.push([label, structuredClone(state)]) });
  const b = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 1, seed: 1, onState: (label, state) => enabled.push([label, structuredClone(state)]), onDiagnostic: r => receipts.push(r) });
  assert.deepEqual(enabled, plain);assert.deepEqual(b.actions, a.actions);assert.equal(receipts.length, 1);
});
