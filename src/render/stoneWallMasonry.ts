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
        context.transform((b.x - a.x) / length, (b.y - a.y) / length, 0, 1, a.x, a.y - base - height);
        for (let x = 0; x < length; x += 3) {
          for (let y = 0; y < height; y += 9) context.drawImage(material.image, 0, 0, 60, 180, x, y, 3, 9);
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
}
