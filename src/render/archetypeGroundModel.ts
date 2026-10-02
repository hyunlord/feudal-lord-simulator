import type { GameState } from "../engine/engine.types";
import { stateArchetype } from "../engine/archetype";
import { RIVERSIDE_ARCHETYPE_ID } from "../content/scenario/archetypes";
import { hashSeed } from "../content/seedHash";
import { archetypeGroundLayer } from "../world/archetypeGround";
import { hashNumbers, type BoundaryPoint } from "../world/boundary/boundaryGeometry";
import type { Shoreline, ShoreLoop } from "../world/boundary/shoreline";
import type { Tile } from "../world/world.types";
import { GROUND_CHUNK_TILES, TILE_RING, type GroundChunkPlan } from "./groundSceneParts";
import type { SeasonIndex } from "./seasonArt";
import { WAVE22_GROUND_IMAGES, type Wave22GroundKey } from "./wave22GroundManifest.generated";
import { chunkRegions, type ChunkRegion, type FillRegion } from "./archetypeGroundRegions";
import { wave22StripInstalled } from "./landEdgeBand";
import { chunkRock } from "./landRockRegions";

// LAND-UI: the land's ground layer (world/archetypeGround.ts, MA-5) as the ground chunks draw it (archetypeGroundDraw.ts).
// The riverside town (`core:open_field`) has none: its layer is all meadow with no decals, so it never enters this code
// and its chunks keep their keys and pixels (LU-D2).
//  - Season (LU-D1): Wave 22 has no spring; spring shares the summer files.
//  - Fill a / b: the proof's 256-unit chunk (records/proofs-placement-contract.md): one pick per 2 x 2 tile block, the
//    fill's repeat cell, so a and b (their 8 px perimeters match, records/mixed-ab-validation.json) meet only at repeats.
//  - Drained ground (LU-D5): `state.drainage.drained` reads as meadow — no fen fill, band or decal.
//
// Cache (AGENTS rule 10): (a) the last layer, keyed on the land id, the seed, the map size, the terrain (the tiles array
// identity first; a new array with the same terrain codes — a road or a building — reuses the layer through a terrain
// hash) and the drained cells (array identity, then their hash). The fen's drainage turns water to grass in play, so the
// terrain, not (land, seed) alone, decides the layer. (b) Nothing else enters: roads, buildings, zones and the season are
// read at draw time. (c) A build is ~2-4 ms (5 lands, 64 x 64, tsx on the Mac); every frame would pay it, and every
// chunk raster reads it. Per chunk, `chunkHash` (cached on the layer) hashes what the chunk draws of it. NAT-5: the rock
// tiles (the rock region's mask) come from the terrain the key already names.

export type LandGround = {
  readonly id: string;
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly keys: readonly string[];
  readonly fill: Uint8Array;
  readonly band: Uint8Array;
  readonly decal: Uint8Array;
  /** Per key index: the Wave 22 fill base (`chalk_down`), or null (none, the meadow, a band or a decal key). */
  readonly fillBase: readonly (string | null)[];
  /** Per scene shoreline, per chunk: `chunkHash`. */
  readonly chunkHashes: WeakMap<Shoreline, Map<number, number>>;
  readonly loopStrips: WeakMap<Shoreline, Map<number, readonly StripFamily[] | null>>;
  /** Per tile: 1 where `state.drainage.drained` has it. */
  readonly drained: Uint8Array;
  /** Per tile: 1 on rock (NAT-5: the rock region, landRockRegions.ts). */
  readonly rock: Uint8Array;
  /** The fill regions and their per-chunk view (archetypeGroundRegions.ts), made on first use; the rock region alike. */
  readonly cache: { regions?: readonly FillRegion[]; readonly chunks: Map<number, readonly ChunkRegion[]>;
    rock?: FillRegion; readonly rockChunks: Map<number, ChunkRegion | null>;
    /** Per season: the art keys (landArtKeys), and the readiness once every file has loaded (it cannot change after). */
    readonly artKeys: Map<SeasonIndex, readonly Wave22GroundKey[]>; readonly allReady: Map<SeasonIndex, string>;
    /** Every season's art has been asked for (archetypeGroundDraw preloadLandArt). */
    preloaded?: boolean };
};

/**
 * The X-repeating strip families, each drawn as its a | b pair joined into one repeat. NAT-4 (LU-D11): the forest edge
 * is Wave 41's one strip per season (landEdgeBand.ts), drawn while its files are installed.
 */
export const STRIP_FAMILIES = ["boundary/chalk_edge", "boundary/heath_edge", "boundary/fen_edge", "boundary/coastal_edge",
  "boundary/reed_bed", "shore/sand_beach", "shore/shingle", "shore/salt_marsh", "boundary/forest_edge"] as const;
export type StripFamily = (typeof STRIP_FAMILIES)[number];

type Key = { readonly tiles: readonly Tile[]; readonly id: string; readonly seed: number; readonly width: number; readonly height: number;
  readonly terrain: number; readonly drained: readonly number[] | undefined; readonly drainedHash: number };
let last: { readonly key: Key; readonly land: LandGround } | null = null;

export function landGroundOf(state: GameState): LandGround | null {
  const archetype = stateArchetype(state);
  if (archetype === undefined || archetype.id === RIVERSIDE_ARCHETYPE_ID) return null;
  const drained = state.drainage?.drained;
  const same = (key: Key) => key.id === archetype.id && key.seed === state.seed && key.width === state.width && key.height === state.height;
  if (last !== null && same(last.key) && last.key.tiles === state.tiles && last.key.drained === drained) return last.land;
  const terrain = terrainHash(state.tiles);
  const drainedHash = hashNumbers(drained ?? []);
  const key: Key = { tiles: state.tiles, id: archetype.id, seed: state.seed, width: state.width, height: state.height, terrain, drained, drainedHash };
  if (last !== null && same(last.key) && last.key.terrain === terrain && last.key.drainedHash === drainedHash) {
    last = { key, land: last.land };
    return last.land;
  }
  const layer = archetypeGroundLayer(archetype, state.tiles.map(tile => tile.terrain), state.width, state.height, state.seed);
  const fill = Uint8Array.from(layer.fill); const band = Uint8Array.from(layer.band); const decal = Uint8Array.from(layer.decal);
  const meadow = layer.keys.indexOf("terrain/grass");
  const drainedCells = new Uint8Array(fill.length);
  for (const cell of drained ?? []) {
    if (cell < 0 || cell >= fill.length) continue;
    drainedCells[cell] = 1;
    if (fill[cell] !== 0) fill[cell] = meadow;
    band[cell] = 0; decal[cell] = 0;
  }
  const fillBase = layer.keys.map(name => (name.startsWith("terrain/") && name !== "terrain/grass" ? name.slice("terrain/".length) : null));
  const rock = Uint8Array.from(state.tiles, tile => (tile.terrain === "rock" ? 1 : 0));
  const land: LandGround = { id: archetype.id, seed: state.seed, width: state.width, height: state.height, keys: layer.keys, fill, band, decal, fillBase,
    chunkHashes: new WeakMap(), loopStrips: new WeakMap(), drained: drainedCells, rock,
    cache: { chunks: new Map(), rockChunks: new Map(), artKeys: new Map(), allReady: new Map() } };
  last = { key, land };
  return land;
}

function terrainHash(tiles: readonly Tile[]): number {
  let hash = 0x811c_9dc5;
  for (const tile of tiles) hash = Math.imul(hash ^ TERRAIN_CODES[tile.terrain], 0x0100_0193) >>> 0;
  return hash;
}
const TERRAIN_CODES: Readonly<Record<Tile["terrain"], number>> = { grass: 1, forest: 2, water: 3, rock: 4 };

/** LU-D1: the Wave 22 season file a game season draws (spring shares summer). */
export function wave22Season(season: SeasonIndex): "summer" | "autumn" | "winter" {
  return season === 2 ? "autumn" : season === 3 ? "winter" : "summer";
}

/** The fill's a / b for the 2 x 2 block holding a tile (the proof's 256-unit chunk). */
export function fillVariant(seed: number, tx: number, ty: number): "a" | "b" {
  return hashSeed(seed, "wave22:fill", Math.floor(tx / 2), Math.floor(ty / 2)) % 2 === 0 ? "a" : "b";
}

export function fillArtKey(base: string, season: SeasonIndex, variant: "a" | "b"): Wave22GroundKey {
  return `terrain/${base}_${wave22Season(season)}_${variant}` as Wave22GroundKey;
}

/** A band key's strip family (`boundary/chalk_edge_a` -> `boundary/chalk_edge`), or null for a key that is not one. */
export function stripFamily(key: string | undefined): StripFamily | null {
  if (key === undefined) return null;
  const family = key.replace(/_[ab]$/, "");
  return (STRIP_FAMILIES as readonly string[]).includes(family) ? family as StripFamily : null;
}

/** Strips that carry their own water: drawn along the smoothed shore instead of the old shore strip. */
export function isWaterStrip(family: StripFamily | null): boolean {
  return family !== null && (family.startsWith("shore/") || family === "boundary/reed_bed");
}

/** Every Wave 22 file the land draws in `season` (fills a and b, both halves of each strip, the decals and props). */
export function landArtKeys(land: LandGround, season: SeasonIndex): readonly Wave22GroundKey[] {
  const cached = land.cache.artKeys.get(season);
  if (cached !== undefined) return cached;
  const keys = new Set<Wave22GroundKey>();
  land.keys.forEach((name, index) => {
    const base = land.fillBase[index] ?? null;
    if (base !== null) { keys.add(fillArtKey(base, season, "a")); keys.add(fillArtKey(base, season, "b")); return; }
    const family = stripFamily(name);
    if (family !== null) { if (wave22StripInstalled(family)) { keys.add(`${family}_a` as Wave22GroundKey); keys.add(`${family}_b` as Wave22GroundKey); } return; }
    if (name in WAVE22_GROUND_IMAGES) keys.add(name as Wave22GroundKey);
  });
  const sorted = [...keys].sort();
  land.cache.artKeys.set(season, sorted);
  return sorted;
}

/**
 * What a chunk draws of the layer: its tiles and a TILE_RING ring (props rise ~1.5 tiles over their anchor), the fill
 * regions' and the rock region's loops that reach it (and their parity), and its shore loops' strips.
 */
export function chunkHash(land: LandGround, plan: GroundChunkPlan, shore: Shoreline): number {
  const id = plan.cy * 4096 + plan.cx;
  let byChunk = land.chunkHashes.get(shore);
  if (byChunk === undefined) { byChunk = new Map(); land.chunkHashes.set(shore, byChunk); }
  const cached = byChunk.get(id);
  if (cached !== undefined) return cached;
  const values: number[] = [];
  for (let ty = plan.cy * GROUND_CHUNK_TILES - TILE_RING; ty < (plan.cy + 1) * GROUND_CHUNK_TILES + TILE_RING; ty += 1) {
    for (let tx = plan.cx * GROUND_CHUNK_TILES - TILE_RING; tx < (plan.cx + 1) * GROUND_CHUNK_TILES + TILE_RING; tx += 1) {
      if (tx < 0 || ty < 0 || tx >= land.width || ty >= land.height) { values.push(-1); continue; }
      const index = ty * land.width + tx;
      values.push(land.fill[index]! | (land.band[index]! << 8) | (land.decal[index]! << 16));
    }
  }
  for (const { region, loops, parity } of [...chunkRegions(land, plan), ...[chunkRock(land, plan)].filter(part => part !== null)]) {
    values.push(-3, region.base.length, parity ? 1 : 0, ...loops.map(index => region.loops[index]?.hash ?? 0));
  }
  for (const loop of plan.waterLoops) {
    const strips = loopStrips(land, shore, loop);
    values.push(-2, loop, ...(strips ?? []).map(family => STRIP_FAMILIES.indexOf(family)));
  }
  const hash = hashNumbers(values);
  byChunk.set(id, hash);
  return hash;
}

/**
 * The strip family of every segment of a shore loop whose land side carries a shore or reed-bed band (the coast's sea,
 * the fen's water), or null for a loop with none (a brook or mere on the other lands keeps the old shore strip). A
 * segment reads the band of the land tile just beside its middle; segments beside no such tile (rock, forest, a road)
 * take the family of the nearest one before them along the loop, so a stretch runs on unbroken.
 */
export function loopStrips(land: LandGround, shore: Shoreline, index: number): readonly StripFamily[] | null {
  let byLoop = land.loopStrips.get(shore);
  if (byLoop === undefined) { byLoop = new Map(); land.loopStrips.set(shore, byLoop); }
  const cached = byLoop.get(index);
  if (cached !== undefined) return cached;
  const loop = shore.loops[index];
  const result = loop === undefined ? null : sampleLoop(land, loop);
  byLoop.set(index, result);
  return result;
}

function sampleLoop(land: LandGround, loop: ShoreLoop): readonly StripFamily[] | null {
  const line = loop.smoothed;
  const count = line.length;
  const found: (StripFamily | null)[] = [];
  for (let index = 0; index < count; index += 1) {
    const a = line[index] as BoundaryPoint; const b = line[(index + 1) % count] as BoundaryPoint;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const normal = { x: -(b.y - a.y) / length * loop.landSide, y: (b.x - a.x) / length * loop.landSide };
    const tx = Math.round((a.x + b.x) / 2 + normal.x * 0.6); const ty = Math.round((a.y + b.y) / 2 + normal.y * 0.6);
    const inside = tx >= 0 && ty >= 0 && tx < land.width && ty < land.height;
    const family = inside ? stripFamily(land.keys[land.band[ty * land.width + tx]!]) : null;
    found.push(isWaterStrip(family) ? family : null);
  }
  const first = found.findIndex(family => family !== null);
  if (first < 0) return null;
  const strips: StripFamily[] = new Array(count);
  let current = found[first] as StripFamily;
  for (let step = 0; step < count; step += 1) {
    const index = (first + step) % count;
    current = found[index] ?? current;
    strips[index] = current;
  }
  return strips;
}

/** The loops (indexes into `shore.loops`) whose shore strip the land draws (drawShoreline leaves them out). */
export function landStripLoops(land: LandGround, shore: Shoreline, loops: readonly number[]): ReadonlySet<number> {
  return new Set(loops.filter(index => loopStrips(land, shore, index) !== null));
}
