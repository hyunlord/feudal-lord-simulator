import type { GameState } from "../engine/engine.types";
import { kitWorker } from "./constructionKits";
import { aleWorkerSheet } from "./aleWorldArt";
import { clothWorkerSheet } from "./clothWorkerSheet";
import type { Walker } from "../agents/walker.types";
import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import { assetUrlForBase } from "./worldAssets";
import { canvasBudget, type BudgetOwner } from "./canvasBudget";
import { createTintCanvas, drawCroppedWorldSprite } from "./worldSprite";
import type { WalkerPresentation, WalkerPresentationDirection } from "./walkerPresentation";
import { walkerCloakManifest, walkerPropManifest } from "./walkerSheetManifest.generated";
import { stateCalendar } from "../engine/scenarioState";
import { walkerCloak, walkerHeldProp, walkerLooks, walkerSheet, type WalkerCloakKind, type WalkerLook, type WalkerPropKind, type WalkerSheetId } from "./walkerLook";
import { constructionStageIndex, constructionWorkProgress } from "./constructionVisibility";

// V2 walker composer (spec docs/design/walker-composer.md WC-6..WC-8): a look (sheet + held prop + winter cloak) is
// composed into one small canvas per cell (4 directions x 2 gait frames) and drawn from there every frame.
//  - Cell: the sheet's 74 px cell (legacy 1774x887 sheets read at 296/1774) with PAD px on every side for a prop
//    that reaches past the body. Layer order per cell: back-hand prop, body, cloak, front-hand prop.
//  - Hand: the carrier's right hand in every direction (WC-4): screen left in SE / SW, screen right in NE / NW; it is
//    the near hand (drawn over the body) in SE / NE and the far hand (under the body) in SW / NW. The prop's grip
//    anchor (Wave 5a ledger) lands on the hand anchor (scripts/buildWalkerSheetManifest.py), at PROP_SCALE.
//  - Cache (SMOOTH-2R): key = sheet | prop | cloak | direction + gait frame -> one 108 x 108 canvas (46,656 bytes),
//    composed the first time a walker shows that look in that frame; no count limit — as many cells as the looks on
//    the map show (the biggest town: 81–113 looks) — and the bytes are the canvas budget's (canvasBudget.ts), which
//    pushes out cells not drawn lately. Reason: composing a cell is 2-4 drawImage calls; drawing from it is one.
//    Composition time is recorded (walkerComposerStats).
//  - Looks: computed from the state (walkerLooks) the first time a walker is drawn and kept for that walker id while
//    it lives (pruned when the walkers array no longer holds it), so a look never flips during a walk.

/** A villager's world scale; the composer draws each figure 32 × this tall (17.6 px at zoom 1). */
export const VILLAGER_WORLD_SCALE = 0.55;
export const WALKER_FIGURE_PX = 32 * VILLAGER_WORLD_SCALE;
export const WALKER_CELL = 74;
export const WALKER_PAD = 17;
export const WALKER_COMPOSED_CELL = WALKER_CELL + 2 * WALKER_PAD;
export const PROP_SCALE = 0.65;
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

type LookImages = { readonly body: HTMLImageElement; readonly cloak: HTMLImageElement | null; readonly props: Readonly<Record<string, HTMLImageElement>> | null };
/** A look's images, or null while one of them is still loading. */
function lookImages(sheetId: WalkerSheetId, prop: WalkerPropKind | null, cloak: WalkerCloakKind | null): LookImages | null {
  const sheet = walkerSheet(sheetId);
  const body = imageFor(sheet.url, sheet.width, sheet.height);
  const cloakImage = cloak === null ? null : imageFor(walkerCloakManifest[cloak].url, 296, 148);
  // F0-V work tools are one 128 px sheet with a 32 px cell per direction (`cell`, `sheetWidth`).
  const propImages = prop === null ? null : Object.fromEntries(Object.entries(walkerPropManifest[prop]).map(([direction, entry]) =>
    [direction, imageFor(entry.url, "sheetWidth" in entry ? entry.sheetWidth : 32, 32)]));
  if (body === null || (cloak !== null && cloakImage === null) || (propImages !== null && Object.values(propImages).some(image => image === null))) return null;
  return { body, cloak: cloakImage, props: propImages as Record<string, HTMLImageElement> | null };
}

// SMOOTH-2R: one image per look and frame (key = sheet | prop | cloak | direction + gait frame), so every walker of the
// same look shares it, and the cache holds as many as the looks on the map show — no count limit (it was 64 whole looks
// for 81–113 looks in the biggest town: 270 composes and 206 evictions a minute, 4,400 canvases and bitmaps). Its
// bytes are entries of the canvas budget (canvasBudget.ts): a cell not drawn in the last frames may be pushed out, and
// its canvas goes back to the pool for the next cell.
type CellKey = `${WalkerSheetId}|${WalkerPropKind | "-"}|${WalkerCloakKind | "-"}|${WalkerPresentationDirection}${number}`;
type Cell = OffscreenCanvas | HTMLCanvasElement;
const CELL_BYTES = WALKER_COMPOSED_CELL * WALKER_COMPOSED_CELL * 4;
const cells = new Map<CellKey, Cell>();
const madeCells = new WeakSet<object>();
const stats = { composed: 0, evicted: 0, composeMsTotal: 0, composeMsMax: 0, firstComposeMs: null as number | null };
const cellOwner: BudgetOwner = {
  name: "walker-cells",
  evict(key) {
    const cell = cells.get(key as CellKey);
    cells.delete(key as CellKey); stats.evicted += 1;
    if (cell !== undefined) { cell.width = 0; cell.height = 0; }
  },
};

/** The composed cell of a look in one direction and gait frame, or null while the look's images load. */
function composedCell(sheetId: WalkerSheetId, prop: WalkerPropKind | null, cloak: WalkerCloakKind | null,
  direction: WalkerPresentationDirection, gaitFrame: number): Cell | null {
  const key: CellKey = `${sheetId}|${prop ?? "-"}|${cloak ?? "-"}|${direction}${gaitFrame}`;
  const hit = cells.get(key);
  if (hit !== undefined) { canvasBudget.touch(cellOwner, key, "onscreen"); return hit; }
  const images = lookImages(sheetId, prop, cloak);
  const sheet = walkerSheet(sheetId);
  const frame = sheet.frames.find(candidate => candidate.direction === direction && candidate.gaitFrame === gaitFrame);
  if (images === null || frame === undefined) return null;
  const started = typeof performance === "undefined" ? 0 : performance.now();
  const cell = canvasBudget.take(WALKER_COMPOSED_CELL, WALKER_COMPOSED_CELL, (canvas): canvas is Cell => madeCells.has(canvas))
    ?? createTintCanvas(WALKER_COMPOSED_CELL, WALKER_COMPOSED_CELL);
  const context = cell?.getContext("2d") as CanvasRenderingContext2D | null | undefined;
  if (cell === null || context === null || context === undefined) return null;
  madeCells.add(cell);
  context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1;
  context.clearRect(0, 0, WALKER_COMPOSED_CELL, WALKER_COMPOSED_CELL);
  context.imageSmoothingQuality = "high";
  // Sheet coordinates are the manifest's (legacy: 1774x887); the shipped legacy PNGs are downscaled derivatives, which
  // registerRuntimeAsset maps (drawCroppedWorldSprite crops through that registry).
  const sheetCellWidth = sheet.width / 4; const sheetCellHeight = sheet.height / 2;
  const column = DIRECTION_COLUMN[direction]; const row = gaitFrame;
  const near = direction === "SE" || direction === "NE";
  const drawProp = () => {
    if (prop === null || images.props === null) return;
    const entry = walkerPropManifest[prop][direction];
    // INSTALL-7: a Wave 7 work prop carries Astra's attachment point in the 74 px frame and is drawn at its own
    // scale there (shoulder bag, hand basket / bucket / plough, waist purse); the older props go to the right hand.
    const placed = "walkerPoint" in entry;
    const hand = placed ? entry.walkerPoint : rightHand(frame);
    const scale = placed ? 1 : PROP_SCALE;
    const size = 32 * scale;
    drawCroppedWorldSprite(context, images.props[direction]!, { x: ("cell" in entry ? entry.cell : 0) * 32, y: 0, width: 32, height: 32 },
      { x: WALKER_PAD + hand.x - entry.anchor.x * scale, y: WALKER_PAD + hand.y - entry.anchor.y * scale, width: size, height: size }, false, true);
  };
  // Layer order per cell: back-hand prop, body, cloak, front-hand prop.
  if (!near) drawProp();
  const cellBox = { x: WALKER_PAD, y: WALKER_PAD, width: WALKER_CELL, height: WALKER_CELL };
  drawCroppedWorldSprite(context, images.body, { x: column * sheetCellWidth, y: row * sheetCellHeight, width: sheetCellWidth, height: sheetCellHeight }, cellBox, false, true);
  if (images.cloak !== null) drawCroppedWorldSprite(context, images.cloak, { x: column * WALKER_CELL, y: row * WALKER_CELL, width: WALKER_CELL, height: WALKER_CELL }, cellBox, false, true);
  if (near) drawProp();
  const elapsed = typeof performance === "undefined" ? 0 : performance.now() - started;
  stats.composed += 1; stats.composeMsTotal += elapsed; stats.composeMsMax = Math.max(stats.composeMsMax, elapsed);
  stats.firstComposeMs ??= elapsed;
  cells.set(key, cell);
  canvasBudget.track(cellOwner, key, CELL_BYTES, "onscreen");
  return cell;
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
  const stage = builderSiteStage(state, walker);
  // INSTALL-11: a builder at a kit site is its family's worker (carpenter or mason sheet) with the family's tool.
  const site = stage === null ? undefined : state.constructionSites.find(candidate => "siteId" in walker && candidate.id === walker.siteId);
  const worker = site === undefined ? null : kitWorker(site.kind, stage!);
  if (worker !== null) {
    const kitLook = { ...look, sheetId: worker.sheet as typeof look.sheetId };
    return { look: kitLook, prop: worker.tool as ReturnType<typeof walkerHeldProp>, cloak: walkerCloak(state, kitLook) };
  }
  // INSTALL-3: the alewife on her malt errand, the maltster to the kiln and on its carts (their Wave 3 sheets, no cloak).
  const ale = aleWorkerSheet(state, walker);
  if (ale !== null) {
    const aleLook = { ...look, sheetId: ale };
    return { look: aleLook, prop: walkerHeldProp(aleLook, walker, stage, stateCalendar(state)), cloak: walkerCloak(state, aleLook) };
  }
  // UI-9: the cloth chain's workers — shepherd, fuller, wool merchant (their Wave 3 sheets, no cloak).
  const cloth = clothWorkerSheet(state, walker);
  if (cloth !== null) {
    const clothLook = { ...look, sheetId: cloth };
    return { look: clothLook, prop: walkerHeldProp(clothLook, walker, stage, stateCalendar(state)), cloak: walkerCloak(state, clothLook) };
  }
  return { look, prop: walkerHeldProp(look, walker, stage, stateCalendar(state)), cloak: walkerCloak(state, look) };
}

/** Whether the walker's composed look can be drawn now (composes it on first call once its images are loaded). */
export function composedWalkerReady(state: GameState, walker: Walker): boolean {
  const { look, prop, cloak } = walkerAppearance(state, walker);
  return lookImages(look.sheetId, prop, cloak) !== null;
}

/**
 * Draws a walker from its composed look at the foot point, the figure 32 * scale high like the legacy actors.
 * Returns false while the look's images load (the caller falls back to the legacy actor).
 */
export function drawComposedWalker(context: CanvasRenderingContext2D, state: GameState, walker: Walker, presentation: WalkerPresentation,
  footX: number, footY: number, scale: number): boolean {
  const { look, prop, cloak } = walkerAppearance(state, walker);
  const frame = walkerSheet(look.sheetId).frames.find(candidate => candidate.direction === presentation.direction && candidate.gaitFrame === presentation.gaitFrame);
  if (frame === undefined) return false;
  const cell = composedCell(look.sheetId, prop, cloak, presentation.direction, presentation.gaitFrame);
  if (cell === null) return false;
  const factor = 32 * scale / frame.figureHeight;
  drawCroppedWorldSprite(context, cell, { x: 0, y: 0, width: WALKER_COMPOSED_CELL, height: WALKER_COMPOSED_CELL }, {
    x: footX - (WALKER_PAD + frame.foot.x) * factor, y: footY - (WALKER_PAD + frame.foot.y) * factor,
    width: WALKER_COMPOSED_CELL * factor, height: WALKER_COMPOSED_CELL * factor }, false, true);
  return true;
}

export function walkerComposerStats() {
  const looks = new Set([...cells.keys()].map(key => key.slice(0, key.lastIndexOf("|"))));
  return { ...stats, cached: cells.size, cachedLooks: looks.size, bytesPerCell: CELL_BYTES, cacheBytes: cells.size * CELL_BYTES,
    looks: lookCache.size, keys: [...looks], images: [...images.entries()].map(([url, entry]) => ({ url, status: entry.status })) };
}

/** Evidence: the composed 8 cells of a look, NE SE SW NW then the second gait frame (null while its images load). */
export function composedLookForProof(sheetId: WalkerSheetId, prop: WalkerPropKind | null, cloak: WalkerCloakKind | null): readonly Cell[] | null {
  const composed: Cell[] = [];
  for (const gaitFrame of [0, 1]) for (const direction of ["NE", "SE", "SW", "NW"] as const) {
    const cell = composedCell(sheetId, prop, cloak, direction, gaitFrame);
    if (cell === null) return null;
    composed.push(cell);
  }
  return composed;
}

/** Evidence: drop composed cells and looks (a fresh session). */
export function resetWalkerComposerForProof(): void {
  for (const key of cells.keys()) canvasBudget.forget(cellOwner, key);
  cells.clear(); lookCache.clear(); lastWalkers = null;
  Object.assign(stats, { composed: 0, evicted: 0, composeMsTotal: 0, composeMsMax: 0, firstComposeMs: null });
}

/** F0-V: the stage (0 plot .. 3 roof) of the site a builder works on, or null (not a builder, or its site is gone). */
function builderSiteStage(state: Pick<GameState, "constructionSites">, walker: Walker): number | null {
  if (walker.kind !== "builder" || "resident" in walker || !("siteId" in walker)) return null;
  const site = state.constructionSites.find(candidate => candidate.id === walker.siteId);
  return site === undefined ? null : constructionStageIndex(constructionWorkProgress(site));
}
