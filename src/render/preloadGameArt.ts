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

export async function preloadGameArt(): Promise<void> {
  await Promise.all([
    registerHouseConditionArt(HOUSE_CONDITION_ART), preloadWorldAssets(), preloadHistoricalHouseAssets(), preloadHistoricalFacilityAssets(),
    preloadHouseCompoundAssets(), preloadStoneWallAssets(),
    preloadRuntimeActorAssets(), preloadMillAssets(), preloadConstructionArtAssets(),
    preloadGateAssets(), preloadBridgeWaterAssets(), preloadTimberWallAssets(), preloadTownLandscapeAssets(), preloadBuildingVariantAssets(),
  ]);
}
