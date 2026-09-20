import { preloadTownLandscapeAssets } from "./townLandscapeAssets";
import { preloadWorldAssets } from "./worldAssets";
import { preloadHistoricalHouseAssets } from "./historicalHouseAssets";
import { preloadHistoricalFacilityAssets } from "./historicalFacilityAssets";
import { preloadHouseCompoundAssets } from "./houseCompoundAssets";
import { preloadFarmAssets } from "./farmAssets";
import { preloadStoneWallAssets } from "./stoneWallAssets";
import { preloadRuntimeActorAssets } from "./runtimeActorAssets";
import { preloadMillAssets } from "./animatedMill";
import { preloadConstructionArtAssets } from "./constructionArtAssets";
import { preloadGateAssets } from "./gateArtAssets";
import { preloadBridgeWaterAssets } from "./bridgeWaterAssets";
import { preloadTimberWallAssets } from "./timberWallAssets";

export async function preloadGameArt(): Promise<void> {
  await Promise.all([
    preloadWorldAssets(), preloadHistoricalHouseAssets(), preloadHistoricalFacilityAssets(),
    preloadHouseCompoundAssets(), preloadFarmAssets(), preloadStoneWallAssets(),
    preloadRuntimeActorAssets(), preloadMillAssets(), preloadConstructionArtAssets(),
    preloadGateAssets(), preloadBridgeWaterAssets(), preloadTimberWallAssets(), preloadTownLandscapeAssets(),
  ]);
}
