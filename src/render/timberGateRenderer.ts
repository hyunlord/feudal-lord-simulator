import { gatePortalBranches } from "./gatePortalBranches";
import { timberGatePiers } from "./timberGateGeometry";
import { timberWallTexture } from "./timberWallAssets";
import { drawCroppedWorldSprite } from "./worldSprite";
import { SEMANTIC_PALETTE } from "../content/palette";
import type { TileEdgePoint } from "../world/palisadeGeometry";
import { palisadeScreenPath, type PalisadeRenderPath } from "./palisadeRenderGeometry";
import type { StoneWallNode } from "./stoneWallTopology";
import { applyInkOutline, applyPaletteStroke, snapToPixel } from "./style";

export function drawGateMarker(
  context: CanvasRenderingContext2D,
  path: PalisadeRenderPath,
  gate: TileEdgePoint,
  zoom: number,
  node?: StoneWallNode,
): void {
  const center = palisadeScreenPath([gate])[0];
  if (!center) return;
  const branches = node ? gatePortalBranches(node) : timberGatePiers(path, gate).map(point => ({ point, pier: true }));
  for (const branch of branches) {
    const point = palisadeScreenPath([branch.point])[0];
    if (!point) continue;
    if (branch.pier) drawPost(context, point, { width: 8, height: 32 }, zoom);
    context.save();
    applyPaletteStroke(context, SEMANTIC_PALETTE.earthDark, zoom);
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(center.x, center.y - 27);
    context.lineTo(point.x, point.y - 27);
    context.stroke();
    context.restore();
  }
}

export function drawPost(
  context: CanvasRenderingContext2D,
  point: { readonly x: number; readonly y: number },
  size: { readonly width: number; readonly height: number },
  zoom: number,
  material: "timber" | "stone" = "timber",
): void {
  context.fillStyle = material === "stone" ? SEMANTIC_PALETTE.stone : SEMANTIC_PALETTE.earth;
  context.fillRect(
    snapToPixel(point.x - size.width / 2),
    snapToPixel(point.y - size.height + 2),
    size.width,
    size.height,
  );
  const timber = material === "timber" ? timberWallTexture() : null;
  if (timber !== null) {
    drawCroppedWorldSprite(context, timber, { x:478,y:500,width:24,height:260 },
      { x:snapToPixel(point.x - size.width / 2), y:snapToPixel(point.y - size.height + 2), width:size.width, height:size.height }, false, true);
  }
  applyInkOutline(context, zoom);
  context.strokeRect(
    snapToPixel(point.x - size.width / 2),
    snapToPixel(point.y - size.height + 2),
    size.width,
    size.height,
  );
}
