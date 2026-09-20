import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import { assetUrlForBase } from "./worldAssets";

export const bridgeWaterManifest = [
  {id:"woodX",file:"bridge_wood_nw_se-v2.png",width:1774,height:887},
  {id:"woodY",file:"bridge_wood_ne_sw-v2.png",width:1774,height:887},
  {id:"stoneX",file:"bridge_stone_nw_se-v2.png",width:1774,height:887},
  {id:"stoneY",file:"bridge_stone_ne_sw-v2.png",width:1774,height:887},
  {id:"bankMud",file:"riverbank_mud-v2.png",width:1774,height:887},
  {id:"bankStone",file:"riverbank_stone-v2.png",width:1774,height:887},
  {id:"fordGravel",file:"ford_gravel-v1.png",width:1774,height:887},
  {id:"fordStones",file:"ford_stepping_stones-v1.png",width:1774,height:887},
  {id:"water",file:"water_surface-v1.png",width:1254,height:1254},
  {id:"shallow",file:"water_shallow-v1.png",width:1254,height:1254},
] as const;
export type BridgeWaterAssetId=typeof bridgeWaterManifest[number]["id"];
type Asset={readonly id:BridgeWaterAssetId;readonly url:string;image:HTMLImageElement|null;status:"idle"|"loading"|"ready"|"missing"};
const assets:Asset[]=bridgeWaterManifest.map(meta=>({id:meta.id,url:assetUrlForBase(`assets/complete-art-v1/water-bridges/${meta.file}`,import.meta.env?.BASE_URL??"/"),image:null,status:"idle"}));
let pending:Promise<void>|null=null;
export function preloadBridgeWaterAssets():Promise<void>{
  if(typeof Image!=="function")return Promise.resolve();
  pending??=Promise.all(assets.map(asset=>new Promise<void>(resolve=>{
    asset.status="loading";
    try {
      const image=new Image();
      image.onload=()=>{
        const meta=bridgeWaterManifest.find(candidate=>candidate.id===asset.id);
        if(meta!==undefined&&registerRuntimeAsset(image, asset.url, meta.width, meta.height)){asset.image=image;asset.status="ready";}
        else asset.status="missing";
        resolve();
      };
      image.onerror=()=>{asset.status="missing";resolve();};
      image.src=asset.url;
    } catch(error) {
      if(!(error instanceof Error))throw error;
      asset.status="missing";resolve();
    }
  }))).then(()=>undefined);
  return pending;
}
export function bridgeWaterImage(id:BridgeWaterAssetId):HTMLImageElement|null{return assets.find(asset=>asset.id===id)?.image??null;}
export function bridgeWaterAssetStatuses(){return assets.map(asset=>({id:asset.id,url:asset.url,status:asset.status,width:asset.image?.naturalWidth??0,height:asset.image?.naturalHeight??0}));}
