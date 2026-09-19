import { applyPaletteStroke } from "./style";
import { drawCroppedWorldSprite } from "./worldSprite";
import { bridgeAt } from "../world/bridges";
import type { WallGrid } from "../world/wallTraversal";
import type { Tile } from "../world/world.types";
import { bridgeWaterImage } from "./bridgeWaterAssets";
import { tileToScreen } from "./iso";
import { SEMANTIC_PALETTE } from "../content/palette";

export type BridgeRailPiece={readonly tx:number;readonly ty:number;readonly axis:"x"|"y";readonly side:"rear"|"front";readonly depth:number};
export function bridgeRailPieces(state:WallGrid,tiles:readonly Tile[]):readonly BridgeRailPiece[]{
  return tiles.flatMap(tile=>{
    const bridge=bridgeAt(state,tile);
    return bridge===null?[]:(["rear","front"] as const).map(side=>({tx:tile.tx,ty:tile.ty,axis:bridge.axis,side,depth:tile.tx+tile.ty+(side==="rear"?-.45:.65)}));
  });
}

type Point={readonly x:number;readonly y:number};
function point(tx:number,ty:number):Point{const p=tileToScreen(tx,ty);return {x:p.sx,y:p.sy};}
function deckCorners(tx:number,ty:number,axis:"x"|"y"){
  return axis==="x"?[point(tx-.5,ty-.45),point(tx+.5,ty-.45),point(tx-.5,ty+.45)] as const:
    [point(tx-.45,ty-.5),point(tx-.45,ty+.5),point(tx+.45,ty-.5)] as const;
}
function affine(context:CanvasRenderingContext2D,source:readonly [Point,Point,Point],target:readonly [Point,Point,Point]):void{
  const [a,b,d]=source,[p,q,r]=target;
  const ux=b.x-a.x,uy=b.y-a.y,vx=d.x-a.x,vy=d.y-a.y,det=ux*vy-uy*vx;
  const ax=((q.x-p.x)*vy-(r.x-p.x)*uy)/det,bx=((q.y-p.y)*vy-(r.y-p.y)*uy)/det;
  const ay=((r.x-p.x)*ux-(q.x-p.x)*vx)/det,by=((r.y-p.y)*ux-(q.y-p.y)*vx)/det;
  context.transform(ax,bx,ay,by,p.x-ax*a.x-ay*a.y,p.y-bx*a.x-by*a.y);
}
export function drawBridgeDeck(context:CanvasRenderingContext2D,state:WallGrid,tile:Tile):void{
  const span=bridgeAt(state,tile);if(span===null)return;
  const image=bridgeWaterImage(span.axis==="x"?"woodX":"woodY");
  const target=deckCorners(tile.tx,tile.ty,span.axis);
  if(image===null){
    const [a,b,d]=target;context.fillStyle=SEMANTIC_PALETTE.earth;context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.lineTo(b.x+d.x-a.x,b.y+d.y-a.y);context.lineTo(d.x,d.y);context.closePath();context.fill();return;
  }
  context.save();context.imageSmoothingEnabled=true;
  if(span.axis==="x"){
    affine(context,[{x:795,y:22},{x:1090,y:195},{x:680,y:91}],target);
    drawCroppedWorldSprite(context,image,{x:665,y:8,width:440,height:288},{x:665,y:8,width:440,height:288},false,true);
  }else{
    affine(context,[{x:1019,y:58},{x:680,y:246},{x:1130,y:118}],target);
    context.beginPath();context.moveTo(660,0);context.lineTo(1148,0);context.lineTo(1148,300);context.lineTo(1000,380);context.lineTo(660,380);context.closePath();context.clip();
    drawCroppedWorldSprite(context,image,{x:660,y:38,width:488,height:304},{x:660,y:38,width:488,height:304},false,true);
  }
  context.restore();
}
export function drawBridgeRail(context:CanvasRenderingContext2D,piece:BridgeRailPiece):void{
  const image=bridgeWaterImage(piece.axis==="x"?"woodX":"woodY");
  const offset=piece.side==="rear"?-.45:.45;
  const start=piece.axis==="x"?point(piece.tx-.5,piece.ty+offset):point(piece.tx+offset,piece.ty-.5);
  const end=piece.axis==="x"?point(piece.tx+.5,piece.ty+offset):point(piece.tx+offset,piece.ty+.5);
  if(image===null){applyPaletteStroke(context,SEMANTIC_PALETTE.earth,1);context.beginPath();context.moveTo(start.x,start.y-7);context.lineTo(end.x,end.y-7);context.stroke();return;}
  context.save();context.imageSmoothingEnabled=true;
  const source=piece.axis==="x"?[{x:686,y:393},{x:1045,y:564},{x:686,y:305}] as const:[{x:1105,y:397},{x:727,y:579},{x:1105,y:337}] as const;
  affine(context,source,[start,end,{x:start.x,y:start.y-9}]);
  if(piece.axis==="y"){
    context.beginPath();context.moveTo(700,500);context.lineTo(1140,290);context.lineTo(1140,435);context.lineTo(700,645);context.closePath();context.clip();
  }
  if(piece.axis==="x")drawCroppedWorldSprite(context,image,{x:660,y:298,width:410,height:276},{x:660,y:298,width:410,height:276},false,true);
  else drawCroppedWorldSprite(context,image,{x:708,y:330,width:425,height:256},{x:708,y:330,width:425,height:256},false,true);
  context.restore();
}
