import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { guildOf } from "../engine/reorganisation";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { depthKey, tileToScreen } from "./iso";
import { manifestArt } from "./manifestArt";
import type { RenderQueueItem } from "./objectRenderOrder";
import type { TileRange } from "./renderVisibility";
import { tileIsVisibleInRange } from "./renderVisibility";
import { storyWalkerScale } from "./storyWorldProps";
import { WAVE12_GUILDHALL_IMAGES } from "./wave12GuildhallManifest.generated";
import { wave9Art, wave9Meta, type Wave9Key } from "./wave9Art";
import { drawCroppedWorldSprite } from "./worldSprite";
import { canTraverseWallBoundary } from "../world/wallTraversal";
import { drawCollector } from "./collectorWalker";

// UI-9: Chapter 4 reorganisation world props (spec docs/design/chapter-four-reorganisation.md RG-4…RG-8).
//  1. Guildhall world prop: Wave 12 guildhall painting on a free 3 × 2 spot near the market (grass or felled forest, no road, building or site) while guildOf(state) !== null.
//     Depth-sorted in the object queue via withReorgProps (called from renderObjectFrameCache.ts).
//  2. Textile walkers: two walkers carrying bolts between weaver houses while textileStreetTick is set and ≥2 exist.
//  3. Alehouse drinkers: NAT-2 draws them in the object pass at the ale barrels (alehouseCrowd.ts).
//  4. Collector chase: 2 walkers hurrying toward the map edge after rebellion outcome "chased" (within a season).
// Petition crowd (reorg.petitions_surge + open ch4 petitions): storyWorldProps.ts petitionGathering already covers
//   this — openPetitions() returns ch4 petitions (guild_charter, tax_collection, etc.) from politics.petitions.
// Note: textile street walkers read better once CLOTH-UI installs the Wave 3 cloth bolt and weaver_house paintings —
//   then the bolts prop and painted houses make the cluster identity obvious without extra decoration.

const SEASON_TICKS = 1_000;
const GAIT_MS = 260;
const GUILDHALL_SCALE = 0.5; // zoom1Scale: 352×300 → 176×150 screen px at zoom 1, ~3 tiles wide
/** The guildhall's plot (tx, ty is its back corner). */
export const GUILDHALL_FOOTPRINT = { width: 3, height: 2 } as const;

const guildhallArt = manifestArt<keyof typeof WAVE12_GUILDHALL_IMAGES>(WAVE12_GUILDHALL_IMAGES);
export const preloadGuildhallArt = guildhallArt.preload;

// ─── Guildhall world prop (object queue) ─────────────────────────────────────

/** Kind for the guildhall in the render queue. */
export type ReorgPropKind = "guildhall";
export type ReorgProp = {
  readonly kind: ReorgPropKind;
  readonly tx: number;
  readonly ty: number;
  readonly depth: number;
  readonly id: string;
};

const hashI = (seed: number, ...vs: number[]): number => {
  let h = seed; for (const v of vs) { h = Math.imul(h ^ v, 2_654_435_761); h ^= h >>> 13; } return h >>> 0;
};

// Stable cache: keyed on buildings array identity (new state.buildings → recompute).
let lastSpotBuildings: GameState["buildings"] | null = null;
let lastSpot: { tx: number; ty: number } | null = null;

function guildhallSpot(state: GameState): { tx: number; ty: number } | null {
  if (lastSpotBuildings === state.buildings) return lastSpot;
  lastSpotBuildings = state.buildings;
  lastSpot = computeGuildhallSpot(state);
  return lastSpot;
}

function computeGuildhallSpot(state: GameState): { tx: number; ty: number } | null {
  const occupied = new Set<number>();
  for (const b of state.buildings) { const fp = buildingFootprint(b);
    for (let dy = 0; dy < fp.height; dy += 1) for (let dx = 0; dx < fp.width; dx += 1) occupied.add((b.ty + dy) * state.width + b.tx + dx); }
  for (const site of state.constructionSites ?? []) if ("tx" in site) occupied.add((site as { tx: number; ty: number }).ty * state.width + (site as { tx: number; ty: number }).tx);
  for (const tile of state.tiles) if (tile.hasRoad) occupied.add(tile.ty * state.width + tile.tx);
  const felled = new Set((state.forestHarvests ?? []).map(h => h.ty * state.width + h.tx));
  // Fields and pastures are the town's; no zone cell takes the hall.
  for (const zone of state.zones ?? []) for (const index of zone.membership) occupied.add(index);
  // The painting stands on a 3 × 2 footprint (its pivot: the footprint's south-west front corner): all six cells free.
  const free3x2 = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx + 2 >= state.width || ty + 1 >= state.height) return false;
    for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 3; dx += 1) {
      const k = (ty + dy) * state.width + tx + dx; if (occupied.has(k) || !inside.has(k)) return false;
      const tile = state.tiles[k]; if (tile === undefined) return false;
      if (tile.terrain !== "grass" && !(tile.terrain === "forest" && felled.has(k))) return false;
      // The town wall runs along tile edges: none may cross the hall's plot.
      if (dx > 0 && !canTraverseWallBoundary(state, { tx: tx + dx - 1, ty: ty + dy }, { tx: tx + dx, ty: ty + dy })) return false;
      if (dy > 0 && !canTraverseWallBoundary(state, { tx: tx + dx, ty: ty + dy - 1 }, { tx: tx + dx, ty: ty + dy })) return false;
    } return true;
  };
  const anchor = state.buildings.find(b => b.kind === "market") ?? state.buildings.find(b => b.kind === "keep") ?? state.buildings[0];
  if (anchor === undefined) return null;
  // The market's side of the wall: the cells reachable from it within the search box without crossing a wall edge.
  const inside = new Set<number>([anchor.ty * state.width + anchor.tx]);
  for (const queue = [{ tx: anchor.tx, ty: anchor.ty }]; queue.length > 0;) {
    const at = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { tx: at.tx + dx, ty: at.ty + dy };
      if (Math.abs(next.tx - anchor.tx) > 11 || Math.abs(next.ty - anchor.ty) > 11 || next.tx < 0 || next.ty < 0 || next.tx >= state.width || next.ty >= state.height) continue;
      const key = next.ty * state.width + next.tx;
      if (inside.has(key) || !canTraverseWallBoundary(state, at, next)) continue;
      inside.add(key); queue.push(next);
    }
  }
  const cands: { tx: number; ty: number; key: number }[] = [];
  for (let r = 1; r <= 8 && cands.length < 4; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
      const tx = anchor.tx + dx; const ty = anchor.ty + dy;
      if (free3x2(tx, ty)) cands.push({ tx, ty, key: hashI(state.seed, tx * 31, ty * 17) });
    }
  }
  if (cands.length === 0) return null;
  cands.sort((a, b) => a.key - b.key);
  return cands[0] ?? null;
}

/** Draws the guildhall body + active overlay at the prop tile. */
export function drawReorgPropAt(ctx: CanvasRenderingContext2D, prop: ReorgProp): void {
  // UI-9: guildhall pivot = SW front-left of 3×2 footprint → tileToScreen(tx, ty+2).
  const foot = tileToScreen(prop.tx, prop.ty + 2);
  guildhallArt.draw(ctx, "guildhall_body", foot.sx, foot.sy, GUILDHALL_SCALE);
  guildhallArt.draw(ctx, "guildhall_active", foot.sx, foot.sy, GUILDHALL_SCALE);
}

/** The guildhall world prop (null: no guild yet). Cached by buildings identity. */
export function reorgProp(state: GameState): ReorgProp | null {
  if (guildOf(state) === null) return null;
  const spot = guildhallSpot(state);
  if (spot === null) return null;
  // NAT-1: sorted by its front corner like a building (it was its back corner, so what stood just behind drew over it).
  return { kind: "guildhall", tx: spot.tx, ty: spot.ty, depth: depthKey(spot.tx + GUILDHALL_FOOTPRINT.width - 1, spot.ty + GUILDHALL_FOOTPRINT.height - 1), id: `reorg:guildhall:${spot.tx}:${spot.ty}` };
}

// Object-queue merge (mirrors withPlagueProps in renderObjectFrameCache.ts).
type ReorgPropItem = { readonly kind: "reorg_prop"; readonly id: string; readonly prop: ReorgProp; readonly depth: number; readonly anchorTx: number };
let lastReorgMerge: { readonly queue: readonly RenderQueueItem[]; readonly prop: ReorgProp | null; readonly range: string; readonly result: readonly RenderQueueItem[] } | null = null;

/** Merges the guildhall prop into the sorted render queue. Called from renderObjectFrameCache.ts (+1 line). */
export function withReorgProps(queue: readonly RenderQueueItem[], state: GameState, range: TileRange): readonly RenderQueueItem[] {
  const prop = reorgProp(state);
  const rangeStr = `${range.minTx},${range.minTy},${range.maxTx},${range.maxTy}`;
  if (lastReorgMerge !== null && lastReorgMerge.queue === queue && lastReorgMerge.prop === prop && lastReorgMerge.range === rangeStr) return lastReorgMerge.result;
  if (prop === null || !tileIsVisibleInRange(prop.tx, prop.ty, range)) { lastReorgMerge = { queue, prop, range: rangeStr, result: queue }; return queue; }
  const item: ReorgPropItem = { kind: "reorg_prop" as const, id: prop.id, prop, depth: prop.depth, anchorTx: prop.tx };
  const result = mergeOne(queue, item);
  lastReorgMerge = { queue, prop, range: rangeStr, result };
  return result;
}

function mergeOne(queue: readonly RenderQueueItem[], item: ReorgPropItem): readonly RenderQueueItem[] {
  const out: RenderQueueItem[] = [];
  let inserted = false;
  for (const q of queue) {
    if (!inserted && (q.depth > item.depth || (q.depth === item.depth && q.id > item.id))) { out.push(item); inserted = true; }
    out.push(q);
  }
  if (!inserted) out.push(item);
  return out;
}

// ─── Walker overlays (drawn after the object pass from wetSummer.ts) ─────────

const DIR_COL = { NE: 0, SE: 1, SW: 2, NW: 3 } as const;
type Dir = keyof typeof DIR_COL;

function walkerCell(ctx: CanvasRenderingContext2D, key: Wave9Key, dir: Dir, gait: number, sx: number, sy: number): void {
  const img = wave9Art(key); const meta = wave9Meta(key);
  if (img === null || !("frames" in meta)) return;
  const sc = storyWalkerScale(key as Parameters<typeof storyWalkerScale>[0]);
  const { width, height } = meta.frames;
  drawCroppedWorldSprite(ctx, img, { x: DIR_COL[dir] * width, y: (gait % 2) * height, width, height },
    { x: sx - meta.pivot.x * sc, y: sy - meta.pivot.y * sc, width: width * sc, height: height * sc }, false, true);
}

const buildingDoor = (b: Building) => { const fp = buildingFootprint(b); return tileToScreen(b.tx + fp.width / 2 - 0.5, b.ty + fp.height + 0.1); };

/** UI-9: textile walkers and collector chase — drawn after the object pass (the alehouse crowd: alehouseCrowd.ts). */
export function drawReorgOverlays(ctx: CanvasRenderingContext2D, state: GameState, nowMs: number): void {
  const reorg = state.reorganisation;
  if (reorg === undefined) return;
  drawTextileWalkers(ctx, state, reorg, nowMs);
  drawCollectorChase(ctx, state, reorg, nowMs);
}

// 1. Textile street: two walkers moving between the first two weaver houses on a 14-second loop.
const TEXTILE_LOOP_MS = 14_000;
function drawTextileWalkers(ctx: CanvasRenderingContext2D, state: GameState, reorg: GameState["reorganisation"] & object, nowMs: number): void {
  if (reorg.textileStreetTick === undefined) return;
  const weavers = state.buildings.filter(b => b.kind === "weaver_house").sort((a, b) => a.id.localeCompare(b.id));
  if (weavers.length < 2) return;
  const from = buildingDoor(weavers[0]!); const to = buildingDoor(weavers[1]!);
  const t = (nowMs % TEXTILE_LOOP_MS) / TEXTILE_LOOP_MS;
  const fwd = t < 0.5;
  const p = fwd ? t * 2 : (1 - t) * 2;
  const sx = from.sx + (to.sx - from.sx) * (fwd ? p : 1 - p);
  const sy = from.sy + (to.sy - from.sy) * (fwd ? p : 1 - p);
  const dx = to.sx - from.sx; const dy = to.sy - from.sy;
  const dir: Dir = dx >= 0 ? (dy >= 0 ? "SE" : "NE") : (dy >= 0 ? "SW" : "NW");
  const gait = Math.floor(nowMs / GAIT_MS);
  walkerCell(ctx, "wk_petitioner_m", fwd ? dir : (DIR_COL[dir] <= 1 ? "SW" : "NE") as Dir, gait, sx, sy);
  walkerCell(ctx, "wk_petitioner_f", fwd ? dir : (DIR_COL[dir] <= 1 ? "SW" : "NE") as Dir, gait + 1, sx + 10, sy + 4);
}

// 2. Alehouse crowd (RG-1 the alehouses' boom): NAT-2 moved it into the object pass, at the ale barrels (alehouseCrowd.ts).

// 3. Collector chase (RG-8, chased): for a season after the rumour, the lord's collector hurries from the market to the
// keep with the townsfolk a few steps behind him — nobody armed, nobody hurt. UI-9b: the collector is Wave 17's
// wk_tax_collector (collectorWalker.ts; UI-9 had the Wave 9 royal messenger stand in); the followers are the petitioners.
const CHASE_LOOP_MS = 9_000;
const CHASERS: readonly { readonly key: Wave9Key | "wk_tax_collector"; readonly lag: number; readonly side: number }[] = [
  { key: "wk_tax_collector", lag: 0, side: 0 }, { key: "wk_petitioner_m", lag: 0.16, side: -8 },
  { key: "wk_petitioner_f", lag: 0.2, side: 8 }, { key: "wk_petitioner_m", lag: 0.26, side: 2 },
];
function drawCollectorChase(ctx: CanvasRenderingContext2D, state: GameState, reorg: GameState["reorganisation"] & object, nowMs: number): void {
  const rebellion = reorg.rebellion;
  if (rebellion === undefined || rebellion.outcome !== "chased") return;
  if (state.tick - rebellion.tick >= SEASON_TICKS) return;
  const market = state.buildings.find(b => b.kind === "market");
  const keep = state.buildings.find(b => b.kind === "keep") ?? state.buildings.find(b => b.kind === "church");
  if (market === undefined || keep === undefined) return;
  const from = buildingDoor(market); const to = buildingDoor(keep);
  const dx = to.sx - from.sx; const dy = to.sy - from.sy;
  const dir: Dir = dx >= 0 ? (dy >= 0 ? "SE" : "NE") : (dy >= 0 ? "SW" : "NW");
  const run = (nowMs % CHASE_LOOP_MS) / CHASE_LOOP_MS;
  const gait = Math.floor(nowMs / (GAIT_MS * 0.7)); // hurrying
  for (const [index, chaser] of CHASERS.entries()) {
    const t = run - chaser.lag;
    if (t < 0 || t > 1) continue;
    const x = from.sx + dx * t + chaser.side; const y = from.sy + dy * t + chaser.side * 0.5;
    if (chaser.key === "wk_tax_collector") drawCollector(ctx, dir, gait + index, x, y);
    else walkerCell(ctx, chaser.key, dir, gait + index, x, y);
  }
}
