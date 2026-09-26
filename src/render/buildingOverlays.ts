import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { housePressureStatus } from "../population/housePressure";
import { buildBuildingVisualState } from "./buildingVisualState";
import { historicalHouseAssetMeta, historicalHouseReady, historicalHouseSpriteRect } from "./historicalHouseAssets";
import { drawStockPiles } from "./stockPiles";
import { drawWave7, drawWave7Overlay, type Wave7Key } from "./wave7Art";
import { drawWave9, drawWave9Overlay, type Wave9Key } from "./wave9Art";
import { tileToScreen } from "./iso";
import { drawStoryProps } from "./storyWorldProps";
import { seasonBlend, seasonForObject } from "./seasonTransition";

// INSTALL-7 building overlays, drawn right after a finished building's art in the object pass (full detail only):
//  - winter (calendar season 3): snow on the roof of a single-lot house, the Wave 7 layer painted on that level's own
//    canvas (roof_snow_l0..l4), drawn into the same rect and crop as the house; gone in spring;
//  - an abandoned house (F0-A stage 2): the boarded windows (boarded_l0..l4), same registration;
//  - stock piles at the door (stockPiles.ts).
// Pair lots have no Wave 7 overlay yet (their roofs differ); they keep their walls bare in winter.
// UI-4 (Wave 9, world before UI): a house on fire (F0-B `events.burning`) shows its roof in flames (fire_roof_lN on the
// level's canvas) under a black smoke column (four frames, 150 ms each) and, when its household draws water from a
// well, two buckets set down on the way to the nearest well; once out, a burnt house (`burntTick`) is the burnt_lN
// painting (same alpha as the house) until its rebuild completes. Pair lots show the smoke column and, burnt, soot.
const SMOKE_FRAME_MS = 150;
export function drawBuildingOverlays(context: CanvasRenderingContext2D, state: GameState, building: Building): void {
  if (building.kind === "house") drawHouseEventOverlays(context, state, building);
  if (building.kind === "house" && building.houseLot === undefined) {
    const level = buildBuildingVisualState(building, state.houses).houseLevel;
    const meta = historicalHouseReady(level) ? historicalHouseAssetMeta(level) : null;
    if (meta !== null) {
      const rect = historicalHouseSpriteRect(building, meta);
      const clamped = Math.max(0, Math.min(4, level));
      const house = state.houses.find(candidate => candidate.buildingId === building.id);
      if (house !== undefined && housePressureStatus(house) === "abandoned") drawWave7Overlay(context, `boarded_l${clamped}` as Wave7Key, meta.alphaBounds, meta, rect);
      // INSTALL-15: while the season turns, each roof takes or loses its snow at its own moment, with the trees.
      if (seasonForObject(seasonBlend(state), building.tx * 31 + building.ty * 17) === 3) drawWave7Overlay(context, `roof_snow_l${clamped}` as Wave7Key, meta.alphaBounds, meta, rect);
    }
  }
  drawStockPiles(context, state, building);
  drawStoryProps(context, state, building); // UI-4 petition crowd, S12 leaving family
}

function drawHouseEventOverlays(context: CanvasRenderingContext2D, state: GameState, building: Building): void {
  const burning = state.events?.burning.find(entry => entry.buildingId === building.id);
  const house = state.houses.find(candidate => candidate.buildingId === building.id);
  const burnt = burning === undefined && house?.burntTick !== undefined;
  if (burning === undefined && !burnt) return;
  const level = Math.max(0, Math.min(4, buildBuildingVisualState(building, state.houses).houseLevel));
  const meta = building.houseLot === undefined && historicalHouseReady(level) ? historicalHouseAssetMeta(level) : null;
  const rect = meta === null ? null : historicalHouseSpriteRect(building, meta);
  const base = tileToScreen(building.tx + 0.5, building.ty + 0.5);
  if (burnt) {
    if (meta !== null && rect !== null && drawWave9Overlay(context, `event_burnt_l${level}` as Wave9Key, meta.alphaBounds, meta, rect)) return;
    drawWave9(context, "decal_soot_ground", base.sx, base.sy, 0.7);
    return;
  }
  if (meta !== null && rect !== null) drawWave9Overlay(context, `event_fire_roof_l${level}` as Wave9Key, meta.alphaBounds, meta, rect);
  const now = typeof performance === "undefined" ? 0 : performance.now();
  const top = rect === null ? base.sy - 48 : rect.y + rect.height * 0.3;
  drawWave9(context, "fx_black_smoke_column_sheet", rect === null ? base.sx : rect.x + rect.width / 2, top, 0.55, Math.floor(now / SMOKE_FRAME_MS));
  if (burning?.doused !== true) return;
  // The household fights it with water: two buckets set down toward the nearest well.
  const well = state.buildings.filter(candidate => candidate.kind === "well")
    .sort((a, b) => Math.abs(a.tx - building.tx) + Math.abs(a.ty - building.ty) - Math.abs(b.tx - building.tx) - Math.abs(b.ty - building.ty))[0];
  if (well === undefined) return;
  const dx = Math.sign(well.tx - building.tx); const dy = Math.sign(well.ty - building.ty);
  const facing = dx >= 0 ? (dy >= 0 ? "se" : "ne") : (dy >= 0 ? "sw" : "nw");
  for (const step of [1.2, 1.8]) {
    const at = tileToScreen(building.tx + 0.5 + dx * step, building.ty + 0.5 + dy * step);
    drawWave7(context, `work_waterbucket_${facing}` as Wave7Key, at.sx, at.sy, 0.8);
  }
}
