import assert from "node:assert/strict";
import test from "node:test";
import { demolishHouse } from "../src/engine/houseDemolition";
import { advanceTick } from "../src/engine/tick";
import { availableWorkers, builderWalkersForSites } from "../src/population/labour";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { STARTING_HOUSE_ID } from "../src/state/openingVillage";
import { createConstructionSite } from "../src/economy/construction";

test("demolition removes an occupied house without refund and releases its footprint", () => {
  const before = DEFAULT_GAME_STATE;
  const household = before.houses.find((house) => house.buildingId === STARTING_HOUSE_ID);
  assert.ok(household);
  const after = demolishHouse(before, STARTING_HOUSE_ID);
  assert.equal(after.population, before.population - household.residents);
  assert.ok(after.houses.every((house) => house.buildingId !== STARTING_HOUSE_ID));
  assert.ok(after.buildings.every((building) => building.id !== STARTING_HOUSE_ID));
  assert.ok(after.tiles.every((tile) => tile.buildingId !== STARTING_HOUSE_ID));
  assert.equal(after.treasuryTimber, before.treasuryTimber);
  assert.equal(after.treasuryCoin, before.treasuryCoin);
  assert.equal(before.houses.length, 4);
  assert.equal(after.roadRevision, before.roadRevision);
  assert.deepEqual(after.tiles.map((tile) => tile.hasRoad), before.tiles.map((tile) => tile.hasRoad));
});

test("demolition immediately reallocates scarce workers and construction walkers and survives the next tick", () => {
  const site = { ...createConstructionSite({ ordinal: 99, kind: "well", tx: 52, ty: 42, startedTick: 0 }), assignedBuilders: 3 };
  const before = { ...DEFAULT_GAME_STATE, constructionSites: [site], walkers: [...builderWalkersForSites([site])] };
  const after = demolishHouse(before, STARTING_HOUSE_ID);
  const assigned = after.buildings.reduce((total, building) => total + building.workers, 0)
    + after.constructionSites.reduce((total, candidate) => total + candidate.assignedBuilders, 0);
  assert.equal(assigned + after.idleWorkers, availableWorkers(after.population));
  assert.equal(after.walkers.filter((walker) => walker.kind === "builder").length, after.constructionSites.reduce((total, candidate) => total + candidate.assignedBuilders, 0));
  const next = advanceTick(after);
  assert.ok(next.houses.every((house) => house.buildingId !== STARTING_HOUSE_ID));
  assert.equal(next.population, next.houses.reduce((total, house) => total + house.residents, 0));
  assert.ok(next.idleWorkers >= 0);
});

test("missing, non-house and repeated demolition are identity no-ops", () => {
  assert.equal(demolishHouse(DEFAULT_GAME_STATE, "missing"), DEFAULT_GAME_STATE);
  assert.equal(demolishHouse(DEFAULT_GAME_STATE, "granary-42-37-0"), DEFAULT_GAME_STATE);
  const after = demolishHouse(DEFAULT_GAME_STATE, STARTING_HOUSE_ID);
  assert.equal(demolishHouse(after, STARTING_HOUSE_ID), after);
});

test("the store dispatches completed-house demolition", () => {
  const after = gameReducer(DEFAULT_GAME_STATE, { type: "demolish_house", buildingId: STARTING_HOUSE_ID });
  assert.equal(after.houses.length, DEFAULT_GAME_STATE.houses.length - 1);
});

test("demolition preserves live deliveries and their reservations", () => {
  let before = DEFAULT_GAME_STATE;
  for (let tick = 0; tick < 60; tick += 1) before = advanceTick(before);
  const active = before.walkers.filter((walker) => walker.kind !== "builder");
  assert.ok(active.length > 0);
  const after = demolishHouse(before, STARTING_HOUSE_ID);
  assert.deepEqual(after.walkers.filter((walker) => walker.kind !== "builder"), active);
  for (const building of after.buildings) {
    const previous = before.buildings.find((candidate) => candidate.id === building.id);
    assert.deepEqual(building.reserved, previous?.reserved);
    assert.deepEqual(building.inventory, previous?.inventory);
    assert.deepEqual(building.stockReserved, previous?.stockReserved);
  }
  assert.doesNotThrow(() => advanceTick(after));
});

test("removing the final household leaves zero population and allocated labour", () => {
  const after = DEFAULT_GAME_STATE.houses.reduce(
    (state, house) => demolishHouse(state, house.buildingId), DEFAULT_GAME_STATE,
  );
  assert.equal(after.population, 0);
  assert.equal(after.idleWorkers, 0);
  assert.ok(after.buildings.every((building) => building.workers === 0));
  assert.equal(advanceTick(after).population, 0);
});
