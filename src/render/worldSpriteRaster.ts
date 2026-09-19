import { createTintCanvas, drawCroppedWorldSprite } from "./worldSprite";

export type RasterizedWorldSprite = Readonly<{
  image: CanvasImageSource;
  source: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;

/** A bounded runtime thumbnail avoids repeatedly filtering a high-resolution crop. */
export function rasterizeWorldSprite(image: CanvasImageSource, source: Readonly<{ x: number; y: number; width: number; height: number }>, height: number): RasterizedWorldSprite | null {
  const width = Math.max(1, Math.round(source.width / source.height * height));
  const canvas = createTintCanvas(width, height);
  const context = canvas?.getContext("2d");
  if (canvas === null || context === null || context === undefined) return null;
  const destination = { x: 0, y: 0, width, height };
  drawCroppedWorldSprite(context, image, source, destination, false, true);
  return { image: canvas, source: destination };
}
