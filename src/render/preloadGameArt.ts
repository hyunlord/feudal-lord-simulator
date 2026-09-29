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
import { preloadWave21Art } from "../ui/wave21Art";
import { preloadWave31Art } from "../ui/wave31Art";
import { preloadWave9Art } from "./wave9Art";
import { preloadWave17WorldArt } from "./warWorldProps";
import { preloadGuildhallArt } from "./reorgWorldProps";
import { preloadWave11Art } from "./wave11Art";
import { preloadWave3AleArt } from "./wave3AleArt";
import { preloadWave3ClothArt } from "./wave3ClothArt";
import { preloadWave26HouseLayers, preloadWave26HousePaintings } from "./wave26HouseArt";
import { preloadCanvasIcons } from "../ui/uiArt";

/** The world art, awaited by captures; `chapter` (chapterArt.ts): the facility paintings up to it (default: all). */
export async function preloadGameArt(chapter = Number.POSITIVE_INFINITY): Promise<void> {
  await Promise.all([
    registerHouseConditionArt(HOUSE_CONDITION_ART), preloadWorldAssets(), preloadHistoricalHouseAssets(), preloadHistoricalFacilityAssets(chapter),
    preloadHouseCompoundAssets(), preloadStoneWallAssets(),
    preloadRuntimeActorAssets(), preloadMillAssets(), preloadConstructionArtAssets(),
    preloadGateAssets(), preloadBridgeWaterAssets(), preloadTimberWallAssets(), preloadTownLandscapeAssets(), preloadBuildingVariantAssets(),
    preloadWave26HousePaintings(), // INSTALL-26
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
  // INSTALL-3: the ale chain's art at startup, not by chapter (a barn can turn to barley in any chapter; the command has no gate).
  preloadWave3AleArt();
  // CLOTH-UI: the cloth chain's art at startup (same reasoning: any building can hold cloth in any chapter).
  preloadWave3ClothArt();
  preloadWave26HouseLayers(); // INSTALL-26 the house paintings' weathered, fresh, snow and boarded layers
  preloadCanvasIcons();
}

/** BUDGET-1b: the manifestArt manifests that hold chapter-bound art (chapterArt.ts CHAPTER_ART); a new one joins here. */
const CHAPTER_SCOPED_MANIFESTS: readonly ((include: (url: string) => boolean) => void)[] = [preloadWave9Art, preloadWave17WorldArt, preloadWave21Art, preloadWave31Art, preloadGuildhallArt];

/** BUDGET-1b: the chapter-bound art up to `chapter`; called again when the game enters a later chapter. */
export function preloadChapterArt(chapter: number): void {
  const entered = (url: string) => chapterOfArt(url) <= chapter;
  for (const preload of CHAPTER_SCOPED_MANIFESTS) preload(entered);
  void preloadHistoricalFacilityAssets(chapter);
}
