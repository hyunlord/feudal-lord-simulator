import { canvasBudget, type BudgetOwner } from "./canvasBudget";

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
// SMOOTH-2R: each scaled copy is an entry of the canvas budget (canvasBudget.ts); pushed out, it is made again on use.
const budgetKeys = new WeakMap<HTMLImageElement, string>();
const budgetEntries = new Map<string, { readonly source: WeakRef<HTMLImageElement>; readonly cacheKey: string }>();
let budgetSerial = 0;
const owner: BudgetOwner = {
  name: "asset-scale",
  evict(key) {
    const entry = budgetEntries.get(key);
    budgetEntries.delete(key);
    const source = entry?.source.deref();
    if (entry !== undefined && source !== undefined) scaledSourceCache.get(source)?.delete(entry.cacheKey);
  },
};

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
  let sourceKey = budgetKeys.get(input.source);
  if (sourceKey === undefined) { sourceKey = `s${budgetSerial++}`; budgetKeys.set(input.source, sourceKey); }
  const cached = scaledSourceCache.get(input.source)?.get(cacheKey);
  if (cached !== undefined) { canvasBudget.touch(owner, `${sourceKey}:${cacheKey}`, "onscreen"); return cached; }
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
  budgetEntries.set(`${sourceKey}:${cacheKey}`, { source: new WeakRef(input.source), cacheKey });
  canvasBudget.track(owner, `${sourceKey}:${cacheKey}`, dimensions.width * dimensions.height * 4, "onscreen");
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
