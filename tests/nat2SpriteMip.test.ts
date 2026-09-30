import assert from "node:assert/strict";
import test from "node:test";
import { BLOCKS_MAX_ZOOM, renderDetailLevel } from "../src/render/buildingVisualState";
import { canvasBudget } from "../src/render/canvasBudget";
import {
  beginSpriteMipFrame, endSpriteMipFrame, markSpriteImmutable, mippedSprite, MIPS_PER_FRAME, spriteMipLevel, spriteMipStats,
  spriteMipWorldScale,
} from "../src/render/spriteMipCache";
import { spriteMetaView, worldAssetStatuses } from "../src/render/worldAssets";
import { drawCroppedWorldSprite, drawWorldSpriteAtWorldAnchor } from "../src/render/worldSprite";

// NAT-2 QA-008: the zoomed-out town keeps its painted art, drawn from pre-shrunk copies (spriteMipCache.ts).

type Draw = { readonly image: unknown; readonly args: readonly number[] };

/** OffscreenCanvas stand-in: records each canvas made and what is drawn into it. */
function withTestCanvas<T>(run: (made: TestCanvas[]) => T): T {
  const made: TestCanvas[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, "OffscreenCanvas");
  class Canvas extends TestCanvas { constructor(width: number, height: number) { super(width, height); made.push(this); } }
  Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Canvas });
  try { return run(made); } finally {
    if (previous) Object.defineProperty(globalThis, "OffscreenCanvas", previous);
    else Reflect.deleteProperty(globalThis, "OffscreenCanvas");
  }
}

class TestCanvas {
  readonly draws: Draw[] = [];
  quality = "";
  constructor(readonly width: number, readonly height: number) {}
  getContext() {
    const canvas = this;
    return {
      imageSmoothingEnabled: false,
      set imageSmoothingQuality(value: string) { canvas.quality = value; },
      drawImage: (image: unknown, ...args: number[]) => { canvas.draws.push({ image, args }); },
    };
  }
}

/** An immutable source canvas (as rasterizeWorldSprite makes) of `width` x `height`. */
const sprite = (width: number, height: number) => markSpriteImmutable({ width, height }) as unknown as CanvasImageSource;

test("Given a zoom When its detail level is chosen Then blocks are only on the strategic map (<= 0.35)", () => {
  assert.equal(BLOCKS_MAX_ZOOM, 0.35);
  assert.deepEqual([0.25, 0.3, 0.35].map(renderDetailLevel), ["blocks", "blocks", "blocks"]);
  // 0.5 is the game's widest camera (MIN_ZOOM): painted, never blocks.
  assert.deepEqual([0.351, 0.4, 0.5, 0.6, 0.7].map(renderDetailLevel), ["simplified", "simplified", "simplified", "simplified", "simplified"]);
  assert.deepEqual([0.7001, 1, 1.4].map(renderDetailLevel), ["full", "full", "full"]);
});

test("Given a draw's device scale When its mip level is chosen Then it is the smallest level at least that large", () => {
  // Level 1 down to half size (a draw samples at most 2x down), the 0.5 level to a quarter, then the 0.25 level.
  assert.deepEqual([2, 1, 0.6, 0.5].map(spriteMipLevel), [1, 1, 1, 1]);
  assert.deepEqual([0.49, 0.3, 0.25].map(spriteMipLevel), [0.5, 0.5, 0.5]);
  assert.deepEqual([0.24, 0.15, 0.05].map(spriteMipLevel), [0.25, 0.25, 0.25]);
  assert.equal(spriteMipLevel(Number.NaN), 1);
});

test("Given an immutable sprite When it is drawn small Then the level is made once, halved in steps, and its bytes join the canvas budget", () => {
  withTestCanvas(made => {
    canvasBudget.clear();
    beginSpriteMipFrame({}, 1);
    const image = sprite(200, 120);
    const crop = { x: 20, y: 40, width: 100, height: 60 };
    const before = spriteMipStats();

    // A 0.3 draw: the 0.5 level, the crop in its pixels.
    const half = mippedSprite(image, crop, 0.3);
    assert.equal(made.length, 1);
    assert.equal(half.image, made[0]);
    assert.deepEqual([made[0]!.width, made[0]!.height], [100, 60]);
    assert.deepEqual(half.crop, { x: 10, y: 20, width: 50, height: 30 });
    assert.equal(made[0]!.draws[0]!.image, image, "the 0.5 level is drawn from the sprite");
    assert.equal(made[0]!.quality, "high");
    assert.equal(canvasBudget.stats().byOwner["sprite-mip"], 100 * 60 * 4);

    // Again: served from the cache, nothing new made.
    assert.equal(mippedSprite(image, crop, 0.4).image, made[0]);
    assert.equal(made.length, 1);

    // A 0.2 draw: the 0.25 level, halved from the 0.5 one.
    const quarter = mippedSprite(image, crop, 0.2);
    assert.equal(made.length, 2);
    assert.equal(quarter.image, made[1]);
    assert.deepEqual([made[1]!.width, made[1]!.height], [50, 30]);
    assert.equal(made[1]!.draws[0]!.image, made[0], "the 0.25 level is drawn from the 0.5 level");
    assert.deepEqual(quarter.crop, { x: 5, y: 10, width: 25, height: 15 });
    assert.equal(canvasBudget.stats().byOwner["sprite-mip"], 100 * 60 * 4 + 50 * 30 * 4);

    const after = spriteMipStats();
    assert.equal(after.made - before.made, 2);
    assert.equal(after.hits - before.hits, 2); // the second 0.5 draw, and the 0.5 parent of the 0.25 level
    endSpriteMipFrame();
    canvasBudget.clear();
  });
});

test("Given a draw at half size or more, a canvas that may change, or a tiny crop When mipped Then the image itself is drawn", () => {
  withTestCanvas(made => {
    beginSpriteMipFrame({}, 1);
    const image = sprite(200, 120);
    const crop = { x: 0, y: 0, width: 200, height: 120 };
    assert.equal(mippedSprite(image, crop, 0.5).image, image);
    // A canvas not marked immutable (a pooled chunk, a composed walker cell) is never mipped.
    const pooled = { width: 200, height: 120 } as unknown as CanvasImageSource;
    assert.equal(mippedSprite(pooled, crop, 0.2).image, pooled);
    assert.equal(made.length, 0);
    // A 32 px sheet cell at 0.2: the 0.25 level would make it 8 px (cells bleed), so the 0.5 level (16 px).
    const cell = mippedSprite(image, { x: 32, y: 0, width: 32, height: 32 }, 0.2);
    assert.equal(made.length, 1);
    assert.equal(made[0]!.width, 100);
    assert.deepEqual(cell.crop, { x: 16, y: 0, width: 16, height: 16 });
    endSpriteMipFrame();
    canvasBudget.clear();
  });
});

test("Given many new sprites in one frame When mipped Then at most MIPS_PER_FRAME levels are made that frame", () => {
  withTestCanvas(made => {
    beginSpriteMipFrame({}, 1);
    const images = Array.from({ length: MIPS_PER_FRAME + 3 }, () => sprite(64, 64));
    const drawn = images.map(image => mippedSprite(image, { x: 0, y: 0, width: 64, height: 64 }, 0.3).image);
    assert.equal(made.length, MIPS_PER_FRAME);
    assert.deepEqual(drawn.slice(MIPS_PER_FRAME), images.slice(MIPS_PER_FRAME), "the rest draw from their image");
    beginSpriteMipFrame({}, 1);
    mippedSprite(images[MIPS_PER_FRAME]!, { x: 0, y: 0, width: 64, height: 64 }, 0.3);
    assert.equal(made.length, MIPS_PER_FRAME + 1, "made on a later frame");
    endSpriteMipFrame();
    canvasBudget.clear();
  });
});

test("Given the object pass on a context When a world blit is drawn small Then it samples the mip level, other contexts the image", () => {
  withTestCanvas(made => {
    const draws: Draw[] = [];
    const context = {
      imageSmoothingEnabled: false, save() {}, restore() {},
      getTransform: () => ({ a: 0.6, b: 0, c: 0, d: 0.6, e: 0, f: 0 }),
      drawImage: (image: unknown, ...args: number[]) => { draws.push({ image, args }); },
    };
    const image = sprite(200, 100);
    beginSpriteMipFrame(context, 0.6);
    assert.equal(spriteMipWorldScale(context), 0.6);
    assert.equal(spriteMipWorldScale({}), null);
    // 50 world px wide at 0.6: 30 device px from 200 image px, a 0.15 device scale: the 0.25 level (50 x 25).
    drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: 200, height: 100 }, { x: 10, y: 20, width: 50, height: 25 }, false, true);
    assert.equal(draws[0]!.image, made[1]);
    assert.deepEqual(draws[0]!.args, [0, 0, 50, 25, 10, 20, 50, 25]);
    endSpriteMipFrame();
    // Outside the object pass (an offscreen raster, another pass): the image.
    drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: 200, height: 100 }, { x: 10, y: 20, width: 50, height: 25 }, false, true);
    assert.equal(draws[1]!.image, image);
    canvasBudget.clear();
  });
});

test("Given a tree drawn at its world anchor at zoom 0.3 When drawn Then it samples the 0.5 level of its raster", () => {
  withTestCanvas(made => {
    const key = worldAssetStatuses().find(status => status.category === "foliage")!.key;
    const meta = spriteMetaView(key)!;
    const raster = sprite(Math.round(meta.width * meta.renderScale), Math.round(meta.height * meta.renderScale));
    const draws: Draw[] = [];
    const context = {
      canvas: { width: 4000, height: 4000 }, globalAlpha: 1, imageSmoothingEnabled: false, save() {}, restore() {}, setTransform() {},
      drawImage: (image: unknown, ...args: number[]) => { draws.push({ image, args }); },
    };
    beginSpriteMipFrame(context, 0.3);
    assert.ok(drawWorldSpriteAtWorldAnchor(context, key, 10, 10, { camera: { zoom: 0.3, panX: 2000, panY: 0 }, image: raster }));
    endSpriteMipFrame();
    assert.equal(draws[0]!.image, made[0]);
    assert.equal(draws[0]!.args.length, 8, "a cropped blit from the level");
    assert.deepEqual(draws[0]!.args.slice(0, 4), [0, 0, made[0]!.width, made[0]!.height]);
    canvasBudget.clear();
  });
});
