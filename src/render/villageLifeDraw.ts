import type { GameState } from "../engine/engine.types";
import type { Building } from "../content/buildingConfig";
import { houseBuiltLevel } from "../population/houseCondition";
import { frameBuildingVariant } from "./buildingVariants";
import { shownHouseVariantUrl } from "./wave26HouseArt";
import { renderDetailLevel } from "./buildingVisualState";
import type { CameraState } from "./camera";
import { historicalHouseAssetMeta, historicalHouseReady, historicalHouseSpriteRect } from "./historicalHouseAssets";
import { houseCompoundAssetMeta, houseCompoundAssetStatuses, houseCompoundSpriteRect } from "./houseCompoundAssets";
import { tileToScreen } from "./iso";
import type { RenderQueueItem } from "./objectRenderTypes";
import type { TileRange } from "./renderVisibility";
import { ROOF_SMOKE_ANCHORS } from "./roofSmokeAnchors.generated";
import { TOY_MIN_ZOOM, TOYS, villageLife, type VillageLifeItem, type VillageLifeKind } from "./villageLife";
import { WAVE23_IMAGES } from "./wave23ArtManifest.generated";
import { assetUrlForBase } from "./worldAssets";
import { createTintCanvas, drawCroppedWorldSprite } from "./worldSprite";

// INSTALL-23 ③ village life drawn in the object queue (the model and its rules: villageLife.ts). Every item is one
// sprite blit; which zooms draw what: `villageLifeDrawnAt`. Walkers pace and flying birds cross the view by presentation
// time (`nowMs`), so nothing here is stored.

type Sheet = { readonly columns: number; readonly rows: number; readonly cellWidth: number; readonly cellHeight: number };
type Raster = { readonly image: CanvasImageSource; readonly cellWidth: number; readonly cellHeight: number };
type Entry = { status: "loading" | "ready" | "missing"; raster: Raster | null };

/**
 * Cache: one downscaled raster per art, keyed on the art key (built once when its image loads; about 20 small canvases).
 * Reason: the pictures are 48–136 px cells drawn 3–20 px wide at zoom 1 (displayScale 0.04–0.17, × 1.6 for the small
 * animals); a blit straight from the picture shrinks it 7–25× with plain bilinear filtering, which drops pixels and
 * shimmers as the camera moves. The raster holds each cell at RASTER_OVERSAMPLE × its zoom 1 size from one high-quality
 * downscale (enough for zoom 1.35 × DPR 2 without upscaling blur). Measured (scripts/villageLifeCaptures.ts
 * `blitBenchmark`, headless Chrome --disable-gpu on a Mac, 2 000 blits of the cat drawn 11.3 px wide, median of 7):
 * 3.9 ms from the picture, 3.4 ms from the raster (captures.json; an earlier run 4.1 / 3.5) — the cost is about the same (village life is at most ~35 blits a
 * view); the cache is for the picture's quality.
 */
const RASTER_OVERSAMPLE = 3;
const entries = new Map<VillageLifeKind, Entry>();

function sheetOf(kind: VillageLifeKind): Sheet {
  const meta = WAVE23_IMAGES[kind];
  const frames = "frames" in meta ? meta.frames : undefined;
  return frames !== undefined && "columns" in frames
    ? { columns: frames.columns, rows: frames.rows, cellWidth: frames.cellWidth, cellHeight: frames.cellHeight }
    : { columns: 1, rows: 1, cellWidth: meta.width, cellHeight: meta.height };
}

function rasterize(image: HTMLImageElement, kind: VillageLifeKind, scale: number): Raster | null {
  const sheet = sheetOf(kind);
  const cellWidth = Math.max(1, Math.ceil(sheet.cellWidth * scale * RASTER_OVERSAMPLE));
  const cellHeight = Math.max(1, Math.ceil(sheet.cellHeight * scale * RASTER_OVERSAMPLE));
  const canvas = createTintCanvas(cellWidth * sheet.columns, cellHeight * sheet.rows);
  const context = canvas?.getContext("2d") as CanvasRenderingContext2D | null | undefined;
  if (canvas === null || context === null || context === undefined) return null;
  context.imageSmoothingQuality = "high";
  for (let row = 0; row < sheet.rows; row += 1) for (let column = 0; column < sheet.columns; column += 1) {
    drawCroppedWorldSprite(context, image, { x: column * sheet.cellWidth, y: row * sheet.cellHeight, width: sheet.cellWidth, height: sheet.cellHeight },
      { x: column * cellWidth, y: row * cellHeight, width: cellWidth, height: cellHeight }, false, true);
  }
  return { image: canvas, cellWidth, cellHeight };
}

/** The art's raster, loading it on first use (null until ready; always null in Node, which has no Image). */
function lifeArt(kind: VillageLifeKind, scale: number): Raster | null {
  if (typeof Image !== "function") return null;
  let entry = entries.get(kind);
  if (entry === undefined) {
    const created: Entry = { status: "loading", raster: null };
    const image = new Image();
    image.onload = () => {
      try { created.raster = rasterize(image, kind, scale); } catch (error) { if (!(error instanceof Error)) throw error; created.raster = null; }
      created.status = created.raster === null ? "missing" : "ready";
    };
    image.onerror = () => { created.status = "missing"; };
    image.src = assetUrlForBase(WAVE23_IMAGES[kind].url, import.meta.env?.BASE_URL ?? "/");
    entries.set(kind, created);
    entry = created;
  }
  return entry.status === "ready" ? entry.raster : null;
}

/** Loading state of the village life art (captures wait for it). */
export function villageLifeArtStatuses(): Readonly<Record<string, string>> {
  return Object.fromEntries([...entries].map(([kind, entry]) => [kind, entry.status]));
}

function blit(context: CanvasRenderingContext2D, entry: VillageLifeItem, sx: number, sy: number, column: number, row: number): boolean {
  const raster = lifeArt(entry.kind, entry.scale);
  if (raster === null) return false;
  const meta = WAVE23_IMAGES[entry.kind];
  const sheet = sheetOf(entry.kind);
  drawCroppedWorldSprite(context, raster.image, { x: column * raster.cellWidth, y: row * raster.cellHeight, width: raster.cellWidth, height: raster.cellHeight },
    { x: sx - meta.pivot.x * entry.scale, y: sy - meta.pivot.y * entry.scale, width: sheet.cellWidth * entry.scale, height: sheet.cellHeight * entry.scale }, false, true);
  return true;
}

/** Pacing walkers: out HALF_PACE tiles and back along their axis over the cycle, a pause at each end. */
const HALF_PACE = 0.22;
const STEP_MS = 200;
function pace(entry: VillageLifeItem, nowMs: number): { dx: number; dy: number; column: number; row: number } {
  const period = entry.species === "dog" ? 9_000 : 7_000;
  const t = (((nowMs + entry.phase % period) % period) + period) % period / period;
  const moving = t < 0.35 || (t >= 0.5 && t < 0.85);
  const along = t < 0.35 ? -HALF_PACE + 2 * HALF_PACE * t / 0.35 : t < 0.5 ? HALF_PACE : t < 0.85 ? HALF_PACE - 2 * HALF_PACE * (t - 0.5) / 0.35 : -HALF_PACE;
  const forward = t < 0.5;
  // Sheet columns NE, SE, SW, NW: +x runs south-east, +y south-west on screen.
  const column = entry.axis === "y" ? (forward ? 2 : 0) : (forward ? 1 : 3);
  const row = moving ? Math.floor(nowMs / STEP_MS) % 2 : 0;
  return entry.axis === "y" ? { dx: 0, dy: along, column, row } : { dx: along, dy: 0, column, row };
}

/** Flying birds cross the view south-westward (the sheets' direction) once every FLIGHT_PERIOD_MS, each lane its own
 * phase; the entry point on the top or right edge changes every crossing (hash of the lane and the crossing). */
const FLIGHT_PERIOD_MS = 30_000;
const FLIGHT_SPEED = { crow: 110, sparrow: 140 } as const; // world px per second
const FLAP_MS = { crow: 120, sparrow: 90 } as const;
function flight(entry: VillageLifeItem, nowMs: number, camera: CameraState, viewport: { readonly width: number; readonly height: number }) {
  const left = -camera.panX / camera.zoom; const top = -camera.panY / camera.zoom;
  const width = viewport.width / camera.zoom; const height = viewport.height / camera.zoom;
  const clock = nowMs + (entry.phase % FLIGHT_PERIOD_MS);
  const crossing = Math.floor(clock / FLIGHT_PERIOD_MS);
  const seconds = (clock - crossing * FLIGHT_PERIOD_MS) / 1_000;
  let h = (Math.imul(crossing + 1, 0x9e3779b1) ^ entry.phase) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  const u = ((h ^ (h >>> 13)) >>> 0) % 1_000 / 1_000;
  const margin = 24;
  const start = u < 0.6 ? { x: left + width * (0.3 + 0.7 * u / 0.6), y: top - margin } : { x: left + width + margin, y: top + height * 0.7 * (u - 0.6) / 0.4 };
  const kind = entry.species === "sparrow" ? "sparrow" : "crow";
  const distance = FLIGHT_SPEED[kind] * seconds;
  const x = start.x - distance * 2 / Math.sqrt(5); const y = start.y + distance / Math.sqrt(5);
  if (x < left - margin * 2 || y > top + height + margin * 2) return null;
  return { x, y, frame: Math.floor(nowMs / FLAP_MS[kind]) % 4 };
}

/** The ridge point of the house art (the roof smoke's anchor, roofSmokeAnchors.py), or null when that art is not drawn. */
function ridge(state: Pick<GameState, "houses" | "buildings">, buildingId: string): { x: number; y: number } | null {
  const building: Building | undefined = state.buildings.find(candidate => candidate.id === buildingId);
  const house = state.houses.find(candidate => candidate.buildingId === buildingId);
  if (building === undefined || house === undefined) return null;
  const level = houseBuiltLevel(house);
  const pair = building.houseLot !== undefined;
  const meta = pair ? houseCompoundAssetMeta(building, level) : historicalHouseAssetMeta(level);
  if (meta === null) return null;
  const ready = pair ? houseCompoundAssetStatuses().some(entry => entry.level === level && entry.axis === building.houseLot && entry.status === "ready") : historicalHouseReady(level);
  if (!ready) return null;
  const rect = pair ? houseCompoundSpriteRect(building, meta as NonNullable<ReturnType<typeof houseCompoundAssetMeta>>)
    : historicalHouseSpriteRect(building, meta as NonNullable<ReturnType<typeof historicalHouseAssetMeta>>);
  const url = shownHouseVariantUrl(building, level) ?? frameBuildingVariant(building)?.url ?? meta.url;
  const anchor = ROOF_SMOKE_ANCHORS[url] ?? ROOF_SMOKE_ANCHORS[meta.url];
  return anchor === undefined ? null : { x: rect.x + anchor.fx * rect.width, y: rect.y + anchor.fy * rect.height };
}

/**
 * Which items a zoom draws: everything at full detail (zoom > 0.7), where the houses and people are painted art; at
 * simplified detail (0.5 < zoom <= 0.7, block houses) only the washing lines and the flying birds, whose silhouettes
 * still read there (Astra's proof 02-life: at 0.6 the small animals and toys are not identifiable, the line is); none at
 * block detail. The toys only from TOY_MIN_ZOOM (INSTALL-23b: under it they are a speck).
 */
export function villageLifeDrawnAt(entry: Pick<VillageLifeItem, "kind" | "motion">, zoom: number): boolean {
  if (TOYS.has(entry.kind) && zoom < TOY_MIN_ZOOM) return false;
  const detail = renderDetailLevel(zoom);
  return detail === "full" || (detail === "simplified" && (entry.motion === "flight" || entry.kind === "clothesline_a" || entry.kind === "clothesline_b"));
}

export type VillageLifeDrawInput = { readonly state: GameState; readonly zoom: number; readonly nowMs: number; readonly camera: CameraState;
  readonly viewport: { readonly width: number; readonly height: number } };

/** Draws one village life item (false when it is not drawn: block detail, art loading, bird off the view). */
export function drawVillageLifeItem(context: CanvasRenderingContext2D, entry: VillageLifeItem, input: VillageLifeDrawInput): boolean {
  if (!villageLifeDrawnAt(entry, input.zoom)) return false;
  if (entry.motion === "flight") {
    const at = flight(entry, input.nowMs, input.camera, input.viewport);
    return at !== null && blit(context, entry, at.x, at.y, at.frame, 0);
  }
  if (entry.motion === "perch") {
    if (entry.buildingId === null) return false;
    const at = ridge(input.state, entry.buildingId);
    // Off the ridge line by the phase, so two pigeons in view do not sit on the same spot of their roofs.
    return at !== null && blit(context, entry, at.x + ((entry.phase % 5) - 2) * 1.5, at.y + 1, 0, 0);
  }
  if (entry.motion === "walk") {
    const step = pace(entry, input.nowMs);
    const foot = tileToScreen(entry.x + step.dx, entry.y + step.dy);
    return blit(context, entry, foot.sx, foot.sy, step.column, step.row);
  }
  const foot = tileToScreen(entry.x, entry.y);
  return blit(context, entry, foot.sx, foot.sy, 0, 0);
}

// Cache: the last merge, keyed on the incoming queue and the village life list (the same array while the town and the
// range are unchanged, villageLife.ts); an unchanged frame returns the same queue (no sort, no merge).
let lastMerge: { readonly queue: readonly RenderQueueItem[]; readonly items: readonly VillageLifeItem[]; readonly result: readonly RenderQueueItem[] } | null = null;

/** The object queue with the view's village life merged in by depth (as the farm and war props join it). */
export function withVillageLife(queue: readonly RenderQueueItem[], input: { readonly state: GameState; readonly range: TileRange }): readonly RenderQueueItem[] {
  const items = villageLife(input.state, { range: input.range });
  if (items.length === 0) return queue;
  if (lastMerge !== null && lastMerge.queue === queue && lastMerge.items === items) return lastMerge.result;
  const life = items.map(entry => ({ kind: "village_life" as const, id: entry.id, life: entry, depth: entry.depth, anchorTx: entry.anchorTx })).sort(compare);
  const result: RenderQueueItem[] = [];
  let left = 0; let right = 0;
  while (left < queue.length || right < life.length) {
    const a = queue[left]; const b = life[right];
    if (b === undefined || (a !== undefined && compare(a, b) <= 0)) { if (a !== undefined) result.push(a); left += 1; } else { result.push(b); right += 1; }
  }
  lastMerge = { queue, items, result };
  return result;
}

function compare(left: RenderQueueItem, right: RenderQueueItem): number {
  return left.depth - right.depth || left.anchorTx - right.anchorTx || left.id.localeCompare(right.id);
}
