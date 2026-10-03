import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { plagueVacantPlots } from "../engine/plague";
import { housePressureStatus } from "../population/housePressure";
import { buildBuildingVisualState } from "./buildingVisualState";
import { historicalHouseAssetMeta, historicalHouseReady, historicalHouseSpriteRect } from "./historicalHouseAssets";
import { houseCompoundAssetMeta, houseCompoundSpriteRect } from "./houseCompoundAssets";
import { drawStockPiles } from "./stockPiles";
import { drawWave7, drawWave7Overlay, type Wave7Key } from "./wave7Art";
import { drawWave9, drawWave9Overlay, type Wave9Key } from "./wave9Art";
import { tileToScreen } from "./iso";
import { drawStoryProps } from "./storyWorldProps";
import { seasonBlend, seasonForObject } from "./seasonTransition";
import { drawWave26HouseLayers, houseStateLayerNow, shownHouseVariant } from "./wave26HouseArt";
import { drawWave32GranaryLayers } from "./wave32GranaryArt";
import { fittedBuildingSpriteRect } from "./buildingSpriteFit";
import { drawStorehouseSnow } from "./storehouseSnowArt";

// INSTALL-7 building overlays, drawn right after a finished building's art in the object pass (above block detail —
// NAT-2: the small views too, by the same rules):
//  - winter (calendar season 3): snow on the roof of a single-lot house, the Wave 7 layer painted on that level's own
//    canvas (roof_snow_l0..l4), drawn into the same rect and crop as the house; gone in spring;
//  - an abandoned house (F0-A stage 2): the boarded windows (boarded_l0..l4), same registration;
//  - UI-8/PLAGUE-b (chapter 3 plague): a plague-emptied house keeps the empty-house boards (vacantHouseBoards);
//    only a base painting of L1–L3 takes event_plague_shut_lN instead. No door marks (historical accuracy).
//  - stock piles at the door (stockPiles.ts).
// Pair lots have no Wave 7 overlay (their roofs differ). INSTALL-30: every pair wears a Wave 30 painting (the approved
// pair, bare, only while it loads) and takes that painting's own layers by the same rules — its
// weathered or fresh, its boarded when abandoned (plague-emptied too: a variant's boards, vacantHouseBoards), snow in winter.
// UI-4 (Wave 9, world before UI): a house on fire (F0-B `events.burning`) shows its roof in flames (fire_roof_lN on the
// level's canvas) under a black smoke column (four frames, 150 ms each) and, when its household draws water from a
// well, two buckets set down on the way to the nearest well; once out, a burnt house (`burntTick`) is the burnt_lN
// painting (same alpha as the house) until its rebuild completes. Pair lots show the smoke column and, burnt, soot.
// INSTALL-26: a house showing a Wave 26 painting takes that painting's own layers instead of Wave 7's — its weathered
// or fresh (houseVariantChoice.ts houseStateLayer), then boarded and snow by the same rules as above.
// INSTALL-32: a granary showing a Wave 32 painting takes its layers (granaryVariantChoice.ts): weathered, its stock
// (full / half / empty), boarded, snow — the stock in the painting, so the Wave 7 door sacks leave it (stockPiles.ts).
// NAT-5 RUN-02: a storehouse takes its body's roof snow in winter (storehouseSnowArt.ts).
const SMOKE_FRAME_MS = 150;

/** PLAGUE-b: the boards an abandoned house shows. A house the plague emptied (died or fled — both in vacantHouseIds,
 * PL-3) takes the empty-house boards every house already has — a Wave 26 variant its own painting's `boarded`
 * layer, a base painting Wave 7's boarded_lN — and Wave 9's plague_shut only where it was painted to fit, the base
 * canvases of L1–L3. No door marks (historical accuracy). */
export function vacantHouseBoards(level: number, variant: boolean, plagueVacant: boolean): "variant_boarded" | "plague_shut" | "boarded" {
  if (variant) return "variant_boarded";
  return plagueVacant && level >= 1 && level <= 3 ? "plague_shut" : "boarded";
}
/** `props` false (NAT-2: the zoomed-out status view) leaves out the door piles and story props, a speck there. */
export function drawBuildingOverlays(context: CanvasRenderingContext2D, state: GameState, building: Building, props = true): void {
  if (building.kind === "house") drawHouseEventOverlays(context, state, building);
  if (building.kind === "house" && building.houseLot === undefined) {
    const level = buildBuildingVisualState(building, state.houses).houseLevel;
    const meta = historicalHouseReady(level) ? historicalHouseAssetMeta(level) : null;
    if (meta !== null) {
      const rect = historicalHouseSpriteRect(building, meta);
      const clamped = Math.max(0, Math.min(4, level));
      const house = state.houses.find(candidate => candidate.buildingId === building.id);
      const boarded = house !== undefined && housePressureStatus(house) === "abandoned";
      // INSTALL-15: while the season turns, each roof takes or loses its snow at its own moment, with the trees.
      const snow = seasonForObject(seasonBlend(state), building.tx * 31 + building.ty * 17) === 3;
      const wave26 = house === undefined ? null : shownHouseVariant(building, level);
      const boards = boarded ? vacantHouseBoards(clamped, wave26 !== null, plagueVacantPlots(state).includes(building.id)) : null;
      if (wave26 !== null && house !== undefined) {
        drawWave26HouseLayers(context, wave26, meta.alphaBounds, rect, { state: houseStateLayerNow(state, house), boarded, snow });
      } else {
        if (boards === "plague_shut") drawWave9Overlay(context, `event_plague_shut_l${clamped}` as Wave9Key, meta.alphaBounds, meta, rect);
        else if (boards === "boarded") drawWave7Overlay(context, `boarded_l${clamped}` as Wave7Key, meta.alphaBounds, meta, rect);
        if (snow) drawWave7Overlay(context, `roof_snow_l${clamped}` as Wave7Key, meta.alphaBounds, meta, rect);
      }
    }
  }
  if (building.kind === "house" && building.houseLot !== undefined) drawPairHouseLayers(context, state, building);
  if (building.kind === "granary") drawWave32GranaryLayers(context, state, building, fittedBuildingSpriteRect("barn", building));
  if (building.kind === "storehouse") drawStorehouseSnow(context, state, building);
  if (!props) return;
  drawStockPiles(context, state, building);
  drawStoryProps(context, state, building); // UI-4 petition crowd, S12 leaving family
}

function drawPairHouseLayers(context: CanvasRenderingContext2D, state: GameState, building: Building): void {
  const level = buildBuildingVisualState(building, state.houses).houseLevel;
  const house = state.houses.find(candidate => candidate.buildingId === building.id);
  const wave30 = house === undefined ? null : shownHouseVariant(building, level);
  const meta = wave30 === null ? null : houseCompoundAssetMeta(building, level);
  if (wave30 === null || meta === null || house === undefined) return;
  const boarded = housePressureStatus(house) === "abandoned";
  const snow = seasonForObject(seasonBlend(state), building.tx * 31 + building.ty * 17) === 3;
  drawWave26HouseLayers(context, wave30, meta.alphaBounds, houseCompoundSpriteRect(building, meta), { state: houseStateLayerNow(state, house), boarded, snow });
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
