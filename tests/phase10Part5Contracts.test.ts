import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { RAMPS } from "../src/content/palette";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
import type { TileRange } from "../src/render/renderer";
import {
  foliageRampTintPixels,
  type RampTintPixel,
} from "../src/render/worldSprite";
import type { Tile } from "../src/world/world.types";
import { writePng, type RgbaImage } from "../scripts/processBuildingSprite";
import {
  assertSelectedFoliageCandidate,
  assertSelectedTerrainCandidate,
} from "../scripts/phase10SurfaceValidators";
import { parsePhase10SurfaceFoliageSelection } from "../scripts/worldAssetFoliageSelection";
import type {
  FoliageSelection,
} from "../scripts/worldAssetContracts";

const sha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const range: TileRange = { minTx: 0, minTy: 0, maxTx: 2, maxTy: 2 };

const rgb = (hex: string): readonly [number, number, number] => {
  const parsed = Number.parseInt(hex.slice(1), 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
};

const rgbaImage = (width: number, height: number, colour: readonly [number, number, number, number]): RgbaImage => {
  const image: RgbaImage = { dimensions: { width, height }, rgba: new Uint8Array(width * height * 4) };
  for (let index = 0; index < image.rgba.length; index += 4) image.rgba.set(colour, index);
  return image;
};

const setPixel = (
  image: RgbaImage,
  x: number,
  y: number,
  colour: readonly [number, number, number, number],
): void => {
  image.rgba.set(colour, (y * image.dimensions.width + x) * 4);
};

const foliageCandidate = (): RgbaImage => {
  const image = rgbaImage(88, 112, [0, 0, 0, 0]);
  for (let y = 96; y <= 111; y += 1) {
    for (let x = 42; x <= 46; x += 1) setPixel(image, x, y, [...rgb(RAMPS.timber[2]), 255]);
  }
  for (let y = 24; y < 72; y += 1) {
    for (let x = 20; x < 68; x += 1) {
      const shade = RAMPS.foliage[(x + y) % RAMPS.foliage.length] ?? "#1E2B18";
      setPixel(image, x, y, [...rgb(shade), 255]);
    }
  }
  return image;
};

const manifestSelection = (partial: Partial<FoliageSelection> = {}): FoliageSelection => ({
  key: "tree_oak_large",
  selectedCandidate: 1,
  tieBreak: "lowest-seed",
  candidates: Array.from({ length: 6 }, (_, index) => ({
    candidate: index + 1,
    seed: 71000100 + index + 1,
    path: `raw/foliage/tree_oak_large_${String(index + 1).padStart(2, "0")}.png`,
    sha256,
    width: 88,
    height: 112,
    palette: true,
    alpha: true,
    transparentBackground: true,
    bakedGroundShadowAbsent: true,
    selected: index === 0,
    hardRejected: false,
    rubric: {
      trunkGroundContact: index === 0 ? 2 : 1,
      silhouette: 2,
      lightingVariation: 2,
      referenceStyle: 2,
      total: index === 0 ? 8 : 7,
    },
  })),
  ...partial,
});

const forestTile = (tx: number, ty: number): Tile => ({
  tx,
  ty,
  terrain: "forest",
  buildingId: null,
  hasRoad: false,
});

describe("Phase10 Part5 pre-generation contracts", () => {
  it("Given selected foliage metadata When parsed Then six candidates and selected release key are enforced", () => {
    assert.doesNotThrow(() => parsePhase10SurfaceFoliageSelection(manifestSelection()));
    assert.throws(
      () => parsePhase10SurfaceFoliageSelection(manifestSelection({ candidates: manifestSelection().candidates.slice(0, 5) })),
      /tree_oak_large candidates must contain exactly 6/,
    );
  });

  it("Given temp selected fixtures When validated Then foliage and terrain contracts reject dimensions, shadows, and seams", () => {
    const root = mkdtempSync(path.join(tmpdir(), "phase10-part5-"));
    try {
      const foliagePath = path.join(root, "tree_oak_large.png");
      writePng(foliagePath, foliageCandidate());
      assert.doesNotThrow(() => assertSelectedFoliageCandidate(foliagePath, "tree_oak_large"));

      const shadowed = foliageCandidate();
      setPixel(shadowed, 44, 111, [...rgb(RAMPS.earth[2]), 255]);
      const shadowPath = path.join(root, "shadowed.png");
      writePng(shadowPath, shadowed);
      assert.throws(() => assertSelectedFoliageCandidate(shadowPath, "tree_oak_large"), /foliage or timber/);

      const terrain = rgbaImage(256, 256, [...rgb(RAMPS.foliage[2]), 255]);
      const terrainPath = path.join(root, "grass.png");
      writePng(terrainPath, terrain);
      assert.doesNotThrow(() => assertSelectedTerrainCandidate(terrainPath, "grass"));
      setPixel(terrain, 255, 0, [...rgb(RAMPS.foliage[5]), 255]);
      const splitPath = path.join(root, "split-grass.png");
      writePng(splitPath, terrain);
      assert.throws(() => assertSelectedTerrainCandidate(splitPath, "grass"), /terrain seam/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("Given selected terrain fixtures When alpha or palette drifts Then the validator rejects them", () => {
    const root = mkdtempSync(path.join(tmpdir(), "phase10-part5-terrain-"));
    try {
      const validGrass = rgbaImage(256, 256, [...rgb(RAMPS.foliage[2]), 255]);
      const validPath = path.join(root, "grass-valid.png");
      writePng(validPath, validGrass);
      assert.doesNotThrow(() => assertSelectedTerrainCandidate(validPath, "grass"));

      const transparentGrass = rgbaImage(256, 256, [...rgb(RAMPS.foliage[2]), 254]);
      const transparentPath = path.join(root, "grass-alpha.png");
      writePng(transparentPath, transparentGrass);
      assert.throws(() => assertSelectedTerrainCandidate(transparentPath, "grass"), /terrain must be opaque/);

      const invalidGrass = rgbaImage(256, 256, [...rgb(RAMPS.water[2]), 255]);
      const invalidPath = path.join(root, "grass-palette.png");
      writePng(invalidPath, invalidGrass);
      assert.throws(() => assertSelectedTerrainCandidate(invalidPath, "grass"), /terrain violates its palette policy/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("Given a foliage tint When applied Then all foliage shades remap across the target ramp", () => {
    const pixels: readonly RampTintPixel[] = RAMPS.foliage.map((hex) => {
      const [r, g, b] = rgb(hex);
      return { r, g, b, a: 255 };
    });

    const tinted = foliageRampTintPixels(pixels, RAMPS.foliage[4]);

    assert.equal(new Set(tinted.map((pixel) => `${pixel.r},${pixel.g},${pixel.b}`)).size, RAMPS.foliage.length);
    assert.deepEqual(tinted[0], { r: 30, g: 43, b: 24, a: 255 });
    assert.deepEqual(tinted.at(-1), { r: 130, g: 160, b: 107, a: 255 });
  });

  it("Given low and high foliage tints When applied Then foliage shifts and timber is unchanged", () => {
    const [timberR, timberG, timberB] = rgb(RAMPS.timber[2]);
    const foliageKeys = RAMPS.foliage.map((hex) => rgb(hex).join(","));
    const pixels: readonly RampTintPixel[] = [
      { r: timberR, g: timberG, b: timberB, a: 255 },
      ...RAMPS.foliage.map((hex) => {
        const [r, g, b] = rgb(hex);
        return { r, g, b, a: 255 };
      }),
    ];

    const low = foliageRampTintPixels(pixels, RAMPS.foliage[0]);
    const high = foliageRampTintPixels(pixels, RAMPS.foliage[5]);

    assert.deepEqual(low[0], pixels[0]);
    assert.deepEqual(high[0], pixels[0]);
    assert.notDeepEqual(low.slice(1), high.slice(1));
    for (const pixel of [...low.slice(1), ...high.slice(1)]) {
      assert.ok(foliageKeys.includes(`${pixel.r},${pixel.g},${pixel.b}`));
    }
  });

  it("Given two trees anchored on the same tile When queued Then y sort beats id order", () => {
    const items = buildObjectRenderItems({
      tiles: [forestTile(1, 1), forestTile(1, 2), forestTile(2, 1)],
      worldTiles: [forestTile(1, 1), forestTile(1, 2), forestTile(2, 1)],
      buildings: [],
      range,
      seed: 159,
      includeGroundCover: false,
    }).filter((item) => item.kind === "tree");

    const sameTilePair = items.find((left, index) =>
      items.slice(index + 1).some((right) =>
        right.kind === "tree"
        && left.kind === "tree"
        && left.descriptor.anchorTx === right.descriptor.anchorTx
        && left.descriptor.anchorTy === right.descriptor.anchorTy
        && left.descriptor.sortY > right.descriptor.sortY,
      ),
    );

    assert.equal(sameTilePair, undefined);
    assert.deepEqual(
      items.map((item) => item.kind === "tree" ? item.descriptor.sortY : 0),
      [...items.map((item) => item.kind === "tree" ? item.descriptor.sortY : 0)].sort((left, right) => left - right),
    );
  });
});
