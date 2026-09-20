import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { TerrainType } from "../src/content/terrainConfig";
import type { GameState } from "../src/engine/engine.types";
import { canPlaceBuilding } from "../src/world/placement";
import { canPlaceRoad, getOrthogonalRoadNeighbors } from "../src/world/roadGraph";
import type { TileCoordinate } from "../src/world/grid";
import { getTile } from "../src/world/grid";
import { guaranteeEssentialResourceTerrain } from "../src/world/essentialResources";
import { buildWorldGrid, cleanupTerrainRegions, generateTerrainTile } from "../src/world/terrain";
import { createGrowthInitialState } from "../scripts/phase19GrowthRunControl";
import { InvalidGrowthOpeningError, selectGrowthOpening } from "../scripts/phase21OpeningTranslation";

const QUARRY_DEFINITION = BUILDING_CONFIG_BY_KIND.quarry;

const ORTHOGONAL_OFFSETS = [
  { tx: 0, ty: -1 },
  { tx: 1, ty: 0 },
  { tx: 0, ty: 1 },
  { tx: -1, ty: 0 },
] as const;

function rawCleanedTerrains(width: number, height: number, seed: number): readonly TerrainType[] {
  const terrains: TerrainType[] = [];
  for (let ty = 0; ty < height; ty += 1) {
    for (let tx = 0; tx < width; tx += 1) {
      terrains.push(generateTerrainTile(tx + 5, ty + 2, seed));
    }
  }
  return cleanupTerrainRegions(terrains, width, height);
}

function quarryOrigins(state: GameState): readonly TileCoordinate[] {
  const quarryWorld = { ...state, era: "palisade" as const, treasuryTimber: 999 };
  const origins: TileCoordinate[] = [];
  for (let ty = 0; ty < state.height; ty += 1) {
    for (let tx = 0; tx < state.width; tx += 1) {
      if (canPlaceBuilding(quarryWorld, "quarry", tx, ty).ok) origins.push({ tx, ty });
    }
  }
  return origins;
}

function quarryFootprint(origin: TileCoordinate): ReadonlySet<string> {
  const tiles = new Set<string>();
  for (let dy = 0; dy < QUARRY_DEFINITION.height; dy += 1) {
    for (let dx = 0; dx < QUARRY_DEFINITION.width; dx += 1) tiles.add(`${origin.tx + dx},${origin.ty + dy}`);
  }
  return tiles;
}

function quarryAccessTiles(state: GameState, origin: TileCoordinate): readonly TileCoordinate[] {
  const candidates: TileCoordinate[] = [];
  for (let dx = 0; dx < QUARRY_DEFINITION.width; dx += 1) {
    candidates.push({ tx: origin.tx + dx, ty: origin.ty - 1 });
    candidates.push({ tx: origin.tx + dx, ty: origin.ty + QUARRY_DEFINITION.height });
  }
  for (let dy = 0; dy < QUARRY_DEFINITION.height; dy += 1) {
    candidates.push({ tx: origin.tx - 1, ty: origin.ty + dy });
    candidates.push({ tx: origin.tx + QUARRY_DEFINITION.width, ty: origin.ty + dy });
  }
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.tx},${candidate.ty}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const tile = getTile(state, candidate);
    return tile !== null && tile.terrain !== "water" && tile.buildingId === null;
  });
}

function hasRoadPlanToQuarry(state: GameState, origin: TileCoordinate): boolean {
  const targets = new Set(quarryAccessTiles(state, origin).map((tile) => `${tile.tx},${tile.ty}`));
  const blocked = quarryFootprint(origin);
  const frontier = state.tiles.filter((tile) => tile.hasRoad).map(({ tx, ty }) => ({ tx, ty }));
  const visited = new Set(frontier.map((tile) => `${tile.tx},${tile.ty}`));
  for (let queueIndex = 0; queueIndex < frontier.length; queueIndex += 1) {
    const current = frontier[queueIndex];
    if (current === undefined) continue;
    if (targets.has(`${current.tx},${current.ty}`)) return true;
    for (const next of getOrthogonalRoadNeighbors({ ...state, palisade: null }, current)) {
      const key = `${next.tx},${next.ty}`;
      if (!visited.has(key)) {
        visited.add(key);
        frontier.push(next);
      }
    }
    for (const offset of ORTHOGONAL_OFFSETS) {
      const next = { tx: current.tx + offset.tx, ty: current.ty + offset.ty };
      const key = `${next.tx},${next.ty}`;
      if (visited.has(key) || blocked.has(key)) continue;
      const tile = getTile(state, next);
      if (tile === null || tile.terrain === "water" || tile.buildingId !== null) continue;
      if (!tile.hasRoad && !canPlaceRoad({ ...state, palisade: null }, next)) continue;
      visited.add(key);
      frontier.push(next);
    }
  }
  return false;
}

test("new verification worlds expose at least one legal quarry site across the stage-0 seed set", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const state = createGrowthInitialState(seed);
    const origins = quarryOrigins(state);
    assert.ok(origins.length > 0, `seed ${seed} should expose a legal quarry origin`);
    assert.ok(
      origins.some((origin) => hasRoadPlanToQuarry(state, origin)),
      `seed ${seed} should have a quarry origin reachable by legal road planning`,
    );
  }
});

test("broader generated openings have geological quarry access before building occupancy", () => {
  let supportedOpenings = 0;
  const unsupportedOpenings: number[] = [];

  for (let seed = 1; seed <= 512; seed += 1) {
    const grid = buildWorldGrid({ width: 64, height: 64, seed });
    let state: GameState;
    try {
      const opening = selectGrowthOpening(grid, seed).state;
      state = {
        ...opening,
        buildings: [],
        tiles: opening.tiles.map((tile) => ({ ...tile, buildingId: null })),
      };
    } catch (error) {
      if (error instanceof InvalidGrowthOpeningError) {
        assert.ok(error.issues.some((issue) => issue.startsWith("no-legal-offset:")));
        unsupportedOpenings.push(seed);
        continue;
      }
      throw error;
    }

    supportedOpenings += 1;
    const origins = quarryOrigins(state);
    assert.ok(origins.length > 0, `seed ${seed} should expose a legal quarry origin`);
    assert.ok(
      origins.some((origin) => hasRoadPlanToQuarry(state, origin)),
      `seed ${seed} should have geological quarry access before opening buildings occupy land`,
    );
  }
  assert.ok(supportedOpenings > 0);
  assert.ok(unsupportedOpenings.every((seed, index) => seed >= 1 && seed <= 512 && seed > (unsupportedOpenings[index - 1] ?? 0)));
});

test("seed 465 opening granary blocks quarry access despite a valid geological resource", () => {
  const grid = buildWorldGrid({ width: 64, height: 64, seed: 465 });
  const state = selectGrowthOpening(grid, 465).state;
  const granary = state.buildings.find((building) => building.kind === "granary");
  assert.ok(granary);
  const cleared: GameState = {
    ...state,
    buildings: state.buildings.filter((building) => building.id !== granary.id),
    tiles: state.tiles.map((tile) => tile.buildingId === granary.id ? { ...tile, buildingId: null } : tile),
  };

  assert.ok(quarryOrigins(state).length > 0);
  assert.equal(quarryOrigins(state).some((origin) => hasRoadPlanToQuarry(state, origin)), false);
  assert.ok(quarryOrigins(cleared).some((origin) => hasRoadPlanToQuarry(cleared, origin)));
});

test("seed 99 forest-dominated opening has a reachable quarry without moving its buildings", () => {
  const grid = buildWorldGrid({ width: 64, height: 64, seed: 99 });
  const state = selectGrowthOpening(grid, 99).state;

  assert.ok(quarryOrigins(state).some((origin) => hasRoadPlanToQuarry(state, origin)));
});

test("seed 2 essential resource guarantee adds quarryable rock without moving water or opening stocks", () => {
  const before = rawCleanedTerrains(64, 64, 2);
  const state = createGrowthInitialState(2);
  const after = state.tiles.map((tile) => tile.terrain);

  assert.equal(before.filter((terrain) => terrain === "rock").length, 0);
  assert.ok(after.filter((terrain) => terrain === "rock").length >= 4);
  for (const [index, terrain] of before.entries()) {
    if (terrain === "water") assert.equal(after[index], "water", `water tile ${index} moved`);
  }
  assert.equal(state.treasuryTimber, 120);
  assert.equal(state.treasuryCoin, 0);
  assert.deepEqual(state.walkers, []);
});

test("resource guarantee leaves already quarryable seed 1 terrain byte-identical to raw cleanup", () => {
  const expected = rawCleanedTerrains(64, 64, 1);
  const actual = buildWorldGrid({ width: 64, height: 64, seed: 1 }).tiles.map((tile) => tile.terrain);

  assert.deepEqual(actual, expected);
});

test("resource guarantee reports no-fit maps without mutating terrain or claiming success", () => {
  const width = 3;
  const height = 3;
  const terrains = Array<TerrainType>(width * height).fill("grass");
  const before = [...terrains];

  const result = guaranteeEssentialResourceTerrain(terrains, width, height, 2);

  assert.deepEqual(result, {
    ok: false,
    reason: "no_quarry_resource_site",
    terrains: before,
  });
  assert.deepEqual(terrains, before);
});

test("resource guarantee supplies quarry terrain on forest-only land when no grass patch fits", () => {
  const width = 8;
  const height = 8;
  const terrains = Array<TerrainType>(width * height).fill("forest");

  const result = guaranteeEssentialResourceTerrain(terrains, width, height, 99);

  assert.equal(result.ok, true);
  assert.ok(result.terrains.some((terrain) => terrain === "rock"));
  assert.ok(result.terrains.some((terrain) => terrain === "forest"));
  assert.ok(terrains.every((terrain) => terrain === "forest"));
});
