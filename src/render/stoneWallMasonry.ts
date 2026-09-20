import type { RasterizedWorldSprite } from "./worldSpriteRaster";
import { drawCroppedWorldSprite } from "./worldSprite";
import { RAMPS, SEMANTIC_PALETTE } from "../content/palette";
import { applyPaletteStroke } from "./style";
import type { StoneWallSolid } from "./stoneWallFallbackGeometry";

export function drawMasonrySolid(context: CanvasRenderingContext2D, solid: StoneWallSolid, material: RasterizedWorldSprite | null = null, tileMaterial = false): void {
  const { footprint, base, height } = solid;
  const opacity = context.globalAlpha;
  const faces = footprint.map((point, index) => ({ a: point, b: footprint[(index + 1) % 4] }))
    .filter((face): face is { a: typeof footprint[0]; b: typeof footprint[0] } => face.b !== undefined)
    .sort((a, b) => (a.a.y + a.b.y) - (b.a.y + b.b.y));
  for (const { a, b } of faces) {
    context.fillStyle = b.x < a.x ? SEMANTIC_PALETTE.stoneDark : SEMANTIC_PALETTE.stone;
    context.beginPath();
    context.moveTo(a.x, a.y - base);
    context.lineTo(b.x, b.y - base);
    context.lineTo(b.x, b.y - base - height);
    context.lineTo(a.x, a.y - base - height);
    context.closePath();
    context.fill();
    if (material !== null) {
      context.save();
      context.clip();
      const length = Math.max(2, Math.hypot(b.x - a.x, b.y - a.y));
      if (tileMaterial) {
        const direction = b.x < a.x || (b.x === a.x && b.y < a.y) ? -1 : 1;
        const faceLength = Math.hypot(b.x - a.x, b.y - a.y);
        const tx = (b.x - a.x) / faceLength * direction;
        const ty = (b.y - a.y) / faceLength * direction;
        const start = a.x * tx + a.y * ty;
        const end = b.x * tx + b.y * ty;
        context.transform(tx, ty, 0, 1, a.x - tx * start, a.y - ty * start);
        for (let x = Math.floor(Math.min(start, end) / 3) * 3; x < Math.max(start, end); x += 3) {
          for (let y = Math.floor(-(base + height) / 9) * 9; y < -base; y += 9) {
            drawCroppedWorldSprite(context, material.image,
              { x: 0, y: 0, width: 60, height: 180 }, { x, y, width: 3, height: 9 }, false, true);
          }
        }
        context.restore();
        continue;
      }
      const sampleHeight = Math.min(180, height * 60 / length);
      context.transform((b.x - a.x) / 60, (b.y - a.y) / 60, 0, height / sampleHeight, a.x, a.y - base - height);
      drawCroppedWorldSprite(context, material.image, { x: 0, y: 0, width: 60, height: sampleHeight },
        { x: 0, y: 0, width: 60, height: sampleHeight }, false);
      context.restore();
    }
    if (base > 0 || material !== null) continue;
    applyPaletteStroke(context, RAMPS.stone[1], 1);
    context.globalAlpha = opacity * 0.32;
    for (let course = 4; course < height; course += 4) {
      context.beginPath();
      context.moveTo(a.x, a.y - course);
      context.lineTo(b.x, b.y - course);
      context.stroke();
      const divisions = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 8));
      for (let joint = 0; joint < divisions; joint += 1) {
        const t = (joint + (course % 8 === 0 ? 0.7 : 0.25)) / divisions;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t - course;
        context.beginPath(); context.moveTo(x, y); context.lineTo(x, y + 3); context.stroke();
      }
    }
    context.globalAlpha = opacity;
  }
  context.fillStyle = RAMPS.stone[3];
  context.beginPath();
  for (const [index, point] of footprint.entries()) {
    if (index === 0) context.moveTo(point.x, point.y - base - height);
    else context.lineTo(point.x, point.y - base - height);
  }
  context.closePath();
  context.fill();
  if (material !== null && tileMaterial) {
    context.save();
    context.clip();
    const us = footprint.map(point => point.x / 2 + point.y);
    const vs = footprint.map(point => point.y - point.x / 2);
    context.transform(1, 0.5, -1, 0.5, 0, -base - height);
    for (let u = Math.floor(Math.min(...us) / 3) * 3; u < Math.max(...us); u += 3) {
      for (let v = Math.floor(Math.min(...vs) / 3) * 3; v < Math.max(...vs); v += 3) {
        drawCroppedWorldSprite(context, material.image,
          { x: 0, y: 0, width: 60, height: 60 }, { x: u, y: v, width: 3, height: 3 }, false, true);
      }
    }
    context.restore();
    context.save();
    context.globalAlpha = opacity * 0.22;
    context.fillStyle = RAMPS.stone[4];
    context.fill();
    context.restore();
  }
}
