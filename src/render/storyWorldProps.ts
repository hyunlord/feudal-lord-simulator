import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { openPetitions } from "../engine/politics";
import { plagueVacantPlots } from "../engine/plague";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { tileToScreen } from "./iso";
import { drawWave7 } from "./wave7Art";
import { drawWave9, wave9Art, wave9Meta, type Wave9Key } from "./wave9Art";
import { WALKER_FIGURE_PX } from "./walkerComposer";
import { petitionCrowdScale } from './storyCrowdScale';
import { drawCroppedWorldSprite } from "./worldSprite";

// UI-4 story props in the world, before any card:
//  - a waiting petition (F0-C1 FC-3): the merchants' crowd and two petitioners before the chapel (or church, or keep;
//    the first house without one), drawn with that building so they sort with it;
//  - S12, a household leaving (F0-A leavingSinceTick): the family (Wave 9 wk_leaving_family, the mother's bundle), a
//    child (60 % sheet) and the Wave 7 bundle at the door;
//  - S12, a household gone (abandonedTick newly set): the family walks from the door to the nearest map edge
//    (DEPARTURE_MS, a presentation walker only: nothing in the game moves).
// Sheet cells: four columns (NE, SE, SW, NW, the actor sheets' order) by two rows (gait frames).
const DIRECTION_COLUMN = { NE: 0, SE: 1, SW: 2, NW: 3 } as const;
type Direction = keyof typeof DIRECTION_COLUMN;
/**
 * ASSET-2: the story walkers by the walker composer's rule — each figure WALKER_FIGURE_PX (17.6 px) tall — from each
 * sheet's figure height (the cells' median opaque height, alpha > 32, measured on the Wave 9 sheets); they were drawn at
 * × 0.5, about 1.8 times an ordinary walker. The child keeps its family's factor, so it stays a child beside them.
 */
const FIGURE_HEIGHT = { wk_funeral_bearers: 65, wk_leaving_family: 62, wk_petitioner_m: 65, wk_petitioner_f: 62, wk_royal_messenger: 68 } as const;
export type StoryWalkerKey = keyof typeof FIGURE_HEIGHT;
export const storyWalkerScale = (key: StoryWalkerKey): number => WALKER_FIGURE_PX / FIGURE_HEIGHT[key];
export const STORY_WALKER_FIGURE_HEIGHT: Readonly<Record<StoryWalkerKey, number>> = FIGURE_HEIGHT;
const CHILD_SCALE = storyWalkerScale("wk_leaving_family");
const DEPARTURE_MS = 12_000;
const GAIT_MS = 260;

function drawCell(context: CanvasRenderingContext2D, key: Wave9Key, direction: Direction, gait: number, x: number, y: number, scale: number): boolean {
  const image = wave9Art(key);
  const meta = wave9Meta(key);
  if (image === null || !("frames" in meta)) return false;
  const { width, height } = meta.frames;
  drawCroppedWorldSprite(context, image, { x: DIRECTION_COLUMN[direction] * width, y: (gait % 2) * height, width, height },
    { x: x - meta.pivot.x * scale, y: y - meta.pivot.y * scale, width: width * scale, height: height * scale }, false, true);
  return true;
}

const door = (building: Building) => {
  const size = buildingFootprint(building);
  return tileToScreen(building.tx + size.width / 2 - 0.5, building.ty + size.height + 0.1);
};

/**
 * The building the petitioners gather before (null: no petition waiting). UI-10 (F5-A LG-1): once the family has left
 * the manor for its country seat, the keep's gate is shut — they gather before the market, the town's own, instead.
 */
export function petitionGathering(state: GameState): Building | null {
  if (openPetitions(state).length === 0) return null;
  const market = state.legacy?.family === "departed" ? state.buildings.find(building => building.kind === "market") : undefined;
  if (market !== undefined) return market;
  return state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "church")
    ?? state.buildings.find(building => building.kind === "chapel") ?? state.buildings.find(building => building.kind === "house") ?? null;
}

/** Drawn right after a building (the object pass): the petition crowd before it, a leaving family at its door. */
export function drawStoryProps(context: CanvasRenderingContext2D, state: GameState, building: Building): void {
  if (petitionGathering(state)?.id === building.id) {
    const at = door(building);
    drawWave9(context, "event_crowd_manor_gate", at.sx, at.sy + 8, petitionCrowdScale());
    drawCell(context, "wk_petitioner_m", "NW", 0, at.sx - 22, at.sy + 18, storyWalkerScale("wk_petitioner_m"));
    drawCell(context, "wk_petitioner_f", "NE", 0, at.sx + 20, at.sy + 20, storyWalkerScale("wk_petitioner_f"));
  }
  if (building.kind !== "house") return;
  const house = state.houses.find(candidate => candidate.buildingId === building.id);
  if (house === undefined || house.leavingSinceTick === undefined || house.abandonedTick !== undefined) return;
  const at = door(building);
  drawWave7(context, "bundle_family_prop", at.sx + 16, at.sy + 4, 0.5);
  drawCell(context, "wk_leaving_family", "SW", 0, at.sx - 6, at.sy + 8, storyWalkerScale("wk_leaving_family"));
  drawCell(context, "prop_leaving_child_sheet", "SW", 0, at.sx + 8, at.sy + 12, CHILD_SCALE);
}

// Departures seen by this renderer (presentation memory: a new game or a load clears it when the clock goes back).
const departures = new Map<string, { readonly from: { readonly x: number; readonly y: number }; readonly to: { readonly x: number; readonly y: number }; readonly startMs: number }>();
let departureTick = -1;

/** The families walking out of town, over the objects (short-lived; drawn after the object pass). */
export function drawDepartures(context: CanvasRenderingContext2D, state: GameState, nowMs: number): void {
  if (state.tick < departureTick) departures.clear();
  departureTick = state.tick;
  // UI-8: plague-vacant houses (households that died or fled the plague) do not show departure walkers —
  // a dead household does not walk away; fled is handled the same way (same vacantHouseIds list).
  const vacantPlagueIds = new Set(plagueVacantPlots(state));
  for (const house of state.houses) {
    if (house.abandonedTick === undefined || departures.has(house.buildingId) || state.tick - house.abandonedTick > 200) continue;
    if (vacantPlagueIds.has(house.buildingId)) continue;
    const building = state.buildings.find(candidate => candidate.id === house.buildingId);
    if (building === undefined) continue;
    // The nearest map edge along a tile axis.
    const edges = [{ tx: -2, ty: building.ty, d: building.tx }, { tx: state.width + 1, ty: building.ty, d: state.width - building.tx },
      { tx: building.tx, ty: -2, d: building.ty }, { tx: building.tx, ty: state.height + 1, d: state.height - building.ty }].sort((a, b) => a.d - b.d);
    const edge = edges[0]!;
    const from = door(building); const to = tileToScreen(edge.tx, edge.ty);
    departures.set(house.buildingId, { from: { x: from.sx, y: from.sy }, to: { x: to.sx, y: to.sy }, startMs: nowMs });
  }
  for (const [id, walk] of departures) {
    const t = (nowMs - walk.startMs) / DEPARTURE_MS;
    if (t >= 1) { if (t > 2) departures.delete(id); continue; }
    const x = walk.from.x + (walk.to.x - walk.from.x) * t; const y = walk.from.y + (walk.to.y - walk.from.y) * t;
    const direction: Direction = walk.to.x >= walk.from.x ? (walk.to.y >= walk.from.y ? "SE" : "NE") : (walk.to.y >= walk.from.y ? "SW" : "NW");
    const gait = Math.floor(nowMs / GAIT_MS);
    drawCell(context, "wk_leaving_family", direction, gait, x, y, storyWalkerScale("wk_leaving_family"));
    drawCell(context, "prop_leaving_child_sheet", direction, gait + 1, x + 10, y + 4, CHILD_SCALE);
  }
}
