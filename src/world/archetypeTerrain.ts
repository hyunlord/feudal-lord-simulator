/**
 * ARCH-1 (spec docs/design/map-archetypes.md MA-2): a map archetype's land, deterministic in (archetype, seed).
 *
 * The riverside town (`river`) is `buildWorldGrid` unchanged — its maps, its guardrail and its saves stay as they are.
 * The other lands read the same elevation and moisture fields (sampled with the archetype's own salt, so a coast is not
 * the open field's seed 1 with a sea painted on), broken by finer noise, and cut them at their own shares; the coast adds a sea along the north or
 * west edge (the seed picks). Then the open field's clean-up, then the town site (MA-2 ②): the opening village, its
 * first street and the tutorial's ground are open land, and the logging camp has its copse — so every land starts the
 * same village at the same place with its roads joined — and last the quarry's rock is guaranteed as on the open field
 * (off the town site).
 */
import type { ArchetypeDef, ArchetypeTerrainKind } from "../content/scenario/types";
import type { TerrainType } from "../content/terrainConfig";
import { hashSeed } from "../content/seedHash";
import { guaranteeEssentialResourceTerrain } from "./essentialResources";
import type { Grid } from "./grid";
import { fbm } from "./noise";
import { carveRiver, riverSource, type RiverData, type RiverSpec } from "./river";
import { buildWorldGrid, cleanupTerrainRegions, terrainFields, WORLD_SAMPLE_ORIGIN, type WorldGridSize } from "./terrain";
import type { Tile } from "./world.types";

/** MA-2: each land samples the fields at its own seed offset. */
const FIELD_SALT: Readonly<Record<Exclude<ArchetypeTerrainKind, "river">, number>> = {
  coast: 101_117, downs: 202_231, woodland: 303_347, fen: 404_459,
};

/**
 * MA-2 ②: the town site. The village, its roads, the tutorial's buildings and fields and the first street (the human
 * path's, `tests/helpers/humanStreet.ts`) all lie in this rectangle; it is open ground on every new land. Around it the
 * clearing's edge wanders (a noise margin), so the site does not end in a straight line.
 */
export const TOWN_SITE = { minTx: 30, maxTx: 50, minTy: 34, maxTy: 62 } as const;
/** The logging camp's copse east of the village (the opening camp stands at 50,40 and needs a forest neighbour). */
export const CAMP_COPSE = { tx: 54, ty: 40, rx: 3.5, ry: 4.5 } as const;
const CAMP_NEIGHBOUR = { tx: 51, ty: 40 } as const;
const SITE_CENTRE = { tx: (TOWN_SITE.minTx + TOWN_SITE.maxTx) / 2, ty: (TOWN_SITE.minTy + TOWN_SITE.maxTy) / 2 };
/** The site's rectangle sits at 0.8 of the clearing's half-size; the margin's noise is at most ±0.15. */
const SITE_REACH = 0.8;
const CLEARING_JITTER = 0.15;
/** A rounded square (superellipse): its corners are not the rectangle's. */
const CLEARING_POWER = 4;
const CLEARING_HALF = {
  tx: (TOWN_SITE.maxTx - TOWN_SITE.minTx) / 2 / SITE_REACH,
  ty: (TOWN_SITE.maxTy - TOWN_SITE.minTy) / 2 / SITE_REACH,
};

const inRect = (rect: { minTx: number; maxTx: number; minTy: number; maxTy: number }, tx: number, ty: number) =>
  tx >= rect.minTx && tx <= rect.maxTx && ty >= rect.minTy && ty <= rect.maxTy;

/** MA-2 ③: the coast's sea edge — north or west (the town site lies south-east of the map's middle). */
export function coastSeaEdge(seed: number): "north" | "west" {
  return hashSeed(seed, "archetype:sea-edge") % 2 === 0 ? "north" : "west";
}

/**
 * MA-2 ①: the land's base terrain by rank. Water is the lowest `shares.water` of the (detail-broken) elevation, rock
 * the highest `shares.rock`; forest the wettest `shares.forest` of what is left — so each seed of a land has its shares.
 */
function baseTerrains(archetype: ArchetypeDef, width: number, height: number, seed: number): { terrains: TerrainType[]; lift: Float64Array } {
  const shares = archetype.terrain.shares!;
  const detail = (archetype.terrain.detailPermille ?? 0) / 1000;
  const count = width * height;
  const lift = new Float64Array(count);
  const wet = new Float64Array(count);
  for (let ty = 0; ty < height; ty += 1) for (let tx = 0; tx < width; tx += 1) {
    const { elevation, moisture } = terrainFields(tx + WORLD_SAMPLE_ORIGIN.tx, ty + WORLD_SAMPLE_ORIGIN.ty, seed);
    const fine = fbm(tx * 0.11, ty * 0.11, seed + 9_001, 3);
    const damp = fbm((tx + 17) * 0.12, (ty - 5) * 0.12, seed + 9_137, 3);
    lift[ty * width + tx] = elevation * (1 - detail) + fine * detail;
    wet[ty * width + tx] = moisture * (1 - detail) + damp * detail;
  }
  const byLift = Array.from({ length: count }, (_, index) => index).sort((a, b) => lift[a]! - lift[b]! || a - b);
  const terrains: TerrainType[] = new Array<TerrainType>(count).fill("grass");
  const waterCount = Math.round(count * shares.water / 1000);
  const rockCount = Math.round(count * shares.rock / 1000);
  for (let rank = 0; rank < waterCount; rank += 1) terrains[byLift[rank]!] = "water";
  for (let rank = count - rockCount; rank < count; rank += 1) terrains[byLift[rank]!] = "rock";
  const open = byLift.slice(waterCount, count - rockCount).sort((a, b) => wet[b]! - wet[a]! || a - b);
  const forestCount = Math.min(open.length, Math.round(count * shares.forest / 1000));
  for (let rank = 0; rank < forestCount; rank += 1) terrains[open[rank]!] = "forest";
  return { terrains, lift };
}

function inClearing(tx: number, ty: number, seed: number): boolean {
  const reach = ((Math.abs(tx - SITE_CENTRE.tx) / CLEARING_HALF.tx) ** CLEARING_POWER
    + (Math.abs(ty - SITE_CENTRE.ty) / CLEARING_HALF.ty) ** CLEARING_POWER) ** (1 / CLEARING_POWER);
  const jitter = (fbm(tx * 0.21, ty * 0.21, seed + 55_001, 2) - 0.5) * 2 * CLEARING_JITTER;
  return reach + jitter < 1;
}

function inCopse(tx: number, ty: number, seed: number): boolean {
  if (tx === CAMP_NEIGHBOUR.tx && ty === CAMP_NEIGHBOUR.ty) return true;
  const reach = Math.hypot((tx - CAMP_COPSE.tx) / CAMP_COPSE.rx, (ty - CAMP_COPSE.ty) / CAMP_COPSE.ry);
  return tx > TOWN_SITE.maxTx && reach + (fbm(tx * 0.3, ty * 0.3, seed + 56_003, 2) - 0.5) * 0.5 < 1;
}

function stampTownSite(terrains: TerrainType[], width: number, height: number, seed: number): void {
  for (let ty = 0; ty < height; ty += 1) for (let tx = 0; tx < width; tx += 1) {
    const index = ty * width + tx;
    if (inCopse(tx, ty, seed)) terrains[index] = "forest";
    else if (inRect(TOWN_SITE, tx, ty) || inClearing(tx, ty, seed)) terrains[index] = "grass";
  }
}

/**
 * MA-2 ④: the quarry's rock, as on the open field (`guaranteeEssentialResourceTerrain`), but never on the town site's
 * rectangle: the site is held out of the land while the guarantee looks (as if water), then given back as open ground.
 */
function guaranteeQuarryRock(terrains: readonly TerrainType[], width: number, height: number, seed: number): TerrainType[] {
  const masked = terrains.map((terrain, index) => inRect(TOWN_SITE, index % width, Math.floor(index / width)) ? "water" : terrain);
  const guaranteed = guaranteeEssentialResourceTerrain(masked, width, height, seed).terrains;
  return guaranteed.map((terrain, index) => inRect(TOWN_SITE, index % width, Math.floor(index / width)) ? "grass" : terrain);
}


/**
 * MA-9: the quarry's rock on the town's side of the river. The bot builds no bridge, so a quarry across the channel is
 * out of its reach (ARCH-1b comparison: the harbour's seed 3 never had stone, hence no church and no L4). The guarantee
 * runs once more on the land joined to the town site only (the rest held out as water), then everything is given back.
 */
function guaranteeTownSideRock(terrains: readonly TerrainType[], width: number, height: number, seed: number): TerrainType[] {
  const town = new Uint8Array(terrains.length);
  const start = SITE_ANCHOR.ty * width + SITE_ANCHOR.tx;
  const queue = [start];
  town[start] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const tx = index % width, ty = Math.floor(index / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = tx + dx, y = ty + dy, next = y * width + x;
      if (x < 0 || y < 0 || x >= width || y >= height || town[next] === 1 || terrains[next] === "water") continue;
      town[next] = 1;
      queue.push(next);
    }
  }
  const masked = terrains.map((terrain, index) => town[index] === 1 ? terrain : "water");
  const guaranteed = guaranteeQuarryRock(masked, width, height, seed);
  return terrains.map((terrain, index) => town[index] === 1 ? guaranteed[index]! : terrain);
}

/** A tile inside the town site the town's land is reached from. */
const SITE_ANCHOR = { tx: 40, ty: 48 } as const;

/**
 * MA-9: the rectangles the river may not enter — the town site (one tile wider) and the logging camp's copse — so the
 * opening village, its first street and its camp's forest stand on every land and seed.
 */
export const RIVER_CLOSED = [
  { minTx: TOWN_SITE.minTx - 1, maxTx: TOWN_SITE.maxTx + 1, minTy: TOWN_SITE.minTy - 1, maxTy: TOWN_SITE.maxTy + 1 },
  { minTx: 51, maxTx: 58, minTy: 35, maxTy: 46 },
] as const;

export interface ArchetypeWorld {
  readonly terrains: TerrainType[];
  /** MA-9: the river (or brook) carved into `terrains`; null only if no channel could be found. */
  readonly river: RiverData | null;
}

/** The river's spec on a land: to the sea on the coast, else across to the opposite edge. */
function riverSpec(archetype: ArchetypeDef): RiverSpec {
  const river = archetype.terrain.river;
  return { kind: river.kind, minWidth: river.minWidth, maxWidth: river.maxWidth, mouth: archetype.terrain.sea === undefined ? "edge" : "sea" };
}

/**
 * MA-2, MA-9: a land's terrain and its river. The riverside town is the open field's map (`buildWorldGrid`) with the
 * river carved across it (ARCH-1b; the open field had lakes and no running water) and the quarry's rock guaranteed again
 * off the town site; a new land is drawn by its shares, then its sea, clean-up, town site, river and quarry rock.
 */
export function buildArchetypeWorld(archetype: ArchetypeDef, size: WorldGridSize, siteOffset: { readonly tx: number; readonly ty: number } = { tx: 0, ty: 0 }): ArchetypeWorld {
  const { width, height } = size;
  const spec = riverSpec(archetype);
  // The rectangles the river keeps off, moved with the town site (the guardrail's seeds 2–5 translate the riverside
  // town's opening village; a new land's never moves).
  const closed = RIVER_CLOSED.map(rect => ({ minTx: rect.minTx + siteOffset.tx, maxTx: rect.maxTx + siteOffset.tx,
    minTy: rect.minTy + siteOffset.ty, maxTy: rect.maxTy + siteOffset.ty }));
  if (archetype.terrain.kind === "river") {
    const terrains = buildWorldGrid(size).tiles.map(tile => tile.terrain);
    const lift = (index: number) => terrainFields(index % width + WORLD_SAMPLE_ORIGIN.tx, Math.floor(index / width) + WORLD_SAMPLE_ORIGIN.ty, size.seed).elevation;
    // The open field's quarry rock is already guaranteed (`buildWorldGrid`); the river comes last.
    const river = carveRiver(terrains, width, height, size.seed, spec, lift, closed, riverSource(size.seed));
    return { terrains, river };
  }
  const fieldSeed = size.seed + FIELD_SALT[archetype.terrain.kind];
  const { terrains, lift } = baseTerrains(archetype, width, height, fieldSeed);
  const sea = archetype.terrain.sea;
  let source = riverSource(size.seed);
  if (sea !== undefined) {
    const edge = coastSeaEdge(size.seed);
    // The brook rises at the edge opposite the sea and runs into it.
    source = edge === "north" ? "south" : "east";
    const span = sea.maxDepth - sea.minDepth;
    for (let ty = 0; ty < height; ty += 1) for (let tx = 0; tx < width; tx += 1) {
      const along = edge === "north" ? tx : ty;
      const depth = sea.minDepth + span * fbm(along * 0.09, 0.5, fieldSeed + 7_331, 3);
      if ((edge === "north" ? ty : tx) < depth) terrains[ty * width + tx] = "water";
    }
  }
  const cleaned = cleanupTerrainRegions(terrains, width, height);
  stampTownSite(cleaned, width, height, size.seed);
  // The quarry's rock before the river: a channel splitting the land would otherwise make the guarantee add rock to each
  // side (it looks for a quarry site in every dry component).
  const guaranteed = guaranteeQuarryRock(cleaned, width, height, size.seed);
  const river = carveRiver(guaranteed, width, height, fieldSeed, spec, index => lift[index]!, closed, source);
  return { terrains: guaranteeTownSideRock(guaranteed, width, height, size.seed), river };
}

/** MA-2: the terrain of any land, row-major. */
export function archetypeTerrains(archetype: ArchetypeDef, size: WorldGridSize): TerrainType[] {
  return buildArchetypeWorld(archetype, size).terrains;
}

/** MA-2: the world grid of any land. */
export function buildArchetypeWorldGrid(archetype: ArchetypeDef, size: WorldGridSize): Grid {
  const tiles: Tile[] = archetypeTerrains(archetype, size).map((terrain, index) => ({
    tx: index % size.width, ty: Math.floor(index / size.width), terrain, buildingId: null, hasRoad: false,
  }));
  return { width: size.width, height: size.height, tiles };
}
