import type { CameraState } from "./camera";
import { worldToCanvas } from "./camera";
import { tileToScreen } from "./iso";
import { getSprite, spriteMeta } from "./worldAssets";

export type WorldSpriteOptions = {
  readonly camera?: CameraState;
  readonly dpr?: number;
  readonly scale?: number;
  readonly alpha?: number;
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

const DEFAULT_CAMERA = { zoom: 1, panX: 0, panY: 0 } as const satisfies CameraState;

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

  context.save();
  try {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha *= options.alpha ?? 1;
    context.imageSmoothingEnabled = false;
    context.drawImage(image, rect.dx, rect.dy, rect.width, rect.height);
  } finally {
    context.restore();
  }
  return true;
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
