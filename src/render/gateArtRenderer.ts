import { gateHasSharedOpening } from "./gatePortalBranches";
import { gateArtImage, preloadGateAssets } from './gateArtAssets';
import { GATE_REGISTRATION, gateArtAxis, gateArtPanels, type GateMaterial } from './gateArtGeometry';
import { GATE_HALF_CLEARANCE } from '../world/wallTraversal';
import { palisadeScreenPath } from './palisadeRenderGeometry';
import type { StoneWallNode } from './stoneWallTopology';
import { drawCroppedWorldSprite } from './worldSprite';
import { wallFaceAsset } from './terrainVariantAssets';
import { TERRAIN_VARIANTS, type WallFaceKey } from './terrainVariantManifest';
import type { StoneWallAxis } from './stoneWallGeometry';

// Gate v2 (INSTALL-4e, Wave 4e; wall strips only): the stone and palisade gate v2 were painted on the NW-SE gate part's
// 1254 canvas, downscaled to 512, with that part's alpha exactly (passage included), so they are drawn with the NW-SE
// registration unchanged. Only that axis was painted: the NE-SW gate draws the v2 mirrored about the canvas centre
// with the mirrored registration (as the SW abutment mirrors the SE one). The passage (logic) is untouched.
const V2_SIZE = 512;
const GATE_CANVAS = 1254;
function mirroredRegistration(material: GateMaterial) {
  const source = GATE_REGISTRATION[material].descending;
  return { left: { x: GATE_CANVAS - source.right.x, y: source.right.y }, right: { x: GATE_CANVAS - source.left.x, y: source.left.y }, heightScale: source.heightScale };
}
/** Gate v2 registration per axis (1254 canvas coordinates): NW-SE as the old part, NE-SW its mirror. */
export function gateV2Registration(material: GateMaterial, axis: StoneWallAxis) {
  return axis === 'descending' ? GATE_REGISTRATION[material].descending : mirroredRegistration(material);
}
// Browser image cache: the mirrored v2 (one 512 canvas per material, made once the image is loaded).
const mirrored = new Map<GateMaterial, HTMLCanvasElement>();
function gateV2Image(material: GateMaterial, axis: StoneWallAxis): CanvasImageSource | null {
  const image = wallFaceAsset((material === 'stone' ? TERRAIN_VARIANTS.stoneGate[0] : TERRAIN_VARIANTS.palisadeGate[0]) as WallFaceKey);
  if (image === null || axis === 'descending' || typeof document === 'undefined') return axis === 'descending' ? image : null;
  const cached = mirrored.get(material);
  if (cached !== undefined) return cached;
  const canvas = document.createElement('canvas'); canvas.width = V2_SIZE; canvas.height = V2_SIZE;
  const paint = canvas.getContext('2d');
  if (paint === null) return null;
  paint.setTransform(-1, 0, 0, 1, V2_SIZE, 0);
  drawCroppedWorldSprite(paint, image, { x: 0, y: 0, width: V2_SIZE, height: V2_SIZE }, { x: 0, y: 0, width: V2_SIZE, height: V2_SIZE }, false, false);
  mirrored.set(material, canvas);
  return canvas;
}

// Stone gate v3 (INSTALL-5c, Wave 5c; wall strips only): one painting per axis, 512 x 384, drawn whole (no panel
// stretch, so the arch keeps its curve). Its geometry record puts the portal feet 204 px apart about the pivot (252,
// 249) on a 2:1 ground line; the passage is 2 x GATE_HALF_CLEARANCE tiles = 51.2 screen px at zoom 1, so the painting
// is drawn at 51.2 / 204 (its 112 px local height is then 28 px, the wall strip's height).
const V3_PIVOT = { x: 252, y: 249 } as const;
const V3_PORTAL_SPAN = 204;
const V3_SIZE = { width: 512, height: 384 } as const;
export const GATE_V3_SCALE = (GATE_HALF_CLEARANCE * 2 * 32) / V3_PORTAL_SPAN;
function drawGateV3(context: CanvasRenderingContext2D, axis: StoneWallAxis, center: { readonly x: number; readonly y: number }): boolean {
  const image = wallFaceAsset((axis === 'descending' ? TERRAIN_VARIANTS.stoneGateV3[0] : TERRAIN_VARIANTS.stoneGateV3[1]) as WallFaceKey);
  if (image === null) return false;
  drawCroppedWorldSprite(context, image, { x: 0, y: 0, ...V3_SIZE },
    { x: center.x - V3_PIVOT.x * GATE_V3_SCALE, y: center.y - V3_PIVOT.y * GATE_V3_SCALE,
      width: V3_SIZE.width * GATE_V3_SCALE, height: V3_SIZE.height * GATE_V3_SCALE }, false, true);
  return true;
}

/** `v2`: the wall strips draw the Wave 4e gate v2 art (the stone gate the Wave 5c v3); the old pieces keep the Phase gate parts. */
export function drawRegisteredGate(context: CanvasRenderingContext2D, node: StoneWallNode, material: GateMaterial, v2 = false): boolean {
  if (gateHasSharedOpening(node)) return false;
  void preloadGateAssets();
  const axis = gateArtAxis(node);
  if (axis === null) return false;
  const v3Center = v2 && material === 'stone' ? palisadeScreenPath([node.point])[0] : undefined;
  if (v3Center !== undefined && drawGateV3(context, axis, v3Center)) { drawGateLeaves(context, axis, v3Center); return true; }
  const v2Frame = v2 ? gateV2Image(material, axis) : null;
  const frame = v2Frame ?? gateArtImage(material === 'stone' ? 'stone_arch' : 'timber_frame', axis);
  const doors = gateArtImage('doors_open', axis);
  const center = palisadeScreenPath([node.point])[0];
  if (!frame || !doors || !center) return false;
  const source = v2Frame !== null ? gateV2Registration(material, axis) : GATE_REGISTRATION[material][axis];
  // The v2 image is 512 px for the 1254 canvas; the old parts are registered derivatives (their crop scales itself).
  const pixel = v2Frame !== null ? V2_SIZE / GATE_CANVAS : 1;
  const slope = axis === 'descending' ? 0.5 : -0.5;
  const groundSlope = (source.right.y-source.left.y)/(source.right.x-source.left.x);
  for (const panel of gateArtPanels(material, axis, source)) {
    const a = (panel.targetRight-panel.targetLeft)/(panel.sourceRight-panel.sourceLeft);
    const e = center.x+panel.targetLeft-a*panel.sourceLeft;
    const b = slope*a-source.heightScale*groundSlope;
    const f = center.y+slope*(e-center.x)-source.heightScale*(source.left.y-groundSlope*source.left.x);
    context.save();
    context.transform(a,b,0,source.heightScale,e,f);
    const crop = { x: panel.sourceLeft, y: 0, width: panel.sourceRight-panel.sourceLeft, height: GATE_CANVAS };
    drawCroppedWorldSprite(context, frame, { x: crop.x*pixel, y: 0, width: crop.width*pixel, height: GATE_CANVAS*pixel }, crop, false, true);
    context.restore();
  }
  drawGateLeaves(context, axis, center);
  return true;
}

/** Independently generated leaves are registered as narrow outward folded panels.
 * Closed-leaf sources are review-only: completed gates remain logically open. */
function drawGateLeaves(context: CanvasRenderingContext2D, axis: StoneWallAxis, center: { readonly x: number; readonly y: number }): void {
  const doors = gateArtImage('doors_open', axis);
  if (!doors) return;
  const slope = axis === 'descending' ? 0.5 : -0.5;
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
}
