import { PALETTE } from "../content/palette";
import { withAlpha } from "./style";
import { drawCroppedWorldSprite } from "./worldSprite";

// Joins X-seamless strip images a | b | c ... into one canvas that repeats without a seam (C1e ridge strips, D3a
// shore strips): each image wraps on its own, so at every join both images are continued across it and crossfaded
// over `fade` source px either side (summed in premultiplied space, "lighter"). Browser only (needs a canvas).

export function joinStripImages(images: readonly HTMLImageElement[], stripWidth: number, stripHeight: number, fade: number): CanvasImageSource | null {
  const width = stripWidth * images.length;
  const joined = canvas2d(width, stripHeight);
  if (joined === null) return images[0] ?? null;
  images.forEach((image, index) => blit(joined.context, image, 0, 0, stripWidth, stripHeight, index * stripWidth, 0));
  images.forEach((left, index) => {
    const right = images[(index + 1) % images.length] as HTMLImageElement;
    const join = ((index + 1) * stripWidth) % width;
    const outgoing = canvas2d(fade * 2, stripHeight); const incoming = canvas2d(fade * 2, stripHeight);
    if (outgoing === null || incoming === null) return;
    // Each image continued across the join (both wrap on their own), weighted 1 -> 0 and 0 -> 1: summed in
    // premultiplied space ("lighter") that is a straight crossfade.
    for (const [target, image] of [[outgoing, left], [incoming, right]] as const) {
      blit(target.context, image, stripWidth - fade, 0, fade, stripHeight, 0, 0);
      blit(target.context, image, 0, 0, fade, stripHeight, fade, 0);
    }
    maskX(outgoing.context, fade * 2, stripHeight, 1, 0);
    maskX(incoming.context, fade * 2, stripHeight, 0, 1);
    for (const offset of join === 0 ? [width - fade, -fade] : [join - fade]) {
      joined.context.clearRect(offset, 0, fade * 2, stripHeight);
      joined.context.globalCompositeOperation = "lighter";
      blit(joined.context, outgoing.canvas, 0, 0, fade * 2, stripHeight, offset, 0);
      blit(joined.context, incoming.canvas, 0, 0, fade * 2, stripHeight, offset, 0);
      joined.context.globalCompositeOperation = "source-over";
    }
  });
  return joined.canvas;
}

function canvas2d(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  return context === null ? null : { canvas, context };
}

function blit(context: CanvasRenderingContext2D, image: CanvasImageSource, sx: number, sy: number, width: number, height: number, dx: number, dy: number): void {
  drawCroppedWorldSprite(context, image, { x: sx, y: sy, width, height }, { x: dx, y: dy, width, height }, false, false);
}

/** Multiplies alpha by a linear ramp along x, one texel column at a time (the render guards keep gradients out). */
function maskX(context: CanvasRenderingContext2D, width: number, height: number, from: number, to: number): void {
  context.globalCompositeOperation = "destination-in";
  for (let column = 0; column < width; column += 1) {
    context.fillStyle = withAlpha(PALETTE.ink, from + (to - from) * (column + 0.5) / width);
    context.beginPath(); context.rect(column, 0, 1, height); context.fill();
  }
  context.globalCompositeOperation = "source-over";
}

