import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../src/content/houseFoodConfig";
import type { GameState } from "../src/engine/engine.types";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { FOOD_RESERVE_STABLE_TICKS, foodReserveTicks } from "../src/population/foodReserve";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { settlementGuidance } from "../src/ui/settlementGuidanceModel";
import { SETTLEMENT_GUIDANCE_COPY } from "../src/ui/settlementGuidanceCopy.ko";
import { canPlaceBuilding, canPlaceBuildingBeforeRoad, PlacementFailure } from "../src/world/placement";
import type { TileCoordinate } from "../src/world/grid";

// FIX-1 (spec docs/design/placement-status-truth.md PT-1…PT-3): what the screen says is what the rules do.

const candidate = (kind: Building["kind"], tile: TileCoordinate): Building => ({ id: "fix1-candidate", kind, tx: tile.tx, ty: tile.ty,
  workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 });

/** The first opening-village cell where a storehouse is legal apart from roads, with or without a road beside it. */
function storehouseSite(state: GameState, withRoad: boolean): TileCoordinate {
  const site = state.tiles.find(tile => canPlaceBuildingBeforeRoad(state, "storehouse", tile.tx, tile.ty).ok
    && (buildingRoadAccessTiles(state, candidate("storehouse", tile)).length > 0) === withRoad);
  assert.ok(site !== undefined, `a storehouse site ${withRoad ? "beside" : "away from"} a road`);
  return { tx: site.tx, ty: site.ty };
}

test("PT-1 a building that needs a road is refused where no road reaches it and placed where one does", () => {
  const state = DEFAULT_GAME_STATE;
  const away = storehouseSite(state, false);
  const beside = storehouseSite(state, true);
  assert.deepEqual(canPlaceBuilding(state, "storehouse", away.tx, away.ty), { ok: false, reason: PlacementFailure.needs_road });
  assert.deepEqual(canPlaceBuilding(state, "storehouse", beside.tx, beside.ty), { ok: true });
  const refused = gameReducer(state, { type: "place_building", kind: "storehouse", ...away });
  assert.equal(refused, state, "the reducer refuses it: no construction site, no timber committed");
  const placed = gameReducer(state, { type: "place_building", kind: "storehouse", ...beside });
  assert.equal(placed.constructionSites.length, state.constructionSites.length + 1);
});

test("PT-1 a well (no road needed) still goes anywhere legal, and the other placement rules come first", () => {
  const state = DEFAULT_GAME_STATE;
  assert.equal(BUILDING_CONFIG_BY_KIND.well.requiresRoad, false);
  const lonely = state.tiles.find(tile => canPlaceBuildingBeforeRoad(state, "well", tile.tx, tile.ty).ok
    && buildingRoadAccessTiles(state, candidate("well", tile)).length === 0);
  assert.ok(lonely !== undefined);
  assert.deepEqual(canPlaceBuilding(state, "well", lonely.tx, lonely.ty), { ok: true });
  const occupied = state.buildings.find(building => building.kind === "house");
  assert.ok(occupied !== undefined);
  assert.deepEqual(canPlaceBuilding(state, "storehouse", occupied.tx, occupied.ty), { ok: false, reason: PlacementFailure.occupied },
    "an occupied site reports the occupied reason, not the road");
});

test("PT-2 a new game's first frame already has its village well serving the houses", () => {
  assert.ok(DEFAULT_GAME_STATE.houses.length > 0);
  assert.ok(DEFAULT_GAME_STATE.houses.every(house => house.hasWater), "every opening house is watered at tick 0");
  const fresh = gameReducer(DEFAULT_GAME_STATE, { type: "start_new_game", scenarioId: DEFAULT_SCENARIO_ID });
  assert.ok(fresh.houses.every(house => house.hasWater));
  assert.notEqual(settlementGuidance(fresh).statusLine, "우물이 필요합니다", "no false well warning while paused");
  assert.equal(fresh.tick, 0);
});

/** The opening village with every store's bread and wheat replaced by `bread` loaves in one storehouse. */
function withStoredBread(bread: number): GameState {
  const state = DEFAULT_GAME_STATE;
  const store = state.buildings.find(building => building.kind === "storehouse" || building.kind === "granary");
  assert.ok(store !== undefined);
  return { ...state, walkers: [], buildings: state.buildings.map(building => {
    const { bread: _bread, wheat: _wheat, ...rest } = building.inventory;
    return { ...building, inventory: building.id === store.id ? { ...rest, bread } : rest };
  }) };
}

test("PT-3 a town with 30 game seconds of stored bread is not stable: food reserve short", () => {
  const ration = DEFAULT_GAME_STATE.houses.reduce((sum, house) => sum + (house.residents > 0 ? houseFoodRation(house) : 0), 0);
  const thirtySeconds = Math.floor(30 * 20 * ration / HOUSE_FOOD_INTERVAL);
  const short = withStoredBread(thirtySeconds);
  assert.ok((foodReserveTicks(short) ?? 0) <= 600);
  assert.equal(settlementGuidance(short).statusLine, SETTLEMENT_GUIDANCE_COPY.foodReserveShort);
  const season = withStoredBread(Math.ceil(FOOD_RESERVE_STABLE_TICKS * ration / HOUSE_FOOD_INTERVAL));
  assert.ok((foodReserveTicks(season) ?? 0) >= FOOD_RESERVE_STABLE_TICKS);
  assert.equal(settlementGuidance(season).statusLine, "정착지는 안정적입니다");
});

test("PT-3 wheat counts as the bread a mill makes of it", () => {
  const empty = withStoredBread(0);
  const store = empty.buildings.find(building => building.kind === "storehouse" || building.kind === "granary")!;
  const wheat = { ...empty, buildings: empty.buildings.map(building => building.id === store.id ? { ...building, inventory: { ...building.inventory, wheat: 40 } } : building) };
  assert.equal(foodReserveTicks(wheat), foodReserveTicks(withStoredBread(20)));
});
