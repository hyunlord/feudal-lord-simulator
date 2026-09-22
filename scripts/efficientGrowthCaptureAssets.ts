import { worldAssetStatuses } from '../src/render/worldAssets';
import { historicalHouseAssetStatuses } from '../src/render/historicalHouseAssets';
import { historicalFacilityAssetStatuses } from '../src/render/historicalFacilityAssets';
import { houseCompoundAssetStatuses } from '../src/render/houseCompoundAssets';
import { farmAssetStatuses } from '../src/render/farmAssets';
import { stoneWallAssetStatuses } from '../src/render/stoneWallAssets';
import { runtimeActorAssetStatuses } from '../src/render/runtimeActorAssets';
import { millAssetStatuses } from '../src/render/animatedMill';
import { constructionArtAssetStatuses } from '../src/render/constructionArtAssets';
import { gateAssetStatuses } from '../src/render/gateArtAssets';
import { bridgeWaterAssetStatuses } from '../src/render/bridgeWaterAssets';
import { timberWallAssetStatus } from '../src/render/timberWallAssets';
import { townLandscapeAssetReady } from '../src/render/townLandscapeAssets';
import { townLandscapeManifest } from '../src/render/townLandscapeManifest.generated';
import { HOUSE_CONDITION_ART } from '../src/render/houseConditionArt.generated';
import { houseConditionArt } from '../src/render/houseConditionArt';

export function efficientAssetFailures(): readonly string[] {
  const statuses = [...worldAssetStatuses(), ...historicalHouseAssetStatuses(), ...historicalFacilityAssetStatuses(),
    ...houseCompoundAssetStatuses(), ...farmAssetStatuses(), ...stoneWallAssetStatuses(), ...runtimeActorAssetStatuses().filter(asset => asset.active),
    ...millAssetStatuses(), ...constructionArtAssetStatuses(), ...gateAssetStatuses(), ...bridgeWaterAssetStatuses(), timberWallAssetStatus()];
  return [...statuses.flatMap((record, index) => record.status === 'ready' && !('rasterError' in record && record.rasterError !== null)
      ? [] : [`asset-${index}:${record.status}:${'url' in record ? record.url : 'timber-wall'}`]),
    ...townLandscapeManifest.filter(record => !townLandscapeAssetReady(record.id)).map(record => record.url),
    ...HOUSE_CONDITION_ART.filter(record => houseConditionArt(record.level, record.lot, record.condition) === null).map(record => record.url)];
}
