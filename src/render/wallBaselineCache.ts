import type { GameState } from "../engine/engine.types";
import { wallBaselines, type WallBaselines } from "../world/boundary/wallBaseline";
import { wallFaceSlices, type WallFaceSlice } from "./drawWallFaces";

// Wall baselines per state (D3b). Cache (AGENTS rule 10): (a) keyed on the palisade object and the tiles array
// (identity: every segment, completion, material or gate change replaces the palisade; every terrain change replaces
// the tiles, which decide the water-side flags); (b) nothing else is read (walkers, ticks and construction progress
// of unfinished segments do not change a completed wall's line); (c) Node 0.5-2.4 ms per seed 1-5 fixture on a miss
// (docs/verification/d3b-walls/REPORT.md), 0 on a hit.

type Entry = { readonly walls: WallBaselines; readonly slices: ReadonlyMap<string, WallFaceSlice> };
const cache = new WeakMap<object, WeakMap<object, Entry>>();
const EMPTY: Entry = { walls: { chains: [], nodes: [], pillars: [], hash: 0 }, slices: new Map() };

export function wallBaselinesFor(state: Pick<GameState, "palisade" | "tiles" | "width" | "height">): Entry {
  if (state.palisade === null || state.palisade === undefined) return EMPTY;
  let byTiles = cache.get(state.palisade);
  if (byTiles === undefined) { byTiles = new WeakMap(); cache.set(state.palisade, byTiles); }
  const cached = byTiles.get(state.tiles);
  if (cached !== undefined) return cached;
  const walls = wallBaselines(state.palisade, state);
  const entry = { walls, slices: wallFaceSlices(walls) };
  byTiles.set(state.tiles, entry);
  return entry;
}
