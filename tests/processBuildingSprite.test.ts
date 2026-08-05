import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { PALETTE, RAMPS } from "../src/content/palette";
import {
  addSilhouetteOutline,
  assertBuildingSpriteSet,
  canonicalColors,
  expandRgbToRgba,
  DEFAULT_CHROMA_KEY,
  fitOpaqueBounds,
  findOpaqueBounds,
  processSpriteImage,
  processSpriteRgba,
  removeChromaKey,
  writePng,
  type Dimensions,
  type RgbaImage,
} from "../scripts/processBuildingSprite";

const rgbFromHex = (hex: string): readonly [number, number, number] => {
  const parsed = Number.parseInt(hex.slice(1), 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
};

const setPixel = (
  image: RgbaImage,
  x: number,
  y: number,
  rgba: readonly [number, number, number, number],
): void => {
  const index = (y * image.dimensions.width + x) * 4;
  image.rgba[index] = rgba[0];
  image.rgba[index + 1] = rgba[1];
  image.rgba[index + 2] = rgba[2];
  image.rgba[index + 3] = rgba[3];
};

const channelAt = (rgba: Uint8Array, index: number): number => {
  const value = rgba[index];
  if (value === undefined) {
    throw new Error(`Missing RGBA channel at ${index}`);
  }
  return value;
};

const pixel = (image: RgbaImage, x: number, y: number): readonly [number, number, number, number] => {
  const index = (y * image.dimensions.width + x) * 4;
  return [
    channelAt(image.rgba, index),
    channelAt(image.rgba, index + 1),
    channelAt(image.rgba, index + 2),
    channelAt(image.rgba, index + 3),
  ];
};

const earthRgb = (): readonly [number, number, number] => rgbFromHex(RAMPS.earth[2]);

const blank = (width: number, height: number, fill: readonly [number, number, number, number]): RgbaImage => {
  const image: RgbaImage = { dimensions: { width, height }, rgba: new Uint8Array(width * height * 4) };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(image, x, y, fill);
    }
  }
  return image;
};

describe("processBuildingSprite", () => {
  it("expands generated RGB pixels to opaque RGBA before chroma processing", () => {
    // Given: the RGB byte layout emitted by the ComfyUI candidate generator.
    const rgb = new Uint8Array([0, 255, 255, 90, 60, 45]);

    // When: the file decoder normalises it at the pipeline boundary.
    const rgba = expandRgbToRgba(rgb, { width: 2, height: 1 });

    // Then: colour bytes are preserved and every source pixel becomes opaque.
    assert.deepEqual([...rgba], [0, 255, 255, 255, 90, 60, 45, 255]);
  });

  it("removes cyan chroma-key pixels and despills retained edge colour", () => {
    // Given: a cyan-key source with one near-edge building pixel.
    const image = blank(3, 1, [0, 255, 255, 255]);
    setPixel(image, 1, 0, [80, 190, 200, 255]);
    setPixel(image, 2, 0, [90, 60, 45, 255]);

    // When: chroma removal is applied.
    const cleaned = removeChromaKey(image, {
      key: DEFAULT_CHROMA_KEY,
      threshold: 12,
      softEdge: 90,
      despillStrength: 1,
    });

    // Then: key pixels become transparent and the edge pixel loses cyan spill.
    assert.equal(pixel(cleaned, 0, 0)[3], 0);
    assert.ok(pixel(cleaned, 1, 0)[1] < 120);
    assert.ok(pixel(cleaned, 1, 0)[2] < 130);
    assert.equal(pixel(cleaned, 2, 0)[3], 255);
  });

  it("detects opaque bounds and computes bottom-centred aspect fit", () => {
    // Given: an image with a 2x4 opaque silhouette.
    const image = blank(6, 6, [0, 255, 0, 0]);
    setPixel(image, 2, 1, [90, 60, 45, 255]);
    setPixel(image, 3, 4, [90, 60, 45, 255]);

    // When: bounds and target placement are calculated.
    const bounds = findOpaqueBounds(image);
    assert.deepEqual(bounds, { left: 2, top: 1, right: 4, bottom: 5 });
    const fit = fitOpaqueBounds(bounds, { width: 96, height: 112 }, 96);

    // Then: the opaque content is aspect-fitted and anchored to the declared baseline.
    assert.deepEqual(fit, { width: 48, height: 96, left: 24, top: 0 });
  });

  it("adds a one-pixel ink outline only outside transparent silhouette neighbours", () => {
    // Given: a one-pixel opaque silhouette on transparent canvas.
    const image = blank(3, 3, [0, 255, 0, 0]);
    setPixel(image, 1, 1, [...earthRgb(), 255]);

    // When: the silhouette outline is added.
    const outlined = addSilhouetteOutline(image);

    // Then: transparent neighbours become ink while the original pixel is preserved.
    assert.deepEqual(pixel(outlined, 1, 1), [...earthRgb(), 255]);
    assert.deepEqual(pixel(outlined, 1, 0), [...rgbFromHex(PALETTE.ink), 255]);
    assert.deepEqual(pixel(outlined, 0, 0), [0, 255, 0, 0]);
  });

  it("quantises visible pixels, preserves transparency, and clears rows below baseline", () => {
    // Given: a small source whose bottom row would violate the declared baseline if copied.
    const image = blank(3, 3, [0, 255, 255, 255]);
    setPixel(image, 1, 0, [135, 112, 80, 255]);
    setPixel(image, 1, 1, [140, 115, 82, 255]);
    setPixel(image, 1, 2, [150, 10, 10, 255]);

    // When: the sprite is processed into a fixed release canvas.
    const processed = processSpriteRgba(image, {
      target: { width: 5, height: 5 },
      baselineY: 3,
      chromaKey: DEFAULT_CHROMA_KEY,
      threshold: 12,
      softEdge: 90,
      outline: true,
    });

    // Then: below-baseline rows are transparent and visible RGB values are canonical.
    for (let x = 0; x < 5; x += 1) {
      assert.equal(pixel(processed, x, 4)[3], 0);
    }
    const allowed = new Set(canonicalColors().map((colour) => colour.key));
    for (let index = 0; index < processed.rgba.length; index += 4) {
      if (processed.rgba[index + 3] !== 0) {
        const key = `${processed.rgba[index]},${processed.rgba[index + 1]},${processed.rgba[index + 2]}`;
        assert.equal(allowed.has(key), true);
      }
    }
  });

  it("delegates file-pipeline resizing to the Lanczos boundary target", () => {
    // Given: a one-pixel silhouette that must scale before target placement.
    const image = blank(2, 2, [0, 255, 255, 255]);
    setPixel(image, 1, 0, [...earthRgb(), 255]);
    const calls: Dimensions[] = [];

    // When: the image pipeline runs with an injected scaler.
    const processed = processSpriteImage(
      image,
      {
        target: { width: 8, height: 8 },
        baselineY: 6,
        chromaKey: DEFAULT_CHROMA_KEY,
        threshold: 12,
        softEdge: 90,
        outline: false,
      },
      (_cropped, target) => {
        calls.push({ width: target.width, height: target.height });
        return blank(target.width, target.height, [...earthRgb(), 255]);
      },
    );

    // Then: the resize boundary receives fitted dimensions and the final canvas stays exact.
    assert.deepEqual(calls, [{ width: 6, height: 6 }]);
    assert.deepEqual(processed.dimensions, { width: 8, height: 8 });
  });

  it("verifies the 18 processed building candidate contracts", () => {
    // Given: a complete candidate set with exact dimensions and clean baselines.
    const root = mkdtempSync(path.join(tmpdir(), "building-sprites-"));
    const sizes = {
      house: { width: 96, height: 112, baselineY: 96 },
      mill: { width: 96, height: 160, baselineY: 144 },
      granary: { width: 160, height: 144, baselineY: 128 },
    } as const;
    for (const [subject, contract] of Object.entries(sizes)) {
      for (let index = 1; index <= 6; index += 1) {
        const image = blank(contract.width, contract.height, [0, 0, 0, 0]);
        for (let y = contract.baselineY - 8; y < contract.baselineY; y += 1) {
          for (let x = Math.floor(contract.width / 2) - 4; x < Math.floor(contract.width / 2) + 4; x += 1) {
            setPixel(image, x, y, [...earthRgb(), 255]);
          }
        }
        writePng(path.join(root, `${subject}_${String(index).padStart(2, "0")}.png`), image);
      }
    }

    // When / Then: every expected candidate passes the release verifier.
    assert.doesNotThrow(() => assertBuildingSpriteSet(root));
  });

  it("rejects non-canonical RGB and opaque pixels below a candidate baseline", () => {
    // Given: one invalid sprite in an otherwise complete set.
    const root = mkdtempSync(path.join(tmpdir(), "building-sprites-invalid-"));
    const sizes = {
      house: { width: 96, height: 112, baselineY: 96 },
      mill: { width: 96, height: 160, baselineY: 144 },
      granary: { width: 160, height: 144, baselineY: 128 },
    } as const;
    for (const [subject, contract] of Object.entries(sizes)) {
      for (let index = 1; index <= 6; index += 1) {
        const image = blank(contract.width, contract.height, [0, 0, 0, 0]);
        const rgb = subject === "house" && index === 1 ? [1, 2, 3] as const : earthRgb();
        setPixel(image, Math.floor(contract.width / 2), contract.baselineY, [...rgb, 255]);
        writePng(path.join(root, `${subject}_${String(index).padStart(2, "0")}.png`), image);
      }
    }

    // When / Then: invalid colour/baseline evidence fails the verifier.
    assert.throws(() => assertBuildingSpriteSet(root), /below baseline|non-canonical RGB/);
  });
});
