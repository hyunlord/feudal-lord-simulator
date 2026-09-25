import type { GameState } from "../engine/engine.types";
import type { Walker } from "../agents/walker.types";
import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import { assetUrlForBase } from "./worldAssets";
import { createTintCanvas, drawCroppedWorldSprite } from "./worldSprite";
import type { WalkerPresentation, WalkerPresentationDirection } from "./walkerPresentation";
import { walkerCloakManifest, walkerPropManifest } from "./walkerSheetManifest.generated";
import { walkerCloak, walkerHeldProp, walkerLooks, walkerSheet, type WalkerLook, type WalkerPropKind, type WalkerSheetId } from "./walkerLook";

// V2 walker composer (spec docs/design/walker-composer.md WC-6..WC-8): a look (sheet + held prop + winter cloak) is
// composed once into a canvas of its 8 cells (4 directions x 2 gait frames) and drawn from there every frame.
//  - Cell: the sheet's 74 px cell (legacy 1774x887 sheets read at 296/1774) with PAD px on every side for a prop
//    that reaches past the body. Layer order per cell: back-hand prop, body, cloak, front-hand prop.
//  - Hand: the carrier's right hand in every direction (WC-4): screen left in SE / SW, screen right in NE / NW; it is
//    the near hand (drawn over the body) in SE / NE and the far hand (under the body) in SW / NW. The prop's grip
//    anchor (Wave 5a ledger) lands on the hand anchor (scripts/buildWalkerSheetManifest.py), at PROP_SCALE.
//  - Cache: key = sheet | prop | cloak -> canvas, least recently used first out above CACHE_LIMIT. Each canvas is
//    8 cells of 108 x 108 px x 4 bytes = 373,248 bytes, so CACHE_LIMIT 64 bounds it at 23.9 MB (<= 25 MB, gate 5). Reason:
//    composing a look is 8 cells of 2-4 drawImage calls; drawing from the canvas is one. Composition time is recorded
//    (walkerComposerStats).
//  - Looks: computed from the state (walkerLooks) the first time a walker is drawn and kept for that walker id while
//    it lives (pruned when the walkers array no longer holds it), so a look never flips during a walk.

export const WALKER_CELL = 74;
export const WALKER_PAD = 17;
export const WALKER_COMPOSED_CELL = WALKER_CELL + 2 * WALKER_PAD;
export const PROP_SCALE = 0.65;
export const CACHE_LIMIT = 64;
const DIRECTION_COLUMN: Readonly<Record<WalkerPresentationDirection, number>> = { NE: 0, SE: 1, SW: 2, NW: 3 };

type ImageStatus = "loading" | "ready" | "missing";
type LoadedImage = { status: ImageStatus; image: HTMLImageElement | null };
const images = new Map<string, LoadedImage>();

function imageFor(url: string, width: number | null, height: number | null): HTMLImageElement | null {
  const known = images.get(url);
  if (known !== undefined) return known.status === "ready" ? known.image : null;
  const entry: LoadedImage = { status: "loading", image: null };
  images.set(url, entry);
  if (typeof globalThis.Image !== "function") { entry.status = "missing"; return null; }
  const image = new Image();
  const resolved = assetUrlForBase(url, import.meta.env?.BASE_URL ?? "/");
  image.onload = () => {
    if (width !== null && height !== null && !registerRuntimeAsset(image, resolved, width, height)) { entry.status = "missing"; return; }
    entry.image = image; entry.status = "ready";
  };
  image.onerror = () => { entry.status = "missing"; };
  image.src = resolved;
  return null;
}

type ComposeKey = `${WalkerSheetId}|${WalkerPropKind | "-"}|${"male" | "female" | "-"}`;
/** A composed look: its 8 cells (index column + 4 * gait frame), each an ImageBitmap where OffscreenCanvas can hand one over. */
type Cell = ImageBitmap | OffscreenCanvas | HTMLCanvasElement;
type Composed = readonly Cell[];
const composed = new Map<ComposeKey, Composed>();
const stats = { composed: 0, evicted: 0, composeMsTotal: 0, composeMsMax: 0, firstComposeMs: null as number | null };

/** Draws the composed cells of a key, or returns null while one of its images is still loading. */
function composedCanvas(sheetId: WalkerSheetId, prop: WalkerPropKind | null, cloak: "male" | "female" | null): Composed | null {
  const key: ComposeKey = `${sheetId}|${prop ?? "-"}|${cloak ?? "-"}`;
  const hit = composed.get(key);
  if (hit !== undefined) { composed.delete(key); composed.set(key, hit); return hit; }
  const sheet = walkerSheet(sheetId);
  const body = imageFor(sheet.url, sheet.width, sheet.height);
  const cloakImage = cloak === null ? null : imageFor(walkerCloakManifest[cloak].url, 296, 148);
  const propImages = prop === null ? null : Object.fromEntries(Object.entries(walkerPropManifest[prop]).map(([direction, entry]) => [direction, imageFor(entry.url, 32, 32)]));
  if (body === null || (cloak !== null && cloakImage === null) || (propImages !== null && Object.values(propImages).some(image => image === null))) return null;
  const started = typeof performance === "undefined" ? 0 : performance.now();
  const canvas = createTintCanvas(4 * WALKER_COMPOSED_CELL, 2 * WALKER_COMPOSED_CELL);
  const context = canvas?.getContext("2d") as CanvasRenderingContext2D | null | undefined;
  if (canvas === null || context === null || context === undefined) return null;
  context.imageSmoothingQuality = "high";
  // Sheet coordinates are the manifest's (legacy: 1774x887); the shipped legacy PNGs are downscaled derivatives, which
  // registerRuntimeAsset maps (drawCroppedWorldSprite crops through that registry).
  const sheetCellWidth = sheet.width / 4; const sheetCellHeight = sheet.height / 2;
  for (const frame of sheet.frames) {
    const column = DIRECTION_COLUMN[frame.direction]; const row = frame.gaitFrame;
    const originX = column * WALKER_COMPOSED_CELL + WALKER_PAD; const originY = row * WALKER_COMPOSED_CELL + WALKER_PAD;
    const near = frame.direction === "SE" || frame.direction === "NE";
    const drawProp = () => {
      if (prop === null || propImages === null) return;
      const entry = walkerPropManifest[prop][frame.direction];
      const hand = rightHand(frame);
      const image = propImages[frame.direction]!;
      const size = 32 * PROP_SCALE;
      drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: 32, height: 32 },
        { x: originX + hand.x - entry.anchor.x * PROP_SCALE, y: originY + hand.y - entry.anchor.y * PROP_SCALE, width: size, height: size }, false, true);
    };
    if (!near) drawProp();
    const cellBox = { x: originX, y: originY, width: WALKER_CELL, height: WALKER_CELL };
    drawCroppedWorldSprite(context, body, { x: column * sheetCellWidth, y: row * sheetCellHeight, width: sheetCellWidth, height: sheetCellHeight }, cellBox, false, true);
    if (cloakImage !== null) drawCroppedWorldSprite(context, cloakImage, { x: column * WALKER_CELL, y: row * WALKER_CELL, width: WALKER_CELL, height: WALKER_CELL }, cellBox, false, true);
    if (near) drawProp();
  }
  // One small image per cell: a draw reads only its own cell. Drawing a sub-rectangle of one 432x216 look image read
  // the whole image each time (walkers stage 0.12 -> 0.6 ms for 21 walkers on lots24, measured on both an
  // OffscreenCanvas and an ImageBitmap of it).
  const cells: Cell[] = [];
  for (let row = 0; row < 2; row += 1) for (let column = 0; column < 4; column += 1) {
    const cell = createTintCanvas(WALKER_COMPOSED_CELL, WALKER_COMPOSED_CELL);
    const cellContext = cell?.getContext("2d") as CanvasRenderingContext2D | null | undefined;
    if (cell === null || cellContext === null || cellContext === undefined) return null;
    drawCroppedWorldSprite(cellContext, canvas, { x: column * WALKER_COMPOSED_CELL, y: row * WALKER_COMPOSED_CELL, width: WALKER_COMPOSED_CELL, height: WALKER_COMPOSED_CELL },
      { x: 0, y: 0, width: WALKER_COMPOSED_CELL, height: WALKER_COMPOSED_CELL }, false, false);
    cells[column + 4 * row] = "transferToImageBitmap" in cell ? cell.transferToImageBitmap() : cell;
  }
  const stored: Composed = cells;
  const elapsed = typeof performance === "undefined" ? 0 : performance.now() - started;
  stats.composed += 1; stats.composeMsTotal += elapsed; stats.composeMsMax = Math.max(stats.composeMsMax, elapsed);
  stats.firstComposeMs ??= elapsed;
  composed.set(key, stored);
  while (composed.size > CACHE_LIMIT) {
    const oldest = composed.keys().next().value as ComposeKey;
    for (const cell of composed.get(oldest) ?? []) if ("close" in cell) cell.close();
    composed.delete(oldest); stats.evicted += 1;
  }
  return stored;
}

type SheetFrame = ReturnType<typeof walkerSheet>["frames"][number];
/** WC-4: the carrier's right hand: screen left when facing the viewer's side (SE, SW), screen right when facing away. */
export function rightHand(frame: Pick<SheetFrame, "direction" | "hands">): { readonly x: number; readonly y: number } {
  return frame.direction === "SE" || frame.direction === "SW" ? frame.hands.left : frame.hands.right;
}

let lastWalkers: readonly Walker[] | null = null;
const lookCache = new Map<string, WalkerLook>();
function lookOf(state: GameState, walker: Walker): WalkerLook {
  if (lastWalkers !== state.walkers) {
    lastWalkers = state.walkers;
    if (lookCache.size > state.walkers.length) {
      const alive = new Set(state.walkers.map(candidate => candidate.id));
      for (const id of lookCache.keys()) if (!alive.has(id)) lookCache.delete(id);
    }
  }
  const cached = lookCache.get(walker.id);
  if (cached !== undefined) return cached;
  for (const [id, look] of walkerLooks(state)) if (!lookCache.has(id)) lookCache.set(id, look);
  return lookCache.get(walker.id)!;
}

/** The look, prop and cloak a walker is drawn with this frame (also the evidence scripts' read-out). */
export function walkerAppearance(state: GameState, walker: Walker) {
  const look = lookOf(state, walker);
  return { look, prop: walkerHeldProp(look, walker), cloak: walkerCloak(state, look) };
}

/** Whether the walker's composed look can be drawn now (composes it on first call once its images are loaded). */
export function composedWalkerReady(state: GameState, walker: Walker): boolean {
  const { look, prop, cloak } = walkerAppearance(state, walker);
  return composedCanvas(look.sheetId, prop, cloak) !== null;
}

/**
 * Draws a walker from its composed look at the foot point, the figure 32 * scale high like the legacy actors.
 * Returns false while the look's images load (the caller falls back to the legacy actor).
 */
export function drawComposedWalker(context: CanvasRenderingContext2D, state: GameState, walker: Walker, presentation: WalkerPresentation,
  footX: number, footY: number, scale: number): boolean {
  const { look, prop, cloak } = walkerAppearance(state, walker);
  const canvas = composedCanvas(look.sheetId, prop, cloak);
  if (canvas === null) return false;
  const frame = walkerSheet(look.sheetId).frames.find(candidate => candidate.direction === presentation.direction && candidate.gaitFrame === presentation.gaitFrame);
  if (frame === undefined) return false;
  const factor = 32 * scale / frame.figureHeight;
  const cell = canvas[DIRECTION_COLUMN[presentation.direction] + 4 * presentation.gaitFrame];
  if (cell === undefined) return false;
  drawCroppedWorldSprite(context, cell, { x: 0, y: 0, width: WALKER_COMPOSED_CELL, height: WALKER_COMPOSED_CELL }, {
    x: footX - (WALKER_PAD + frame.foot.x) * factor, y: footY - (WALKER_PAD + frame.foot.y) * factor,
    width: WALKER_COMPOSED_CELL * factor, height: WALKER_COMPOSED_CELL * factor }, false, true);
  return true;
}

export function walkerComposerStats() {
  const bytesPerCanvas = 4 * WALKER_COMPOSED_CELL * 2 * WALKER_COMPOSED_CELL * 4;
  return { ...stats, cached: composed.size, cacheLimit: CACHE_LIMIT, bytesPerCanvas, cacheBytes: composed.size * bytesPerCanvas,
    cacheBytesLimit: CACHE_LIMIT * bytesPerCanvas, looks: lookCache.size, keys: [...composed.keys()],
    images: [...images.entries()].map(([url, entry]) => ({ url, status: entry.status })) };
}

/** Evidence: the composed 8 cells of a look (composes it once its images are loaded; null while they load). */
export function composedLookForProof(sheetId: WalkerSheetId, prop: WalkerPropKind | null, cloak: "male" | "female" | null): Composed | null {
  return composedCanvas(sheetId, prop, cloak);
}

/** Evidence: drop composed canvases and looks (a fresh session). */
export function resetWalkerComposerForProof(): void {
  composed.clear(); lookCache.clear(); lastWalkers = null;
  Object.assign(stats, { composed: 0, evicted: 0, composeMsTotal: 0, composeMsMax: 0, firstComposeMs: null });
}
