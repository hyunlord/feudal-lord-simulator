import { bridgeWaterImage, type BridgeWaterAssetId } from "./bridgeWaterAssets";
import { drawCroppedWorldSprite } from "./worldSprite";
type Crop={readonly x:number;readonly y:number;readonly width:number;readonly height:number};
/** Registered spare terrain pieces. Preview only: fords and stone bridges do not create routes. */
export function bridgeWaterKitRegions(id:BridgeWaterAssetId):readonly Crop[]{
  switch(id){
    case "woodX":return [{x:665,y:8,width:440,height:288},{x:660,y:298,width:410,height:276},{x:660,y:576,width:420,height:279}];
    case "woodY":return [{x:665,y:40,width:480,height:295},{x:710,y:330,width:423,height:257},{x:710,y:570,width:423,height:285}];
    case "stoneX":return [{x:635,y:0,width:480,height:320},{x:695,y:323,width:400,height:252},{x:685,y:580,width:402,height:275}];
    case "stoneY":return [{x:670,y:35,width:478,height:300},{x:695,y:335,width:425,height:243},{x:695,y:605,width:425,height:249}];
    case "bankMud":case "bankStone":return [{x:0,y:0,width:1774,height:887}];
    case "water":case "shallow":return [{x:0,y:0,width:1254,height:1254}];
    case "fordGravel":case "fordStones":return [{x:0,y:0,width:1774,height:887}];
  }
}
export function drawBridgeWaterKitPiece(context:CanvasRenderingContext2D,id:BridgeWaterAssetId,index:number,destination:Crop):boolean{
  const image=bridgeWaterImage(id),source=bridgeWaterKitRegions(id)[index];
  if(image===null||source===undefined)return false;
  const scale=Math.min(destination.width/source.width,destination.height/source.height);
  const target={x:destination.x+(destination.width-source.width*scale)/2,y:destination.y+(destination.height-source.height*scale)/2,width:source.width*scale,height:source.height*scale};
  context.save();
  if(id==="woodY"){
    const shift=index===1?0:250;
    const polygon=index===0?[[660,0],[1148,0],[1148,300],[1000,380],[660,380]]:[[700,500+shift],[1140,290+shift],[1140,435+shift],[700,645+shift]];
    context.beginPath();polygon.forEach(([x,y],i)=>{if(x===undefined||y===undefined)return;const dx=target.x+(x-source.x)*scale,dy=target.y+(y-source.y)*scale;if(i===0)context.moveTo(dx,dy);else context.lineTo(dx,dy);});context.closePath();context.clip();
  }
  drawCroppedWorldSprite(context,image,source,target,false,true);
  context.restore();
  return true;
}
