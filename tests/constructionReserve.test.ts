import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";

import { spawnCarters } from "../src/agents/delivery";
import type { CarterWalker } from "../src/agents/walker.types";
import { constructionStall, createPalisadeConstructionSite, createStoneWallConstructionSite } from "../src/economy/construction";
import { constructionReservedMaterial, reserveFloorsForReachableStocks, snapshotWallConstructionReserve, wallDeliveryAvailable, wallReserveHeld } from "../src/engine/constructionReserve";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { constructionShortfalls, placementSpendableResource } from "../src/world/placement";
import { DELIVERY_INVENTORY, building, line, routePort } from "./deliveryFixtures";

const wall = createPalisadeConstructionSite({
  id: "wall-1",
  wallId: "wall",
  segmentIndex: 0,
  gateDistance: 0,
  order: 0,
  path: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
  startedTick: 0,
});

const reserve = {
  resource: "timber" as const,
  proclaimedTick: 0,
  sources: [{ id: "store", floor: 25 }],
};

test("Given a proclaimed wall and timber stock When checking ordinary placement Then future wall need does not consume spendable stock", () => {
  // Given
  const source = building("store", "storehouse", { inventory: { timber: 100 } });
  // When
  const spendable = placementSpendableResource({
    tiles: [], width: 0, height: 0, treasuryTimber: 0,
    buildings: [source], constructionSites: [wall],
  }, "timber");
  // Then
  assert.equal(spendable, 100);
  assert.deepEqual(constructionShortfalls({
    tiles: [], width: 0, height: 0, treasuryTimber: 0,
    buildings: [source], constructionSites: [wall],
  }, { timber: 40 }), {});
});

test("Given four one-unit reachable sources When reserving at proclamation Then the integer floor totals exactly 25%", () => {
  // Given
  const stocks = ["a", "b", "c", "d"].map((id) => ({ id, amount: 1 }));
  // When
  const floors = reserveFloorsForReachableStocks(stocks);
  // Then
  assert.deepEqual(floors, [{ id: "d", floor: 1 }]);
});

test("Given opening roads reaching a wall site When proclaiming with 100 treasury timber Then the fixed reserve is 25 timber", () => {
  // Given
  const state = { ...DEFAULT_GAME_STATE, treasuryTimber: 100 };
  const reachableWall = createPalisadeConstructionSite({
    id: "reachable-wall", wallId: "opening", segmentIndex: 0, gateDistance: 0, order: 0,
    path: [{ x: 43, y: 41 }, { x: 44, y: 41 }], startedTick: 0,
  });
  // When
  const snapshot = snapshotWallConstructionReserve(state, [reachableWall], "timber");
  // Then
  assert.equal(snapshot.sources.find((source) => source.id === "treasury")?.floor, 25);
  assert.equal(snapshot.proclaimedTick, 0);
});

test("Given balanced policy and a proclaimed 25-timber floor When dispatching to a wall Then the floor remains for normal building", () => {
  // Given
  const source = building("store", "storehouse", { inventory: { timber: 30 } });
  const routes = routePort({ "store->wall-1": line([0, 0], [1, 0]) });
  // When
  const result = spawnCarters({
    tick: 1, buildings: [source], constructionSites: [wall], walkers: [], treasuryTimber: 0,
    inventory: DELIVERY_INVENTORY, routes,
    wallConstructionReserve: reserve, wallConstructionPriority: "balanced",
  });
  // Then
  assert.equal((result.walkers[0] as CarterWalker).cargo?.amount, 5);
  assert.equal(result.buildings[0]?.inventory.timber, 25);
});

test("Given priority policy When dispatching the same wall Then the proclamation floor is released", () => {
  // Given
  const source = building("store", "storehouse", { inventory: { timber: 30 } });
  const routes = routePort({ "store->wall-1": line([0, 0], [1, 0]) });
  // When
  const result = spawnCarters({
    tick: 1, buildings: [source], constructionSites: [wall], walkers: [], treasuryTimber: 0,
    inventory: DELIVERY_INVENTORY, routes,
    wallConstructionReserve: reserve, wallConstructionPriority: "priority",
  });
  // Then
  assert.equal((result.walkers[0] as CarterWalker).cargo?.amount, 8);
});

test("Given balanced reserve from a proclaimed source When source stock falls below floor Then wall stock is held", () => {
  // Given
  const floor = 25;
  // When
  const available = wallDeliveryAvailable(reserve, "balanced", "store", "timber", 20);
  // Then
  assert.equal(available, 0);
  assert.equal(floor, reserve.sources[0]?.floor);
});

test("Given a wall reachable only through protected timber When diagnosing material delivery Then the stall identifies reserve hold", () => {
  // Given
  const source = building("store", "storehouse", { inventory: { timber: 25 } });
  const routes = routePort({ "store->wall-1": line([0, 0], [1, 0]) });
  // When
  const held = wallReserveHeld({ buildings: [source], treasuryTimber: 0,
    wallConstructionReserve: reserve, wallConstructionPriority: "balanced" }, wall, routes);
  const stall = constructionStall(wall, [{ id: "store", stock: { timber: 25 }, hasRoute: true }], held);
  // Then
  assert.equal(stall, "reserve_held");
});

test("Given balanced wall policy When switching to construction priority Then the same state exposes priority without mutating reserve floor", () => {
  // Given
  const state = { ...DEFAULT_GAME_STATE, wallConstructionReserve: reserve };
  // When
  const prioritized = gameReducer(state, { type: "set_wall_construction_priority", priority: "priority" });
  // Then
  assert.equal(prioritized.wallConstructionPriority, "priority");
  assert.deepEqual(prioritized.wallConstructionReserve, reserve);
  assert.equal(state.wallConstructionPriority, undefined);
});

test("Given separate timber and stone wall sites When counting material in transit Then only actual site reservations count", () => {
  // Given
  const stone = createStoneWallConstructionSite({
    id: "stone-wall-1", wallId: "wall", segmentIndex: 0, gateDistance: 0, order: 0,
    path: [{ x: 1, y: 1 }, { x: 2, y: 1 }], startedTick: 0,
  });
  const state = {
    constructionSites: [{ ...wall, reserved: { timber: 5 } }, { ...stone, reserved: { stone: 7 } }],
  };
  // When
  const timberReserved = constructionReservedMaterial(state, "timber");
  const stoneReserved = constructionReservedMaterial(state, "stone");
  // Then
  assert.equal(timberReserved, 5);
  assert.equal(stoneReserved, 7);
});

test('reserve diagnosis skips routes when no positive floor applies to the wall material', () => {
  const source = building('store', 'storehouse', { inventory: { timber: 25 } });
  let calls = 0;
  const routes = { ...routePort({}), fromBuildingToDestination: () => { calls++; return line([0, 0], [1, 0]); } };
  for (const snapshot of [undefined, { ...reserve, sources: [] }, { ...reserve, sources: [{ id: 'store', floor: 0 }] }, { ...reserve, resource: 'stone' as const }]) {
    assert.equal(wallReserveHeld({ buildings: [source], treasuryTimber: 0, ...(snapshot === undefined ? {} : { wallConstructionReserve: snapshot }) }, wall, routes), false);
  }
  assert.equal(calls, 0, 'no material can be held without a matching positive floor');
});

test('reserve diagnosis checks routes only for positive stock and preserves unreachable-source handling', () => {
  const empty = building('empty', 'storehouse', { inventory: {} });
  const source = building('store', 'storehouse', { inventory: { timber: 25 } });
  for (const reachable of [false, true]) {
    const checked: string[] = [];
    const routes = { ...routePort({}), fromBuildingToDestination: (id: string) => {
      checked.push(id); return reachable ? line([0, 0], [1, 0]) : null;
    } };
    assert.equal(wallReserveHeld({ buildings: [empty, source], treasuryTimber: 0, wallConstructionReserve: reserve }, wall, routes), reachable);
    assert.deepEqual(checked, ['store']);
  }
});

test('reserve diagnosis still checks house access for positive protected treasury stock', () => {
  const home = building('home', 'house');
  for (const reachable of [false, true]) {
    const checked: string[] = [];
    const routes = { ...routePort({}), fromBuildingToDestination: (id: string) => {
      checked.push(id); return reachable ? line([0, 0], [1, 0]) : null;
    } };
    assert.equal(wallReserveHeld({ buildings: [home], treasuryTimber: 20,
      wallConstructionReserve: { ...reserve, sources: [{ id: 'treasury', floor: 25 }] } }, wall, routes), reachable);
    assert.deepEqual(checked, ['home']);
  }
});


test('natural seed 2 with an empty reserve does not search 56 building routes for each wall segment', () => {
  const state: GameState = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/construction-reserve/seed2-113040.json.gz', import.meta.url))).toString());
  assert.equal(state.buildings.length, 56);
  assert.deepEqual(state.wallConstructionReserve?.sources, []);
  const routes = { ...routePort({}), fromBuildingToDestination: () => assert.fail('no reserve floor can hold positive material') };
  for (const site of state.constructionSites) assert.equal(wallReserveHeld(state, site, routes), false);
});
