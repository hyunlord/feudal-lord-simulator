import type { CameraState } from "./camera";
import { worldToCanvas } from "./camera";
import { tileToScreen } from "./iso";
import { RAMPS, type PaletteColor } from "../content/palette";
import { getSprite, spriteMeta } from "./worldAssets";

export type WorldSpriteOptions = {
  readonly camera?: CameraState;
  readonly dpr?: number;
  readonly scale?: number;
  readonly alpha?: number;
  readonly tint?: PaletteColor;
  readonly viewport?: { readonly width: number; readonly height: number };
};

export type WorldSpriteContext = {
  readonly canvas: { readonly width: number; readonly height: number };
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, width: number, height: number): void;
};

type DeviceRect = {
  readonly dx: number;
  readonly dy: number;
  readonly width: number;
  readonly height: number;
};
export type RampTintPixel = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
};

const DEFAULT_CAMERA = { zoom: 1, panX: 0, panY: 0 } as const satisfies CameraState;
const tintedSpriteCache = new WeakMap<CanvasImageSource, Map<PaletteColor, CanvasImageSource>>();
const FOLIAGE_RGB_TO_SHADE = new Map(RAMPS.foliage.map((hex, shade) => [hexToRgbKey(hex), shade]));
const TIMBER_RGB_KEYS = new Set(RAMPS.timber.map(hexToRgbKey));
const NEUTRAL_FOLIAGE_TINT_SHADE = 4;

export function drawWorldSprite(
  context: WorldSpriteContext,
  key: string,
  tx: number,
  ty: number,
  options: WorldSpriteOptions = {},
): boolean {
  const meta = spriteMeta(key);
  if (meta === null) return false;
  return drawAtWorldAnchor(
    context,
    key,
    tx + meta.footprint.width - 1,
    ty + meta.footprint.height - 1,
    options,
  );
}

export function drawWorldSpriteAtWorldAnchor(
  context: WorldSpriteContext,
  key: string,
  tx: number,
  ty: number,
  options: WorldSpriteOptions = {},
): boolean {
  return drawAtWorldAnchor(context, key, tx, ty, options);
}

function drawAtWorldAnchor(
  context: WorldSpriteContext,
  key: string,
  tx: number,
  ty: number,
  options: WorldSpriteOptions,
): boolean {
  const image = getSprite(key);
  const meta = spriteMeta(key);
  if (image === null || meta === null) return false;

  const rect = destinationRect(meta, tx, ty, options);
  if (isCulled(rect, deviceViewport(context, options))) return false;
  const source = options.tint === undefined ? image : tintedSprite(image, meta, options.tint);

  context.save();
  try {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha *= options.alpha ?? 1;
    context.imageSmoothingEnabled = false;
    context.drawImage(source, rect.dx, rect.dy, rect.width, rect.height);
  } finally {
    context.restore();
  }
  return true;
}

function tintedSprite(
  image: CanvasImageSource,
  meta: NonNullable<ReturnType<typeof spriteMeta>>,
  tint: PaletteColor,
): CanvasImageSource {
  const cached = tintedSpriteCache.get(image)?.get(tint);
  if (cached !== undefined) return cached;
  const canvas = createTintCanvas(meta.width, meta.height);
  if (canvas === null) return image;
  const tintContext = canvas.getContext("2d");
  if (tintContext === null) return image;
  tintContext.imageSmoothingEnabled = false;
  tintContext.drawImage(image, 0, 0, meta.width, meta.height);
  tintContext.putImageData(tintImageData(tintContext.getImageData(0, 0, meta.width, meta.height), tint), 0, 0);
  const imageCache = tintedSpriteCache.get(image) ?? new Map<PaletteColor, CanvasImageSource>();
  imageCache.set(tint, canvas);
  tintedSpriteCache.set(image, imageCache);
  return canvas;
}

export function foliageRampTintPixels(
  pixels: readonly RampTintPixel[],
  tint: PaletteColor,
): readonly RampTintPixel[] {
  const tintShade = FOLIAGE_RGB_TO_SHADE.get(hexToRgbKey(tint));
  if (tintShade === undefined) return pixels;
  return pixels.map((pixel) => {
    const key = rgbKey(pixel.r, pixel.g, pixel.b);
    const sourceShade = FOLIAGE_RGB_TO_SHADE.get(key);
    if (sourceShade === undefined || TIMBER_RGB_KEYS.has(key)) return pixel;
    const outputShade = Math.max(
      0,
      Math.min(RAMPS.foliage.length - 1, sourceShade + tintShade - NEUTRAL_FOLIAGE_TINT_SHADE),
    );
    const targetHex = RAMPS.foliage[outputShade] ?? tint;
    const [r, g, b] = hexToRgb(targetHex);
    return { r, g, b, a: pixel.a };
  });
}

function tintImageData(imageData: ImageData, tint: PaletteColor): ImageData {
  const pixels: RampTintPixel[] = [];
  for (let index = 0; index < imageData.data.length; index += 4) {
    pixels.push({
      r: imageData.data[index] ?? 0,
      g: imageData.data[index + 1] ?? 0,
      b: imageData.data[index + 2] ?? 0,
      a: imageData.data[index + 3] ?? 0,
    });
  }
  foliageRampTintPixels(pixels, tint).forEach((pixel, pixelIndex) => {
    const index = pixelIndex * 4;
    imageData.data[index] = pixel.r;
    imageData.data[index + 1] = pixel.g;
    imageData.data[index + 2] = pixel.b;
    imageData.data[index + 3] = pixel.a;
  });
  return imageData;
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const parsed = Number.parseInt(hex.slice(1), 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

function hexToRgbKey(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbKey(r, g, b);
}

function rgbKey(r: number, g: number, b: number): string {
  return `${r},${g},${b}`;
}

function createTintCanvas(
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement | null {
  if (typeof globalThis.OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height);
  }
  const document = globalThis.document;
  if (document === undefined) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function destinationRect(
  meta: NonNullable<ReturnType<typeof spriteMeta>>,
  tx: number,
  ty: number,
  options: WorldSpriteOptions,
): DeviceRect {
  const camera = options.camera ?? DEFAULT_CAMERA;
  const dpr = options.dpr ?? 1;
  const scale = options.scale ?? 1;
  const anchor = tileToScreen(tx, ty);
  const canvasAnchor = worldToCanvas({ x: anchor.sx, y: anchor.sy }, camera);
  const zoomScale = camera.zoom * scale;
  return {
    dx: Math.round((canvasAnchor.x - meta.anchor.x * zoomScale) * dpr),
    dy: Math.round((canvasAnchor.y - meta.anchor.y * zoomScale) * dpr),
    width: Math.round(meta.width * zoomScale * dpr),
    height: Math.round(meta.height * zoomScale * dpr),
  };
}

function deviceViewport(
  context: WorldSpriteContext,
  options: WorldSpriteOptions,
): { readonly width: number; readonly height: number } {
  const dpr = options.dpr ?? 1;
  if (options.viewport !== undefined) {
    return {
      width: Math.round(options.viewport.width * dpr),
      height: Math.round(options.viewport.height * dpr),
    };
  }
  return { width: context.canvas.width, height: context.canvas.height };
}

function isCulled(
  rect: DeviceRect,
  viewport: { readonly width: number; readonly height: number },
): boolean {
  return (
    rect.dx + rect.width <= 0 ||
    rect.dy + rect.height <= 0 ||
    rect.dx >= viewport.width ||
    rect.dy >= viewport.height
  );
}
