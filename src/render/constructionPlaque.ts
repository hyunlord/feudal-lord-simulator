import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import { constructionSiteDisplayName, constructionSiteFootprint, type ConstructionSite } from "../economy/construction";
import { isPalisadeConstructionSite, isStoneWallConstructionSite } from "../economy/palisadeConstruction";
import type { GameState } from "../engine/engine.types";
import { scenarioOf } from "../engine/scenarioState";
import { calendarArrivalLabel } from "../ui/calendarArrival";
import { currentConstructionStall } from "../ui/constructionAccessModel";
import { CAUSE_ICON, drawUiIcon, type UiIconCell } from "../ui/uiArt";
import { CONSTRUCTION_PLAQUE_COPY } from "./constructionPlaqueCopy.ko";
import { constructionSiteLabelAnchor } from "./constructionSiteLabelLayout";
import { persistentSignals } from "./signalPersistence";
import {
  constructionBarCells, constructionBlocker, constructionMaterialShare, constructionOwedMaterial, constructionPhase,
  constructionPileLevels, constructionStageIndex, shownConstructionArrival, type ConstructionBlocker,
} from "./constructionVisibility";
import { tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel } from "./style";
import { visibilityArt } from "./visibilityArtManifest";
import { drawCroppedWorldSprite } from "./worldSprite";

// F0-V site plaque (visibility design 2절): one anchor per site, the footprint centre raised by the completed height
// (`constructionSiteLabelAnchor`, UX-0 F), carries, top to bottom, the name, the four-cell stage bar (brown = the
// delivered share in the materials phase, gold = the stage cells in the work phase), the calendar arrival or the owed
// material, and the blocker icon beside the bar. It never moves between stages (the anchor is the completed height).
// Zoom LOD: below 0.8 the bar (and a blocker, one icon with a count for nearby sites of the same cause) only; from
// 0.8 the lines; the name from 1.2 or when blocked.
// Sizes are screen pixels (drawn in world space, divided by the zoom, clamped at 0.5 like the old label).

const BLOCKER_ICON: Readonly<Record<ConstructionBlocker, UiIconCell<"cause">>> = {
  road: CAUSE_ICON.delivery!, materials: "storage", workers: CAUSE_ICON.workers!,
};
const FONT = '12px "Noto Serif KR", Georgia, serif';

type PlaqueBox = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
export type ConstructionPlaque = {
  readonly name: string | null;
  readonly cells: readonly [number, number, number, number];
  readonly phase: "materials" | "work";
  readonly share: number;
  readonly line: string | null;
  readonly blocker: ConstructionBlocker | null;
  /** Zoomed out, nearby sites with the same blocker show one icon: the first in state order carries the group's size,
   * the others 0 (no icon). Closer in, every blocked site carries 1. */
  readonly blockerCount: number;
};

/**
 * R0-1 (S8): a site's blocker shows once it has held for a distribution cycle (signalPersistence); a stall that
 * clears within the round never reaches the plaque. Keyed by site and cause, so a change of cause starts again.
 */
export function shownConstructionBlocker(state: GameState, site: ConstructionSite): ConstructionBlocker | null {
  // Every site's cause is handed over each state (a cleared stall must leave the memory), then this one is read.
  const keys = state.constructionSites.flatMap(other => {
    const cause = constructionBlocker(other, currentConstructionStall(state, other));
    return cause === null ? [] : [`${other.id}:${cause}`];
  });
  const shown = persistentSignals("site_blocker", state, keys);
  const blocker = constructionBlocker(site, currentConstructionStall(state, site));
  return blocker !== null && shown.has(`${site.id}:${blocker}`) ? blocker : null;
}

const GROUP_ZOOM = 0.8;
const GROUP_REACH = 6 * 32; // world px between two sites' anchors (six tiles along a row)

function blockerGroupCount(state: GameState, site: ConstructionSite, blocker: ConstructionBlocker | null, zoom: number): number {
  if (blocker === null) return 0;
  if (zoom >= GROUP_ZOOM) return 1;
  const own = constructionSiteLabelAnchor(site);
  let count = 0;
  for (const other of state.constructionSites) {
    if (isPalisadeConstructionSite(other) || isStoneWallConstructionSite(other)) continue;
    const at = constructionSiteLabelAnchor(other);
    if (Math.hypot(at.x - own.x, at.topY - own.topY) > GROUP_REACH) continue;
    if (shownConstructionBlocker(state, other) !== blocker) continue;
    if (other.id === site.id) { if (count > 0) return 0; } // an earlier near site of the same cause leads
    count += 1;
  }
  return count;
}

/** What the plaque says for a site at this tick (pure but for the arrival memory: shown arrivals only move earlier). */
export function constructionPlaqueModel(state: GameState, site: ConstructionSite, progress: number, zoom: number): ConstructionPlaque {
  const phase = constructionPhase(site);
  const blocker = shownConstructionBlocker(state, site);
  const owed = constructionOwedMaterial(site);
  const arrival = shownConstructionArrival(site, state.tick, new Set(state.constructionSites.map(other => other.id)));
  const line = zoom < 0.8 ? null
    : blocker !== null ? CONSTRUCTION_PLAQUE_COPY.blocker[blocker]
      : phase === "materials" && owed !== null ? CONSTRUCTION_PLAQUE_COPY.owed(owed.resource, owed.delivered, owed.required)
        : arrival !== null ? CONSTRUCTION_PLAQUE_COPY.arrival(calendarArrivalLabel(state.tick, arrival, scenarioOf(state).startYear))
          : null;
  return {
    name: zoom >= 1.2 || blocker !== null ? constructionSiteDisplayName(site) : null,
    cells: constructionBarCells(progress), phase, share: constructionMaterialShare(site), line, blocker,
    blockerCount: blockerGroupCount(state, site, blocker, zoom),
  };
}

function plaqueSize(plaque: ConstructionPlaque, scale: number): { readonly width: number; readonly height: number } {
  const rows = (plaque.name === null ? 0 : 1) + (plaque.line === null ? 0 : 1);
  return { width: 72 * scale, height: (10 + rows * 15) * scale };
}

/** Plaque boxes of every building site up to `site` (state order), stepping up past overlaps (3 rows at most). */
function plaqueBoxThrough(state: GameState, site: ConstructionSite, own: ConstructionPlaque, scale: number): PlaqueBox {
  const placed: PlaqueBox[] = [];
  const boxFor = (other: ConstructionSite, size: { readonly width: number; readonly height: number }): PlaqueBox => {
    const anchor = constructionSiteLabelAnchor(other);
    const at = (row: number): PlaqueBox => ({ x: anchor.x - size.width / 2, y: anchor.topY - 10 * scale - size.height - row * (size.height + 2 * scale), ...size });
    let row = 0;
    while (row < 3 && placed.some(box => overlaps(at(row), box))) row += 1;
    return at(row);
  };
  for (const other of state.constructionSites) {
    if (isPalisadeConstructionSite(other) || isStoneWallConstructionSite(other)) continue;
    if (other.id === site.id) return boxFor(site, plaqueSize(own, scale));
    placed.push(boxFor(other, plaqueSize({ ...own, name: own.name, line: own.line }, scale)));
  }
  return boxFor(site, plaqueSize(own, scale));
}

function overlaps(a: PlaqueBox, b: PlaqueBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function drawConstructionPlaque(context: CanvasRenderingContext2D, state: GameState, site: ConstructionSite, progress: number, zoom: number): void {
  const scale = 1 / Math.max(zoom, 0.5);
  const plaque = constructionPlaqueModel(state, site, progress, zoom);
  const box = plaqueBoxThrough(state, site, plaque, scale);
  const anchor = constructionSiteLabelAnchor(site);
  context.save();
  applyInkOutline(context, zoom);
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x), snapToPixel(box.y + box.height));
  context.lineTo(snapToPixel(anchor.x), snapToPixel(anchor.groundY));
  context.stroke();
  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fillRect(snapToPixel(box.x), snapToPixel(box.y), snapToPixel(box.width), snapToPixel(box.height));
  context.strokeRect(snapToPixel(box.x), snapToPixel(box.y), snapToPixel(box.width), snapToPixel(box.height));
  context.font = FONT.replace("12px", `${12 * scale}px`);
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = PALETTE.ink;
  let y = box.y + 3 * scale;
  if (plaque.name !== null) { context.fillText(plaque.name, box.x + box.width / 2, y + 11 * scale, box.width - 6 * scale); y += 15 * scale; }
  drawBar(context, plaque, box.x + 4 * scale, y + 1 * scale, box.width - 8 * scale, 5 * scale, scale, zoom);
  y += 8 * scale;
  context.fillStyle = PALETTE.ink;
  if (plaque.line !== null) context.fillText(plaque.line, box.x + box.width / 2, y + 12 * scale, box.width - 6 * scale);
  if (plaque.blocker !== null && plaque.blockerCount > 0) {
    // A vellum tab on the plaque's left edge: the cause icon alone is lost against grass and shadow. A group's count
    // sits inside the tab (widened), on vellum like the rest of the plaque.
    const tab = 24 * scale, wide = plaque.blockerCount > 1 ? 16 * scale : 0;
    const tx = box.x - tab - wide + 1 * scale, ty = box.y + (box.height - tab) / 2;
    context.fillStyle = SEMANTIC_PALETTE.vellum;
    context.fillRect(snapToPixel(tx), snapToPixel(ty), snapToPixel(tab + wide), snapToPixel(tab));
    context.strokeRect(snapToPixel(tx), snapToPixel(ty), snapToPixel(tab + wide), snapToPixel(tab));
    drawUiIcon(context, "cause", BLOCKER_ICON[plaque.blocker], tx + tab / 2, ty + tab / 2, 20 * scale);
    context.fillStyle = PALETTE.ink;
    if (wide > 0) context.fillText(CONSTRUCTION_PLAQUE_COPY.blockerCount(plaque.blockerCount), tx + tab + wide / 2 - 1 * scale, ty + tab / 2 + 4 * scale);
  }
  context.restore();
}

function drawBar(context: CanvasRenderingContext2D, plaque: ConstructionPlaque, x: number, y: number, width: number, height: number, scale: number, zoom: number): void {
  const gap = 2 * scale;
  const cell = (width - gap * 3) / 4;
  for (let index = 0; index < 4; index += 1) {
    const cx = x + index * (cell + gap);
    context.fillStyle = SEMANTIC_PALETTE.parchmentDark;
    context.fillRect(snapToPixel(cx), snapToPixel(y), snapToPixel(cell), snapToPixel(height));
    const fill = plaque.phase === "work" ? plaque.cells[index]!
      : Math.max(0, Math.min(1, plaque.share * 4 - index));
    if (fill > 0) {
      context.fillStyle = plaque.phase === "work" ? PALETTE.gold : SEMANTIC_PALETTE.earth;
      context.fillRect(snapToPixel(cx), snapToPixel(y), snapToPixel(cell * fill), snapToPixel(height));
    }
    applyInkOutline(context, zoom);
    context.strokeRect(snapToPixel(cx), snapToPixel(y), snapToPixel(cell), snapToPixel(height));
  }
}

// ---- Piles, sign post, well stages (Wave 6, drawn at half their source size, the records' mount scale) ----

/** Footprint centre on the ground and its screen span (the construction art's width for the footprint). */
function footprintGround(site: ConstructionSite): { readonly x: number; readonly y: number; readonly span: number } {
  const footprint = constructionSiteFootprint(site);
  const center = tileToScreen(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
  return { x: center.sx, y: center.sy, span: (footprint.width + footprint.height) * 27 };
}

function drawGroundSprite(context: CanvasRenderingContext2D, key: Parameters<typeof visibilityArt>[0], x: number, y: number,
  source: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, groundY: number, scale: number, pivotX = source.width / 2): boolean {
  const image = visibilityArt(key);
  if (image === null) return false;
  drawCroppedWorldSprite(context, image, source,
    { x: x - pivotX * scale, y: y - (groundY - source.y) * scale, width: source.width * scale, height: source.height * scale }, false, true);
  return true;
}

/** Material piles on the site's front right: timber behind, stone in front (1-3 levels, constructionPileLevels). */
export function drawConstructionPiles(context: CanvasRenderingContext2D, site: ConstructionSite, progress: number): void {
  const levels = constructionPileLevels(site, progress);
  const ground = footprintGround(site);
  const full = { x: 0, y: 0, width: 96, height: 64 };
  if (levels.wood > 0) drawGroundSprite(context, `pile_wood_${levels.wood as 1 | 2 | 3}`, ground.x + ground.span * 0.42, ground.y + ground.span * 0.1, full, 56, 0.5);
  if (levels.stone > 0) drawGroundSprite(context, `pile_stone_${levels.stone as 1 | 2 | 3}`, ground.x + ground.span * 0.24, ground.y + ground.span * 0.26, full, 56, 0.5);
}

/** The sign post on the plot's left corner, from the first stake to completion. */
export function drawConstructionSign(context: CanvasRenderingContext2D, site: ConstructionSite): void {
  const ground = footprintGround(site);
  drawGroundSprite(context, "sign_post", ground.x - ground.span * 0.46, ground.y + 2, { x: 0, y: 0, width: 32, height: 64 }, 56, 0.5);
}

/** The well's own three building stages (72 x 80 cells, pivot (36, 64), mount scale 0.72); false before the foundation. */
export function drawWellStage(context: CanvasRenderingContext2D, site: ConstructionSite, progress: number): boolean {
  const stage = constructionStageIndex(progress);
  if (stage === 0) return false;
  const ground = footprintGround(site);
  return drawGroundSprite(context, "well_stages", ground.x, ground.y, { x: (stage - 1) * 72, y: 0, width: 72, height: 80 }, 64, 0.72, 36);
}
