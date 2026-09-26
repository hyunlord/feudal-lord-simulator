import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { stateCalendar } from "../engine/scenarioState";
import { housePressureStatus } from "../population/housePressure";
import { buildBuildingVisualState } from "./buildingVisualState";
import { historicalHouseAssetMeta, historicalHouseReady, historicalHouseSpriteRect } from "./historicalHouseAssets";
import { drawStockPiles } from "./stockPiles";
import { drawWave7Overlay, type Wave7Key } from "./wave7Art";

// INSTALL-7 building overlays, drawn right after a finished building's art in the object pass (full detail only):
//  - winter (calendar season 3): snow on the roof of a single-lot house, the Wave 7 layer painted on that level's own
//    canvas (roof_snow_l0..l4), drawn into the same rect and crop as the house; gone in spring;
//  - an abandoned house (F0-A stage 2): the boarded windows (boarded_l0..l4), same registration;
//  - stock piles at the door (stockPiles.ts).
// Pair lots have no Wave 7 overlay yet (their roofs differ); they keep their walls bare in winter.
export function drawBuildingOverlays(context: CanvasRenderingContext2D, state: GameState, building: Building): void {
  if (building.kind === "house" && building.houseLot === undefined) {
    const level = buildBuildingVisualState(building, state.houses).houseLevel;
    const meta = historicalHouseReady(level) ? historicalHouseAssetMeta(level) : null;
    if (meta !== null) {
      const rect = historicalHouseSpriteRect(building, meta);
      const clamped = Math.max(0, Math.min(4, level));
      const house = state.houses.find(candidate => candidate.buildingId === building.id);
      if (house !== undefined && housePressureStatus(house) === "abandoned") drawWave7Overlay(context, `boarded_l${clamped}` as Wave7Key, meta.alphaBounds, meta, rect);
      if (stateCalendar(state).season === 3) drawWave7Overlay(context, `roof_snow_l${clamped}` as Wave7Key, meta.alphaBounds, meta, rect);
    }
  }
  drawStockPiles(context, state, building);
}
