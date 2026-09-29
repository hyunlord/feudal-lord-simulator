import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { canPlaceBuildingBeforeRoad } from "../src/world/placement";
import { findExistingRoadPath } from "../src/world/roadGraph";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { getTile, type Grid, type TileCoordinate } from "../src/world/grid";
import { buildArchetypeWorld } from "../src/world/archetypeTerrain";
import { buildWorldGrid } from "../src/world/terrain";
import { RIVERSIDE_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { archetypeById } from "../src/content/scenario/registry";

export class InvalidGrowthOpeningError extends Error {
  readonly code = "invalid-opening-fixture";
  constructor(readonly seed: number, readonly issues: readonly string[]) {
    super(`Invalid opening fixture for seed ${seed}: ${issues.join("; ")}. No simulation ran; no legal translated verification opening exists.`);
    this.name = "InvalidGrowthOpeningError";
  }
}

/** Validate the granted opening's geography, not its already-granted construction cost. */
function openingIssues(state: GameState): readonly string[] {
  const issues: string[] = [];
  for (const building of state.buildings) {
    const cleared = { ...state, buildings: state.buildings.filter(item => item.id !== building.id),
      tiles: state.tiles.map(tile => tile.buildingId === building.id ? { ...tile, buildingId: null } : tile) };
    const placement = canPlaceBuildingBeforeRoad(cleared, building.kind, building.tx, building.ty);
    if (!placement.ok && placement.reason !== "insufficient_materials") issues.push(`${building.id}: ${placement.reason}`);
  }
  for (const tile of state.tiles) {
    if (tile.hasRoad && (tile.terrain === "water" || tile.buildingId !== null)) {
      issues.push(`road(${tile.tx},${tile.ty}): ${tile.terrain === "water" ? "water" : "occupied"}`);
    }
  }
  const granary = state.buildings.find(building => building.kind === "granary");
  const starts = granary === undefined ? [] : buildingRoadAccessTiles(state, granary);
  for (const building of state.buildings.filter(item => BUILDING_CONFIG_BY_KIND[item.kind].requiresRoad)) {
    const ends = buildingRoadAccessTiles(state, building);
    if (!starts.some(start => ends.some(destination => findExistingRoadPath(state, { start, destination }) !== null))) {
      issues.push(`${building.id}: disconnected-from-opening-granary`);
    }
  }
  return issues;
}

const roads = DEFAULT_GAME_STATE.tiles.filter(tile => tile.hasRoad);
const footprint = DEFAULT_GAME_STATE.buildings.flatMap(building => {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  return Array.from({ length: definition.width * definition.height }, (_, index) => ({
    tx: building.tx + index % definition.width, ty: building.ty + Math.floor(index / definition.width), id: building.id,
  }));
});

const occupied = [...roads, ...footprint];
const minX = Math.min(...occupied.map(tile => tile.tx));
const minY = Math.min(...occupied.map(tile => tile.ty));
const maxX = Math.max(...occupied.map(tile => tile.tx));
const maxY = Math.max(...occupied.map(tile => tile.ty));

function terrainAllowsOpening(world: Grid, offset: TileCoordinate): boolean {
  if (occupied.some(tile => getTile(world, { tx: tile.tx + offset.tx, ty: tile.ty + offset.ty })?.terrain === "water")) return false;
  return DEFAULT_GAME_STATE.buildings.every(building => {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    if (definition.requiresAdjacentTerrain === null) return true;
    for (let dy = -1; dy <= definition.height; dy++) for (let dx = -1; dx <= definition.width; dx++) {
      if (dx >= 0 && dy >= 0 && dx < definition.width && dy < definition.height) continue;
      if (getTile(world, { tx: building.tx + offset.tx + dx, ty: building.ty + offset.ty + dy })?.terrain === definition.requiresAdjacentTerrain) return true;
    }
    return false;
  });
}

function stampOpening(world: Grid, seed: number, offset: TileCoordinate): GameState {
  const state = structuredClone(DEFAULT_GAME_STATE);
  const ids = new Map(footprint.map(tile => [`${tile.tx + offset.tx},${tile.ty + offset.ty}`, tile.id]));
  const roadKeys = new Set(roads.map(tile => `${tile.tx + offset.tx},${tile.ty + offset.ty}`));
  return { ...state, seed, width: world.width, height: world.height,
    buildings: state.buildings.map(building => ({ ...building, tx: building.tx + offset.tx, ty: building.ty + offset.ty })),
    tiles: world.tiles.map(tile => ({ ...tile, buildingId: ids.get(`${tile.tx},${tile.ty}`) ?? null, hasRoad: roadKeys.has(`${tile.tx},${tile.ty}`) })),
  };
}

/** Pure verification fixture selection on an unmodified raw world; never installed in the product initializer. */
export function selectGrowthOpening(world: Grid, seed: number) {
  const offsets: TileCoordinate[] = [];
  for (let ty = -minY; ty < world.height - maxY; ty++) {
    for (let tx = -minX; tx < world.width - maxX; tx++) offsets.push({ tx, ty });
  }
  offsets.sort((a, b) => Math.abs(a.tx) + Math.abs(a.ty) - Math.abs(b.tx) - Math.abs(b.ty) || a.ty - b.ty || a.tx - b.tx);
  for (const offset of offsets) {
    if (!terrainAllowsOpening(world, offset)) continue;
    const state = stampOpening(world, seed, offset);
    if (openingIssues(state).length > 0) continue;
    return { state, provenance: { mode: "translated-verification-fixture", offset,
      selection: "minimum Manhattan offset, then dy, then dx; zero when legal", productSeedFeature: false } as const };
  }
  throw new InvalidGrowthOpeningError(seed, ["no-legal-offset: all in-bounds rigid opening translations rejected"]);
}

/**
 * ARCH-1 (MA-7): on a land other than the riverside town the map is that land's, and the state carries its id.
 * ARCH-1b (MA-9): every land's map carries its river (the riverside town's too: the open field with its river).
 */
export function createGrowthOpening(seed: number, archetypeId?: string) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 5) throw new RangeError("verification seed must be 1..5");
  const size = { width: DEFAULT_GAME_STATE.width, height: DEFAULT_GAME_STATE.height, seed };
  const archetype = archetypeById(archetypeId ?? RIVERSIDE_ARCHETYPE_ID);
  if (archetype === undefined) throw new RangeError(`unknown archetype ${archetypeId}`);
  // The riverside town's opening is chosen on the open field's map first; the river then keeps off that site (carving
  // only adds water, so the same translation stays the nearest legal one).
  const offset = archetype.terrain.kind === "river" ? selectGrowthOpening(buildWorldGrid(size), seed).provenance.offset : { tx: 0, ty: 0 };
  const land = buildArchetypeWorld(archetype, size, offset);
  const world = { width: size.width, height: size.height, tiles: land.terrains.map((terrain, index) => ({
    tx: index % size.width, ty: Math.floor(index / size.width), terrain, buildingId: null, hasRoad: false })) };
  const opening = selectGrowthOpening(world, seed);
  const { river: _river, ...state } = opening.state;
  return { ...opening, state: { ...state, ...(archetype.terrain.kind === "river" ? {} : { archetypeId: archetype.id }),
    ...(land.river === null ? {} : { river: land.river }) } };
}
