import { drawCroppedWorldSprite } from "./worldSprite";
import type { Tile } from "../world/world.types";
import { bridgeWaterImage } from "./bridgeWaterAssets";
import { tileToScreen } from "./iso";
let surface:HTMLCanvasElement|null=null;
const patterns=new WeakMap<CanvasRenderingContext2D,CanvasPattern>();
/** Mirrored source quadrants make the repeat periodic; one world origin prevents per-tile seams. */
export function drawHistoricalWater(context:CanvasRenderingContext2D,tiles:readonly Tile[]):boolean{
  const image=bridgeWaterImage("water");
  if(image===null||typeof document==="undefined")return false;
  if(surface===null){
    const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
    const paint=canvas.getContext("2d");if(paint===null)return false;
    for(const x of [0,1])for(const y of [0,1]){
      paint.save();paint.translate(x===0?0:256,y===0?0:256);paint.scale(x===0?1:-1,y===0?1:-1);
      drawCroppedWorldSprite(paint,image,{x:256,y:256,width:742,height:742},{x:0,y:0,width:128,height:128},false,true);paint.restore();
    }
    surface=canvas;
  }
  let pattern=patterns.get(context);
  if(pattern===undefined){const created=context.createPattern(surface,"repeat");if(created===null)return false;pattern=created;patterns.set(context,pattern);}
  context.fillStyle=pattern;context.beginPath();
  for(const tile of tiles){const {sx,sy}=tileToScreen(tile.tx,tile.ty);context.moveTo(sx,sy-16);context.lineTo(sx+32,sy);context.lineTo(sx,sy+16);context.lineTo(sx-32,sy);context.closePath();}
  context.fill();return true;
}
