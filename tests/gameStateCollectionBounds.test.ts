import assert from "node:assert/strict";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { HOUSING_CONFIG } from "../src/content/housingConfig";
import {
  constructionSiteFootprint,
  isBuildingConstructionSite,
  isWallConstructionSite,
} from "../src/economy/construction";
import { decideNextAction } from "../src/engine/autoplay";
import { autoplayActionToGameAction } from "../src/engine/autoplayActions";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { AUTOPLAY_TICK_CADENCE, canRunAutoplayAtTick } from "../src/ui/autoplayPresentation";
import { getTile, type TileCoordinate } from "../src/world/grid";

const MAX_COUNTS = {
  buildings: 160,
  constructionSites: 120,
  forestHarvests: 256,
  houses: 80,
  pathCacheEntries: 2_048,
  walkers: 240,
} as const;
const MAX_HOUSE_CAPACITY = Math.max(...HOUSING_CONFIG.map((definition) => definition.capacity));

function coordinateKey(coordinate: TileCoordinate): string {
  return `${coordinate.tx},${coordinate.ty}`;
}

function edgePointInBounds(state: GameState, point: { readonly x: number; readonly y: number }): boolean {
  return Number.isInteger(point.x) && Number.isInteger(point.y) &&
    point.x >= 0 && point.y >= 0 && point.x <= state.width && point.y <= state.height;
}

function inBounds(state: GameState, coordinate: TileCoordinate): boolean {
  return Number.isInteger(coordinate.tx) && Number.isInteger(coordinate.ty) &&
    coordinate.tx >= 0 && coordinate.ty >= 0 && coordinate.tx < state.width && coordinate.ty < state.height;
}

function positionInBounds(state: GameState, coordinate: TileCoordinate): boolean {
  return Number.isFinite(coordinate.tx) && Number.isFinite(coordinate.ty) &&
    coordinate.tx >= 0 && coordinate.ty >= 0 && coordinate.tx < state.width && coordinate.ty < state.height;
}

function runAutoplayTicks(ticks: number): GameState {
  let state = DEFAULT_GAME_STATE;
  let lastActionTick = -AUTOPLAY_TICK_CADENCE;
  for (let step = 0; step < ticks; step += 1) {
    if (canRunAutoplayAtTick({ enabled: true, currentTick: state.tick, lastActionTick })) {
      const gameAction = autoplayActionToGameAction(decideNextAction(state), state);
      if (gameAction !== null) {
        state = gameReducer(state, gameAction);
        lastActionTick = state.tick;
      }
    }
    const nextState = advanceTick(state);
    state = gameReducer(state, {
      type: "commit_simulation_state",
      previousState: state,
      nextState,
    });
    if (state.tick % 600 === 0) validateCollections(state);
  }
  return state;
}

function validateBuildingFootprints(state: GameState): void {
  const buildingIds = new Set<string>();
  for (const building of state.buildings) {
    assert.equal(buildingIds.has(building.id), false, `duplicate building id ${building.id}`);
    buildingIds.add(building.id);
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    for (let dy = 0; dy < definition.height; dy += 1) {
      for (let dx = 0; dx < definition.width; dx += 1) {
        const coordinate = { tx: building.tx + dx, ty: building.ty + dy };
        assert.equal(inBounds(state, coordinate), true, `${building.id} footprint out of bounds`);
        assert.equal(getTile(state, coordinate)?.buildingId, building.id, `${building.id} missing tile owner`);
      }
    }
  }
}

function validateCollections(state: GameState): void {
  assert.equal(state.tiles.length, state.width * state.height);
  assert.equal(state.buildings.length <= MAX_COUNTS.buildings, true);
  assert.equal(state.constructionSites.length <= MAX_COUNTS.constructionSites, true);
  assert.equal(state.houses.length <= MAX_COUNTS.houses, true);
  assert.equal(state.walkers.length <= MAX_COUNTS.walkers, true);
  assert.equal(state.forestHarvests.length <= MAX_COUNTS.forestHarvests, true);
  assert.equal(Object.keys(state.pathCache).length <= MAX_COUNTS.pathCacheEntries, true);
  validateTiles(state);
  validateBuildingFootprints(state);
  validateConstructionSites(state);
  validateHouses(state);
  validateWalkers(state);
  validateForestHarvests(state);
  validatePathCache(state);
  validatePalisade(state);
}

function validateConstructionSites(state: GameState): void {
  const siteIds = new Set<string>();
  for (const site of state.constructionSites) {
    assert.equal(siteIds.has(site.id), false, `duplicate construction site id ${site.id}`);
    siteIds.add(site.id);
    const footprint = constructionSiteFootprint(site);
    assert.equal(inBounds(state, { tx: footprint.tx, ty: footprint.ty }), true, `${site.id} footprint origin`);
    if (isBuildingConstructionSite(site)) {
      assert.equal(getTile(state, { tx: site.tx, ty: site.ty })?.buildingId, site.id, `${site.id} missing anchor owner`);
    }
    if (isWallConstructionSite(site)) {
      assert.equal(site.path.length > 0 && site.path.length <= 4, true, `${site.id} wall path length`);
      assert.equal(site.path.every((point) => edgePointInBounds(state, point)), true, `${site.id} wall path bounds`);
    }
  }
}

function validateForestHarvests(state: GameState): void {
  const harvestKeys = new Set<string>();
  for (const harvest of state.forestHarvests) {
    const coordinate = { tx: harvest.tx, ty: harvest.ty };
    assert.equal(inBounds(state, coordinate), true, `forest harvest out of bounds ${coordinateKey(coordinate)}`);
    assert.equal(harvest.harvestedAtTick <= state.tick, true);
    assert.equal(harvestKeys.has(coordinateKey(coordinate)), false, `duplicate harvest ${coordinateKey(coordinate)}`);
    harvestKeys.add(coordinateKey(coordinate));
  }
}

function validateHouses(state: GameState): void {
  const buildingIds = new Set(state.buildings.map((building) => building.id));
  for (const house of state.houses) {
    assert.equal(buildingIds.has(house.buildingId), true, `${house.buildingId} missing house building`);
    assert.equal(house.residents >= 0 && house.residents <= MAX_HOUSE_CAPACITY, true, `${house.buildingId} residents`);
    assert.equal(house.lastServicedTick <= state.tick, true, `${house.buildingId} serviced from future`);
  }
}

function validatePalisade(state: GameState): void {
  if (state.palisade === null) return;
  assert.equal(state.palisade.polygon.length > 0, true);
  assert.equal(edgePointInBounds(state, state.palisade.gate), true);
  for (const segment of state.palisade.segments) {
    assert.equal(segment.edgePath.length > 0, true, `${segment.id} empty edge path`);
    assert.equal(segment.edgePath.every((point) => edgePointInBounds(state, point)), true, `${segment.id} edge path bounds`);
    assert.equal(segment.tileCount > 0, true, `${segment.id} tile count`);
  }
}

function validatePathCache(state: GameState): void {
  for (const path of Object.values(state.pathCache)) {
    assert.equal(path.length <= state.width * state.height, true, "cached path exceeds world area");
    assert.equal(path.every((coordinate) => inBounds(state, coordinate)), true, "cached path out of bounds");
  }
}

function validateTiles(state: GameState): void {
  const seen = new Set<string>();
  for (const [index, tile] of state.tiles.entries()) {
    assert.equal(tile.tx, index % state.width);
    assert.equal(tile.ty, Math.floor(index / state.width));
    assert.equal(seen.has(coordinateKey(tile)), false, `duplicate tile ${coordinateKey(tile)}`);
    assert.equal(tile.hasRoad && tile.buildingId !== null, false, `road overlaps owner at ${coordinateKey(tile)}`);
    seen.add(coordinateKey(tile));
  }
}

function validateWalkers(state: GameState): void {
  const buildingIds = new Set(state.buildings.map((building) => building.id));
  const siteIds = new Set(state.constructionSites.map((site) => site.id));
  const walkerIds = new Set<string>();
  for (const walker of state.walkers) {
    assert.equal(walkerIds.has(walker.id), false, `duplicate walker id ${walker.id}`);
    walkerIds.add(walker.id);
    validateWalkerPath(state, walker);
    if (walker.kind === "builder") {
      assert.equal(siteIds.has(walker.siteId), true, `${walker.id} missing site`);
      assert.equal(walker.homeBuildingId, walker.siteId, `${walker.id} builder home`);
    } else {
      assert.equal(buildingIds.has(walker.homeBuildingId), true, `${walker.id} missing home`);
    }
    if (walker.kind === "carter" && walker.destination.kind === "building") {
      assert.equal(buildingIds.has(walker.destination.buildingId), true, `${walker.id} missing destination`);
    }
    if (walker.kind === "carter" && walker.destination.kind === "construction_site") {
      assert.equal(siteIds.has(walker.destination.siteId), true, `${walker.id} missing destination site`);
    }
  }
}

function validateWalkerPath(state: GameState, walker: Walker): void {
  assert.equal(positionInBounds(state, walker.position), true, `${walker.id} position`);
  if (walker.kind === "builder") {
    assert.equal(walker.path.length, 0, `${walker.id} builder path`);
    assert.equal(walker.pathIndex, 0, `${walker.id} builder path index`);
  } else {
    assert.equal(walker.path.length > 0, true, `${walker.id} empty path`);
    assert.equal(walker.pathIndex >= 0 && walker.pathIndex < walker.path.length, true, `${walker.id} path index`);
  }
  assert.equal(walker.path.every((coordinate) => inBounds(state, coordinate)), true, `${walker.id} path bounds`);
  if (walker.previousTile !== null) assert.equal(inBounds(state, walker.previousTile), true, `${walker.id} previous tile`);
  if (walker.cargo !== null) assert.equal(walker.cargo.amount > 0, true, `${walker.id} cargo`);
}

test("Given canonical autoplay When twelve thousand ticks run Then GameState collections remain bounded and internally referenced", () => {
  // Given / When
  const state = runAutoplayTicks(12_000);

  // Then
  validateCollections(state);
  assert.equal(state.tick, 12_000);
  assert.equal(state.population >= DEFAULT_GAME_STATE.population, true);
});
