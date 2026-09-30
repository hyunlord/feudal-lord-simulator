import assert from "node:assert/strict";
import test from "node:test";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { drawBuildingOverlays } from "../src/render/buildingOverlays";
import { drawBuildingSprite, fittedBuildingSpriteRect } from "../src/render/buildingSpriteFit";
import { setBuildingVariantsEnabled } from "../src/render/buildingVariants";
import { granaryVariantAssignments } from "../src/render/granaryVariantChoice";
import { resetSeasonBlendForTest } from "../src/render/seasonTransition";
import { buildingStockPiles } from "../src/render/stockPiles";
import { beginGranaryVariantFrame, preloadWave32GranaryLayers, preloadWave32GranaryPaintings } from "../src/render/wave32GranaryArt";
import { WAVE32_GRANARY_IMAGES } from "../src/render/wave32GranaryManifest.generated";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

// INSTALL-32 on the canvas: a granary draws its Wave 32 painting in barn.png's fitted rect, then its own layers in the
// precedence of granaryVariantChoice.ts, and the Wave 7 door sacks leave it; with variants off it is barn.png again.

class LoadedImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  url = "";
  set src(value: string) {
    this.url = value.replace(/^\/+/, "");
    const wave32 = Object.values(WAVE32_GRANARY_IMAGES).find(image => image.url === this.url);
    this.naturalWidth = wave32?.width ?? 160;
    this.naturalHeight = wave32?.height ?? 144;
    queueMicrotask(() => this.onload?.());
  }
}

type Draw = { readonly url: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number };
function recorder() {
  const drawn: Draw[] = [];
  const values: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const context = new Proxy({}, {
    get: (_target, key) => key === "drawImage" ? (image: { url?: string }, ...args: number[]) => {
      const [x, y, width, height] = args.length >= 8 ? args.slice(4) : args;
      drawn.push({ url: image.url ?? "raster", x: x!, y: y!, width: width!, height: height! });
    }
      : key === "getTransform" ? () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      : key in values ? values[key] : () => undefined,
    set: (_target, key, value) => { values[key] = value; return true; },
  }) as CanvasRenderingContext2D;
  return { context, drawn };
}

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const granary = (fields: Partial<Building>): Building =>
  ({ id: "construction-site-000023", kind: "granary", tx: 20, ty: 20, workers: 2, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...fields }) as Building;

test("a granary's painting in the barn's fitted rect, its layers in order, no Wave 7 sacks; barn.png with variants off", async () => {
  (globalThis as unknown as { Image: unknown }).Image = LoadedImage;
  await preloadWave32GranaryPaintings();
  preloadWave32GranaryLayers();
  await flush();
  resetSeasonBlendForTest();
  const full = granary({ workers: 1, inventory: { wheat: 90, bread: 60 } });
  const state: GameState = { ...DEFAULT_GAME_STATE, tick: 12 * 4_000 + 3_500, buildings: [...DEFAULT_GAME_STATE.buildings, full] };
  const variant = granaryVariantAssignments(state).get(full.id)!;
  beginGranaryVariantFrame(state);
  const rect = fittedBuildingSpriteRect("barn", full);
  const body = recorder();
  assert.equal(drawBuildingSprite(body.context, full, "barn", {}), true);
  assert.equal(body.drawn.length, 1, "the painting, in one blit");
  assert.equal(body.drawn[0]!.url, WAVE32_GRANARY_IMAGES[variant.key].url);
  const at = (draw: Draw) => [draw.x, draw.y, draw.width, draw.height].map(value => Math.round(value * 100) / 100);
  assert.deepEqual(at(body.drawn[0]!), at({ url: "", ...rect }), "barn.png's fitted rect: footprint, pivot and depth unchanged");
  // Winter, one hand short, 150 / 200: weathered, full, snow — every layer on the same rect.
  const overlays = recorder();
  drawBuildingOverlays(overlays.context, state, full);
  const layers = overlays.drawn.filter(draw => draw.url.includes("wave32"));
  assert.deepEqual(layers.map(draw => draw.url), ["weathered", "full", "snow"].map(layer => `assets/wave32/granary/${variant.key}_${layer}.png`));
  for (const layer of layers) assert.deepEqual(at(layer), at(body.drawn[0]!));
  assert.deepEqual(buildingStockPiles(state, full), [], "the stock is in the painting, not in Wave 7 sacks at the door");
  // Shut: the boards on the closed door, no fill.
  const shut = { ...full, operationPaused: true as const, workers: 0 };
  const boarded = recorder();
  drawBuildingOverlays(boarded.context, { ...state, buildings: [...DEFAULT_GAME_STATE.buildings, shut] }, shut);
  assert.deepEqual(boarded.drawn.filter(draw => draw.url.includes("wave32")).map(draw => draw.url.replace(/.*_/, "")), ["boarded.png", "snow.png"]);
  // Variants off (tests pinning the base art): barn.png and its Wave 7 sacks, no Wave 32 layer.
  setBuildingVariantsEnabled(false);
  try {
    const base = recorder();
    drawBuildingSprite(base.context, full, "barn", {});
    assert.ok(base.drawn.every(draw => !draw.url.includes("wave32")), base.drawn.map(draw => draw.url).join());
    const bare = recorder();
    drawBuildingOverlays(bare.context, state, full);
    assert.ok(bare.drawn.every(draw => !draw.url.includes("wave32")));
    assert.deepEqual(buildingStockPiles(state, full).map(pile => pile.key), ["pile_sacks_2"]);
  } finally {
    setBuildingVariantsEnabled(true);
    resetSeasonBlendForTest();
  }
});
