/**
 * LM-E5 (spec docs/design/living-growth.md LG-1): a land's opening for any seed — its map from (land, seed) and the
 * opening village moved to the nearest legal place on it (the riverside town's river keeps off that site). The riverside
 * town's seed 1 is today's map, offset zero (the same tiles as `DEFAULT_GAME_STATE`). Moved here from the guardrail's
 * fixture (scripts/phase21OpeningTranslation.ts, which keeps its seeds 1..5) so a new game can start on any seed.
 */
import { placeManorSite } from "./openingVillage";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import { canPlaceBuildingBeforeRoad } from "../world/placement";
import { findExistingRoadPath } from "../world/roadGraph";
import { DEFAULT_GAME_STATE } from "./gameStore";
import { getTile, type Grid, type TileCoordinate } from "../world/grid";
import { buildArchetypeWorld } from "../world/archetypeTerrain";
import { buildWorldGrid } from "../world/terrain";
import { RIVERSIDE_ARCHETYPE_ID } from "../content/scenario/archetypes";
import { archetypeById } from "../content/scenario/registry";

export class InvalidGrowthOpeningError extends Error {
  readonly code = "invalid-opening-fixture";
  constructor(readonly seed: number, readonly issues: readonly string[]) {
    super(`Invalid opening for seed ${seed}: ${issues.join("; ")}. No legal translated opening exists on this map.`);
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

/** The opening village's roads, building cells and bounds (read lazily: this module and the store import each other). */
let shape: { readonly roads: readonly TileCoordinate[]; readonly footprint: readonly (TileCoordinate & { readonly id: string })[];
  readonly occupied: readonly TileCoordinate[]; readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number } | undefined;
function openingShape() {
  if (shape !== undefined) return shape;
  const roads = DEFAULT_GAME_STATE.tiles.filter(tile => tile.hasRoad);
  const footprint = DEFAULT_GAME_STATE.buildings.flatMap(building => {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    return Array.from({ length: definition.width * definition.height }, (_, index) => ({
      tx: building.tx + index % definition.width, ty: building.ty + Math.floor(index / definition.width), id: building.id,
    }));
  });
  const occupied = [...roads, ...footprint];
  shape = { roads, footprint, occupied, minX: Math.min(...occupied.map(tile => tile.tx)), minY: Math.min(...occupied.map(tile => tile.ty)),
    maxX: Math.max(...occupied.map(tile => tile.tx)), maxY: Math.max(...occupied.map(tile => tile.ty)) };
  return shape;
}

function terrainAllowsOpening(world: Grid, offset: TileCoordinate): boolean {
  if (openingShape().occupied.some(tile => getTile(world, { tx: tile.tx + offset.tx, ty: tile.ty + offset.ty })?.terrain === "water")) return false;
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
  const { footprint, roads } = openingShape();
  const ids = new Map(footprint.map(tile => [`${tile.tx + offset.tx},${tile.ty + offset.ty}`, tile.id]));
  const roadKeys = new Set(roads.map(tile => `${tile.tx + offset.tx},${tile.ty + offset.ty}`));
  return { ...state, seed, width: world.width, height: world.height,
    buildings: state.buildings.map(building => ({ ...building, tx: building.tx + offset.tx, ty: building.ty + offset.ty })),
    tiles: world.tiles.map(tile => ({ ...tile, buildingId: ids.get(`${tile.tx},${tile.ty}`) ?? null, hasRoad: roadKeys.has(`${tile.tx},${tile.ty}`) })),
  };
}

/** The opening village's nearest legal translation on a raw world (the riverside town's seed 1 is offset zero). */
export function selectGrowthOpening(world: Grid, seed: number) {
  const offsets: TileCoordinate[] = [];
  const { minX, minY, maxX, maxY } = openingShape();
  for (let ty = -minY; ty < world.height - maxY; ty++) {
    for (let tx = -minX; tx < world.width - maxX; tx++) offsets.push({ tx, ty });
  }
  offsets.sort((a, b) => Math.abs(a.tx) + Math.abs(a.ty) - Math.abs(b.tx) - Math.abs(b.ty) || a.ty - b.ty || a.tx - b.tx);
  for (const offset of offsets) {
    if (!terrainAllowsOpening(world, offset)) continue;
    const state = stampOpening(world, seed, offset);
    if (openingIssues(state).length > 0) continue;
    return { state, provenance: { mode: "translated-opening", offset,
      selection: "minimum Manhattan offset, then dy, then dx; zero when legal" } as const };
  }
  throw new InvalidGrowthOpeningError(seed, ["no-legal-offset: all in-bounds rigid opening translations rejected"]);
}

/**
 * ARCH-1 (MA-7): on a land other than the riverside town the map is that land's, and the state carries its id.
 * ARCH-1b (MA-9): every land's map carries its river (the riverside town's too: the open field with its river).
 */
export function seededOpening(seed: number, archetypeId?: string) {
  if (!Number.isInteger(seed) || seed < 1) throw new RangeError("a map seed is a whole number from 1");
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
  // FIX-11 (MH-1): the manor house on the nearest free grass to the opening village's north-west.
  return { ...opening, state: placeManorSite({ ...state, ...(archetype.terrain.kind === "river" ? {} : { archetypeId: archetype.id }),
    ...(land.river === null ? {} : { river: land.river }) }) };
}
