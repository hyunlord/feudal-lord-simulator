import { gateHasSharedOpening } from "./gatePortalBranches";
import { gateArtImage, preloadGateAssets } from './gateArtAssets';
import { GATE_REGISTRATION, gateArtAxis, gateArtPanels, type GateMaterial } from './gateArtGeometry';
import { GATE_HALF_CLEARANCE } from '../world/wallTraversal';
import { palisadeScreenPath } from './palisadeRenderGeometry';
import type { StoneWallNode } from './stoneWallTopology';
import { drawCroppedWorldSprite } from './worldSprite';

export function drawRegisteredGate(context: CanvasRenderingContext2D, node: StoneWallNode, material: GateMaterial): boolean {
  if (gateHasSharedOpening(node)) return false;
  void preloadGateAssets();
  const axis = gateArtAxis(node);
  if (axis === null) return false;
  const frame = gateArtImage(material === 'stone' ? 'stone_arch' : 'timber_frame', axis);
  const doors = gateArtImage('doors_open', axis);
  const center = palisadeScreenPath([node.point])[0];
  if (!frame || !doors || !center) return false;
  const source = GATE_REGISTRATION[material][axis];
  const slope = axis === 'descending' ? 0.5 : -0.5;
  const groundSlope = (source.right.y-source.left.y)/(source.right.x-source.left.x);
  for (const panel of gateArtPanels(material, axis)) {
    const a = (panel.targetRight-panel.targetLeft)/(panel.sourceRight-panel.sourceLeft);
    const e = center.x+panel.targetLeft-a*panel.sourceLeft;
    const b = slope*a-source.heightScale*groundSlope;
    const f = center.y+slope*(e-center.x)-source.heightScale*(source.left.y-groundSlope*source.left.x);
    context.save();
    context.transform(a,b,0,source.heightScale,e,f);
    const crop = { x: panel.sourceLeft, y: 0, width: panel.sourceRight-panel.sourceLeft, height: 1254 };
    drawCroppedWorldSprite(context, frame, crop, crop, false, true);
    context.restore();
  }
  // Independently generated leaves are registered as narrow outward folded panels.
  // Closed-leaf sources are review-only: completed gates remain logically open.
  for (const side of [-1,1]) {
    const x = center.x+side*(GATE_HALF_CLEARANCE*32+3);
    const y = center.y+slope*(x-center.x);
    const left = side < 0;
    const crop = axis === 'descending'
      ? (left ? {x:60,y:94,w:365,h:716} : {x:820,y:522,w:364,h:684})
      : (left ? {x:44,y:395,w:395,h:780} : {x:782,y:90,w:420,h:776});
    drawCroppedWorldSprite(context, doors, { x:crop.x,y:crop.y,width:crop.w,height:crop.h },
      { x:x+(left ? -10 : 0),y:y-27,width:10,height:27 }, false, true);
  }
  return true;
}
