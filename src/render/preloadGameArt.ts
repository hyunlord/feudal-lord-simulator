import { registerHouseConditionArt } from "./houseConditionArt";
import { HOUSE_CONDITION_ART } from "./houseConditionArt.generated";
import { preloadTownLandscapeAssets } from "./townLandscapeAssets";
import { preloadWorldAssets } from "./worldAssets";
import { preloadHistoricalHouseAssets } from "./historicalHouseAssets";
import { preloadHistoricalFacilityAssets } from "./historicalFacilityAssets";
import { preloadHouseCompoundAssets } from "./houseCompoundAssets";
import { preloadStoneWallAssets } from "./stoneWallAssets";
import { preloadRuntimeActorAssets } from "./runtimeActorAssets";
import { preloadMillAssets } from "./animatedMill";
import { preloadConstructionArtAssets } from "./constructionArtAssets";
import { preloadGateAssets } from "./gateArtAssets";
import { preloadBridgeWaterAssets } from "./bridgeWaterAssets";
import { preloadTimberWallAssets } from "./timberWallAssets";
import { preloadBuildingVariantAssets } from "./buildingVariantAssets";
import { chapterOfArt } from "./chapterArt";
import { preloadVisibilityArt } from "./visibilityArtManifest";
import { preloadWave7Art } from "./wave7Art";
import { preloadWave9Art } from "./wave9Art";
import { preloadWave17WorldArt } from "./warWorldProps";
import { preloadWave11Art } from "./wave11Art";
import { preloadCanvasIcons } from "../ui/uiArt";

export async function preloadGameArt(): Promise<void> {
  await Promise.all([
    registerHouseConditionArt(HOUSE_CONDITION_ART), preloadWorldAssets(), preloadHistoricalHouseAssets(), preloadHistoricalFacilityAssets(),
    preloadHouseCompoundAssets(), preloadStoneWallAssets(),
    preloadRuntimeActorAssets(), preloadMillAssets(), preloadConstructionArtAssets(),
    preloadGateAssets(), preloadBridgeWaterAssets(), preloadTimberWallAssets(), preloadTownLandscapeAssets(), preloadBuildingVariantAssets(),
  ]);
}

/**
 * The canvas's other startup art, not awaited (the first frames draw their fallbacks): the visibility marks, the Wave 7,
 * 9 and 11 sprites, the canvas icon sheets, and the chapter-bound art up to `chapter` (chapterArt.ts; Infinity: all).
 * scripts/checks/startupArtList.ts records what this and preloadGameArt request for the budget table.
 */
export function preloadFrameArt(chapter: number): void {
  // F0-V: the visibility art and the canvas icon sheets load with the rest (a paused first frame then has them).
  preloadVisibilityArt();
  preloadWave7Art();
  preloadChapterArt(chapter);
  preloadWave11Art();
  preloadCanvasIcons();
}

/** BUDGET-1b: the chapter-bound manifests, up to `chapter`; called again when the game enters a later chapter. */
export function preloadChapterArt(chapter: number): void {
  const entered = (url: string) => chapterOfArt(url) <= chapter;
  preloadWave9Art(entered);
  preloadWave17WorldArt(entered);
}
