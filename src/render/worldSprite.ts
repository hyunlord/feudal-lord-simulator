import { runtimeAssetCrop } from "./runtimeAssetCoordinates";
import { snapPointToDevicePixel, type CanvasTransform } from "./style";
import type { CameraState } from "./camera";
import { worldToCanvas } from "./camera";
import { tileToScreen } from "./iso";
import { RAMPS, type PaletteColor } from "../content/palette";
import { getSprite, spriteMetaView } from "./worldAssets";
import { recordWorldSpriteDraw } from "./worldSpriteDiagnostics";
import { mippedSprite, spriteMipWorldScale } from "./spriteMipCache";

export type WorldSpriteOptions = {
  readonly camera?: CameraState;
  readonly dpr?: number;
  readonly scale?: number;
  readonly alpha?: number;
  readonly flipX?: boolean;
  readonly viewport?: { readonly width: number; readonly height: number };
  /** Same-size replacement image drawn with this sprite's registration (visual variants). */
  readonly image?: CanvasImageSource | null;
};

export type WorldSpriteContext = {
  readonly canvas: { readonly width: number; readonly height: number };
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, width: number, height: number): void;
  drawImage(image: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, width: number, height: number): void;
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
  const meta = spriteMetaView(key);
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
  const meta = spriteMetaView(key);
  if (meta === null) {
    recordWorldSpriteDraw({ key, drawn: false, reason: "meta_missing" });
    return false;
  }
  const image = options.image ?? getSprite(key);
  if (image === null) {
    recordWorldSpriteDraw({ key, drawn: false, reason: "image_missing" });
    return false;
  }

  const rect = destinationRect(meta, tx, ty, options);
  if (isCulled(rect, deviceViewport(context, options))) {
    recordWorldSpriteDraw({ key, drawn: false, reason: "culled" });
    return false;
  }

  // NAT-2 QA-008: from the mip level of the device size (spriteMipCache.ts) when it is under half the image's.
  const width = (image as { readonly width?: number }).width ?? 0;
  const mip = width > 0 && rect.width < width / 2 ? mippedSprite(image, { x: 0, y: 0, width, height: (image as { readonly height: number }).height }, rect.width / width) : null;
  context.save();
  try {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha *= options.alpha ?? 1;
    context.imageSmoothingEnabled = false;
    if (options.flipX === true) {
      context.setTransform(-1, 0, 0, 1, rect.dx + rect.width, 0);
      drawWhole(context, mip, image, 0, rect.dy, rect.width, rect.height);
    } else {
      drawWhole(context, mip, image, rect.dx, rect.dy, rect.width, rect.height);
    }
  } finally {
    context.restore();
  }
  recordWorldSpriteDraw({ key, drawn: true, reason: "drawn" });
  return true;
}

function drawWhole(context: WorldSpriteContext, mip: ReturnType<typeof mippedSprite> | null, image: CanvasImageSource,
  dx: number, dy: number, width: number, height: number): void {
  if (mip === null || mip.image === image) context.drawImage(image, dx, dy, width, height);
  else context.drawImage(mip.image, mip.crop.x, mip.crop.y, mip.crop.width, mip.crop.height, dx, dy, width, height);
}

type SpriteCropRect = Readonly<{ x: number; y: number; width: number; height: number }>;

/** Blit an authored region in world coordinates, retaining the caller's camera transform. */
export function drawCroppedWorldSprite(
  context: Pick<CanvasRenderingContext2D, "drawImage" | "save" | "restore" | "imageSmoothingEnabled"> & { getTransform(): CanvasTransform },
  image: CanvasImageSource,
  source: SpriteCropRect,
  destination: SpriteCropRect,
  snap = true,
  smoothing = false,
  transform?: CanvasTransform,
): void {
  // SMOOTH-2R: only a snapped blit needs the transform; `transform` (the context's current one, when the caller holds
  // it) spares the DOMMatrix each getTransform() allocates.
  const t = snap ? transform ?? context.getTransform() : null;
  const origin = t === null ? destination : snapPointToDevicePixel(destination, t);
  const scaleX = t === null ? 0 : Math.hypot(t.a, t.b);
  const scaleY = t === null ? 0 : Math.hypot(t.c, t.d);
  const width = scaleX > 0 ? Math.round(destination.width * scaleX) / scaleX : destination.width;
  const height = scaleY > 0 ? Math.round(destination.height * scaleY) / scaleY : destination.height;
  context.save();
  try {
    context.imageSmoothingEnabled = smoothing;
    const crop = runtimeAssetCrop(image, source);
    // NAT-2 QA-008: a world blit of the object pass draws from the mip level of its device size (spriteMipCache.ts).
    const worldScale = smoothing ? spriteMipWorldScale(context) : null;
    const mip = worldScale === null || crop.width <= 0 ? null : mippedSprite(image, crop, worldScale * width / crop.width);
    if (mip === null) context.drawImage(image, crop.x, crop.y, crop.width, crop.height, origin.x, origin.y, width, height);
    else context.drawImage(mip.image, mip.crop.x, mip.crop.y, mip.crop.width, mip.crop.height, origin.x, origin.y, width, height);
  } finally {
    context.restore();
  }
}

/**
 * The tree tone's foliage ramp tint: recolours only the pixels that are exactly a foliage ramp colour. SMOOTH-2R: it
 * no longer runs on sprites while the game plays (it read every tinted sprite back with getImageData: 34 reads, 0.3 s
 * in the big town's first 30 s). The painted foliage art has no pixel of a ramp colour — counted per sprite at build
 * time (pixelFacts.generated.ts FOLIAGE_RAMP_PIXELS, all 0; scripts/buildPixelFacts.ts stops if one ever has some) and
 * measured in Chrome on the six trees' downscaled sprites in all six tones (0 pixels changed) — so the tinted sprite
 * was the sprite itself, and the tint option is gone.
 */
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

export function createTintCanvas(
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
  meta: NonNullable<ReturnType<typeof spriteMetaView>>,
  tx: number,
  ty: number,
  options: WorldSpriteOptions,
): DeviceRect {
  const camera = options.camera ?? DEFAULT_CAMERA;
  const dpr = options.dpr ?? 1;
  const scale = options.scale ?? 1;
  const anchor = tileToScreen(tx, ty);
  const canvasAnchor = worldToCanvas({ x: anchor.sx, y: anchor.sy }, camera);
  const zoomScale = camera.zoom * scale * meta.renderScale;
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
