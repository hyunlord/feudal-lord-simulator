import { RIVERSIDE_ARCHETYPE_ID } from "../content/scenario/archetypes";
import { stateArchetype } from "../engine/archetype";
import type { GameState } from "../engine/engine.types";
import { hashNumbers } from "../world/boundary/boundaryGeometry";
import type { GroundChunkPlan } from "./groundSceneParts";
import { chunkRock, type RockGround } from "./landRockRegions";

// NAT-5 decision N5-D1 (QA-039 on the riverside): the riverside's rock is drawn as the four other lands' is — one
// smoothed region with a soft rim (landRockRegions.ts), no tile diamonds and no ink pebble seams — while the rest of
// its ground stays as LAND-UI kept it (LU-D2: no land ground layer, landGroundOf null). This is the riverside's
// rock-only ground: its rock mask and drained cells, the warp's seed, and the region caches.
// Cache (AGENTS rule 10): (a) key = the map's size, its seed, and the hashes of the rock mask and the drained cells,
// with the tiles array and the drained list as a fast identity check; (b) nothing else enters (the region reads only
// these); (c) cached because the region's contour and warp (a few ms) would otherwise be redone on every chunk raster.
type Key = { readonly tiles: GameState["tiles"]; readonly drained: readonly number[] | undefined; readonly seed: number;
  readonly width: number; readonly height: number; readonly rockHash: number; readonly drainedHash: number };
let last: { readonly key: Key; readonly ground: RockGround | null } | null = null;

/** The riverside's rock-only ground, or null: not the riverside, or no rock on its map. */
export function riversideRockGround(state: GameState): RockGround | null {
  if (stateArchetype(state)?.id !== RIVERSIDE_ARCHETYPE_ID) return null;
  const drained = state.drainage?.drained;
  if (last !== null && last.key.tiles === state.tiles && last.key.drained === drained && last.key.seed === state.seed) return last.ground;
  const rockCells = state.tiles.flatMap((tile, index) => (tile.terrain === "rock" ? [index] : []));
  const key: Key = { tiles: state.tiles, drained, seed: state.seed, width: state.width, height: state.height,
    rockHash: hashNumbers(rockCells), drainedHash: hashNumbers(drained ?? []) };
  const same = last !== null && last.key.seed === key.seed && last.key.width === key.width && last.key.height === key.height
    && last.key.rockHash === key.rockHash && last.key.drainedHash === key.drainedHash;
  if (same) { last = { key, ground: last!.ground }; return last.ground; }
  const size = state.width * state.height;
  const rock = new Uint8Array(size); for (const cell of rockCells) rock[cell] = 1;
  const drainedCells = new Uint8Array(size); for (const cell of drained ?? []) if (cell >= 0 && cell < size) drainedCells[cell] = 1;
  const ground: RockGround | null = rockCells.length === 0 ? null
    : { seed: state.seed, width: state.width, height: state.height, rock, drained: drainedCells, cache: { rockChunks: new Map() } };
  last = { key, ground };
  return ground;
}

/** The riverside ground chunk's key part for its rock: the hashes of the rock loops the chunk draws ("" when none). */
export function riversideRockToken(state: GameState, plan: GroundChunkPlan): string {
  const ground = riversideRockGround(state);
  const part = ground === null ? null : chunkRock(ground, plan);
  if (part === null) return "";
  return `|R${part.loops.map(index => part.region.loops[index]?.hash ?? 0).join(",")}${part.parity ? "p" : ""}`;
}
