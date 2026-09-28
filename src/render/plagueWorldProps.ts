import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { plagueStage, plagueVacantPlots } from "../engine/plague";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { depthKey, tileToScreen } from "./iso";
import type { RenderQueueItem } from "./objectRenderOrder";
import { tileIsVisibleInRange } from "./renderVisibility";
import type { TileRange } from "./renderVisibility";
import { storyWalkerScale } from "./storyWorldProps";
import { wave9Art, drawWave9, wave9Meta, type Wave9Key } from "./wave9Art";
import { drawCroppedWorldSprite } from "./worldSprite";

// UI-8 chapter 3 plague world props (spec docs/design/chapter-three-plague.md PL-2, PL-6):
//   1. Fresh grave decals (Wave 9 decal_fresh_graves_a/_b) in the churchyard, joining the object
//      queue depth-sorted like warWorldProps.ts. Appear after the first plague deaths; grow with
//      plague.first.dead (capped at MAX_GRAVES); persist after the plague (they are graves). If
//      no church, beside the chapel, then the keep.
//   2. Funeral procession (wk_funeral_bearers, 4×2 sheet) during plagueStage "arrival" (both
//      pestilences): drawn after the object pass via drawFuneralProcession called from wetSummer.ts
//      drawStoryWorldOverlays. Looping animation from a source house to the church; deterministic
//      path from seed + plague.first.arrivalTick; direction-aware; prop_bier_shroud beside it.
// Plague-shut overlays (event_plague_shut_l*) replacing boarded: done in buildingOverlays.ts.
// Departure suppression + abandoned_house suppression: done in storyWorldProps.ts + worldSigns.ts.
// Church curacy-vacant sign: done in worldSigns.ts (curacy_vacant WorldSignKind).
// withPlagueProps is imported in renderObjectFrameCache.ts (+1 import line) and inserted in chain.

/** Kind of plague grave decal in the object queue. */
export type PlaguePropKind = "grave_a" | "grave_b";

/** A fresh grave decal in the churchyard, depth-sorted in the object render queue. */
export type PlagueProp = {
  readonly kind: PlaguePropKind;
  readonly tx: number;
  readonly ty: number;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly id: string;
};

const MAX_GRAVES = 4;
const GRAVES_PER_DEAD = 3; // one new grave appears for every three deaths, up to MAX_GRAVES
const GRAVE_SCALE = 0.5; // decal_fresh_graves is 128×64; at 0.5 it fits in one tile

/** Church or chapel to anchor the churchyard; falls back to the keep. */
function churchBuilding(state: GameState): Building | null {
  return state.buildings.find(b => b.kind === "church")
    ?? state.buildings.find(b => b.kind === "chapel")
    ?? state.buildings.find(b => b.kind === "keep")
    ?? null;
}

/** Fast deterministic integer hash, seeded. */
function hashInts(seed: number, ...values: readonly number[]): number {
  let h = seed;
  for (const v of values) { h = Math.imul(h ^ v, 2_654_435_761); h ^= h >>> 13; }
  return h >>> 0;
}

function computeGraves(state: GameState): readonly PlagueProp[] {
  const dead = state.plague?.first?.dead ?? 0;
  if (dead === 0) return [];
  const church = churchBuilding(state);
  if (church === null) return [];
  const fp = buildingFootprint(church);
  const count = Math.min(MAX_GRAVES, Math.max(1, Math.ceil(dead / GRAVES_PER_DEAD)));
  // Occupied set: every tile any building covers.
  const occupied = new Set<number>();
  for (const b of state.buildings) {
    const bfp = buildingFootprint(b);
    for (let dy = 0; dy < bfp.height; dy += 1) for (let dx = 0; dx < bfp.width; dx += 1)
      occupied.add((b.ty + dy) * state.width + b.tx + dx);
  }
  // Candidate tiles: grass ring around the church footprint (up to 2 tiles out), not occupied.
  const candidates: { tx: number; ty: number }[] = [];
  for (let dy = -2; dy <= fp.height + 1; dy += 1) {
    for (let dx = -2; dx <= fp.width + 1; dx += 1) {
      if (dy >= 0 && dy < fp.height && dx >= 0 && dx < fp.width) continue; // skip inside
      const tx = church.tx + dx; const ty = church.ty + dy;
      if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) continue;
      if (occupied.has(ty * state.width + tx)) continue;
      if (state.tiles[ty * state.width + tx]?.terrain !== "grass") continue;
      candidates.push({ tx, ty });
    }
  }
  if (candidates.length === 0) return [];
  // Deterministic scatter: seeded hash over each candidate tile, sort, take count.
  const arrivalTick = state.plague?.first?.arrivalTick ?? 0;
  const picked = candidates
    .map(tile => ({ tile, key: hashInts(state.seed, arrivalTick, tile.tx * 31, tile.ty * 17) }))
    .sort((a, b) => a.key - b.key)
    .slice(0, count);
  return picked.map(({ tile }, index) => ({
    kind: (index % 2 === 0 ? "grave_a" : "grave_b") as PlaguePropKind,
    tx: tile.tx, ty: tile.ty, x: tile.tx, y: tile.ty,
    depth: depthKey(tile.tx, tile.ty),
    id: `plague:grave:${tile.tx}:${tile.ty}`,
  }));
}

// Cache: keyed on the state object (new state → recompute).
let lastGraveState: GameState | null = null;
let lastGraves: readonly PlagueProp[] = [];

/** The plague's world props: fresh graves in the churchyard after first deaths. Cached by state. */
export function plagueProps(state: GameState): readonly PlagueProp[] {
  if (lastGraveState === state) return lastGraves;
  const graves = computeGraves(state);
  // Identity-preserving: same content → keep previous array (merge cache identity in queue).
  const prev = lastGraves;
  const same = prev.length === graves.length && graves.every((g, i) => g.id === prev[i]!.id && g.kind === prev[i]!.kind);
  lastGraveState = state; lastGraves = same ? prev : graves;
  return lastGraves;
}

/** Draws a plague grave decal at its tile (called from drawObjectRenderItems for "plague_prop"). */
export function drawPlagueProp(context: CanvasRenderingContext2D, prop: PlagueProp): void {
  const at = tileToScreen(prop.x, prop.y);
  drawWave9(context, prop.kind === "grave_a" ? "decal_fresh_graves_a" : "decal_fresh_graves_b", at.sx, at.sy, GRAVE_SCALE);
}

// Object-queue integration (mirrors withWarProps in renderObjectFrameCache.ts).
type PlaguePropItem = { readonly kind: "plague_prop"; readonly id: string; readonly prop: PlagueProp; readonly depth: number; readonly anchorTx: number };
let lastPlagueMerge: { readonly queue: readonly RenderQueueItem[]; readonly props: readonly PlagueProp[]; readonly range: string; readonly result: readonly RenderQueueItem[] } | null = null;

/** Merges grave props into the sorted render queue. Imported by renderObjectFrameCache.ts (+1 line). */
export function withPlagueProps(queue: readonly RenderQueueItem[], state: GameState, range: TileRange): readonly RenderQueueItem[] {
  if (state.plague?.first === undefined) return queue;
  const props = plagueProps(state);
  if (props.length === 0) return queue;
  const rangeStr = `${range.minTx},${range.minTy},${range.maxTx},${range.maxTy}`;
  if (lastPlagueMerge !== null && lastPlagueMerge.queue === queue && lastPlagueMerge.props === props && lastPlagueMerge.range === rangeStr) return lastPlagueMerge.result;
  const visible: PlaguePropItem[] = props.filter(prop => tileIsVisibleInRange(prop.tx, prop.ty, range))
    .map(prop => ({ kind: "plague_prop" as const, id: prop.id, prop, depth: prop.depth, anchorTx: prop.tx }));
  const result = visible.length === 0 ? queue : mergeSortedPlagueItems(queue, visible);
  lastPlagueMerge = { queue, props, range: rangeStr, result };
  return result;
}

function mergeSortedPlagueItems(left: readonly RenderQueueItem[], right: readonly PlaguePropItem[]): readonly RenderQueueItem[] {
  const out: RenderQueueItem[] = [];
  let li = 0; let ri = 0;
  const cmp = (a: RenderQueueItem, b: PlaguePropItem) => a.depth - b.depth || a.anchorTx - b.anchorTx || a.id.localeCompare(b.id);
  while (li < left.length && ri < right.length) {
    const l = left[li]!; const r = right[ri]!;
    if (cmp(l, r) <= 0) { out.push(l); li += 1; } else { out.push(r); ri += 1; }
  }
  while (li < left.length) { const item = left[li]; if (item !== undefined) out.push(item); li += 1; }
  while (ri < right.length) { const item = right[ri]; if (item !== undefined) out.push(item); ri += 1; }
  return out;
}

// ─── Funeral procession (drawn after the object pass; called from drawStoryWorldOverlays) ───────

const PROCESSION_LOOP_MS = 16_000; // total cycle: travel + pause
const PROCESSION_MS = 12_000; // travel time house → church
const GAIT_MS = 260;
const BIER_SCALE = 0.65;

const DIR_COL = { NE: 0, SE: 1, SW: 2, NW: 3 } as const;
type Direction = keyof typeof DIR_COL;

/** Mirror of storyWorldProps.ts drawCell (unexported there): one frame of a 4×2 walker sheet. */
function drawWalkerCell(ctx: CanvasRenderingContext2D, key: Wave9Key, dir: Direction, gait: number, x: number, y: number, scale: number): void {
  const image = wave9Art(key);
  const meta = wave9Meta(key);
  if (image === null || !("frames" in meta)) return;
  const { width, height } = meta.frames;
  drawCroppedWorldSprite(ctx, image,
    { x: DIR_COL[dir] * width, y: (gait % 2) * height, width, height },
    { x: x - meta.pivot.x * scale, y: y - meta.pivot.y * scale, width: width * scale, height: height * scale },
    false, true);
}

function buildingDoor(b: Building): { readonly sx: number; readonly sy: number } {
  const fp = buildingFootprint(b);
  return tileToScreen(b.tx + fp.width / 2 - 0.5, b.ty + fp.height + 0.1);
}

// Presentation memory: the procession path; reset when arrivalTick changes (new game or load).
let cachedPath: { readonly from: { sx: number; sy: number }; readonly to: { sx: number; sy: number }; readonly arrivalTick: number } | null = null;

function getProcessionPath(state: GameState): { from: { sx: number; sy: number }; to: { sx: number; sy: number } } | null {
  const first = state.plague?.first;
  if (first === undefined) return null;
  const { arrivalTick } = first;
  if (cachedPath?.arrivalTick === arrivalTick) return cachedPath;
  const church = churchBuilding(state);
  if (church === null) return null;
  const houses = state.buildings.filter(b => b.kind === "house");
  if (houses.length === 0) return null;
  // Prefer a plague-vacant house (died households), else any house near centre; deterministic.
  const vacantIds = new Set(plagueVacantPlots(state));
  const byKey = houses.map((b, i) => ({ b, key: hashInts(state.seed, arrivalTick, i) })).sort((a, z) => a.key - z.key);
  const source = (byKey.find(({ b }) => vacantIds.has(b.id)) ?? byKey[0])?.b;
  if (source === undefined) return null;
  cachedPath = { from: buildingDoor(source), to: buildingDoor(church), arrivalTick };
  return cachedPath;
}

/** Funeral bearers over the world during plagueStage "arrival" (both pestilences).
 *  Called from wetSummer.ts drawStoryWorldOverlays after the object pass. */
export function drawFuneralProcession(context: CanvasRenderingContext2D, state: GameState, nowMs: number): void {
  if (plagueStage(state) !== "arrival") return;
  const path = getProcessionPath(state);
  if (path === null) return;
  const t = (nowMs % PROCESSION_LOOP_MS) / PROCESSION_MS;
  if (t >= 1) return; // pause / return — not visible
  const x = path.from.sx + (path.to.sx - path.from.sx) * t;
  const y = path.from.sy + (path.to.sy - path.from.sy) * t;
  const dx = path.to.sx - path.from.sx; const dy = path.to.sy - path.from.sy;
  const dir: Direction = dx >= 0 ? (dy >= 0 ? "SE" : "NE") : (dy >= 0 ? "SW" : "NW");
  const gait = Math.floor(nowMs / GAIT_MS);
  drawWalkerCell(context, "wk_funeral_bearers", dir, gait, x, y, storyWalkerScale("wk_funeral_bearers"));
  // Bier: NE for eastward legs, NW for westward; drawn slightly ahead of the bearers.
  const bierKey: Wave9Key = dir === "NE" || dir === "SE" ? "prop_bier_shroud_ne" : "prop_bier_shroud_nw";
  const bierOffX = dir === "NE" || dir === "SE" ? 10 : -10;
  drawWave9(context, bierKey, x + bierOffX, y + 6, BIER_SCALE);
}
