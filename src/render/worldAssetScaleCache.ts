export type ScaledSourceInput = {
  readonly source: HTMLImageElement;
  readonly width: number;
  readonly height: number;
  readonly renderScale: number;
};

export type ScaledSourceDimensions = {
  readonly width: number;
  readonly height: number;
};

const scaledSourceCache = new WeakMap<HTMLImageElement, Map<string, CanvasImageSource>>();

export const scaledSourceDimensions = (input: {
  readonly width: number;
  readonly height: number;
  readonly renderScale: number;
}): ScaledSourceDimensions => ({
  width: Math.max(1, Math.round(input.width * input.renderScale)),
  height: Math.max(1, Math.round(input.height * input.renderScale)),
});

export function scaledWorldAssetSource(input: ScaledSourceInput): CanvasImageSource {
  if (input.renderScale === 1) return input.source;
  const dimensions = scaledSourceDimensions(input);
  const cacheKey = `${dimensions.width}x${dimensions.height}:${input.renderScale}`;
  const cached = scaledSourceCache.get(input.source)?.get(cacheKey);
  if (cached !== undefined) return cached;
  const canvas = createScaleCanvas(dimensions);
  if (canvas === null) return input.source;
  const context = canvas.getContext("2d");
  if (context === null) return input.source;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(input.source, 0, 0, dimensions.width, dimensions.height);
  const sourceCache = scaledSourceCache.get(input.source) ?? new Map<string, CanvasImageSource>();
  sourceCache.set(cacheKey, canvas);
  scaledSourceCache.set(input.source, sourceCache);
  return canvas;
}

function createScaleCanvas(
  dimensions: ScaledSourceDimensions,
): OffscreenCanvas | HTMLCanvasElement | null {
  if (typeof globalThis.OffscreenCanvas === "function") {
    return new OffscreenCanvas(dimensions.width, dimensions.height);
  }
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  return canvas;
}
