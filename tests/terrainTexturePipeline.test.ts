import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  assertTerrainSeams,
  buildTerrainTile2x2,
  measureTerrainSeams,
  processTerrainFile,
  processTerrainRgba,
  TERRAIN_KEYS,
} from "../scripts/terrainTexturePipeline";
import { TERRAIN_SPECS } from "../scripts/worldAssetContracts";
import { readPng, writePng, type RgbaImage } from "../scripts/processBuildingSprite";

const image = (
  width: number,
  height: number,
  pixelAt: (x: number, y: number) => readonly [number, number, number, number],
): RgbaImage => {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      rgba.set(pixelAt(x, y), (y * width + x) * 4);
    }
  }
  return { dimensions: { width, height }, rgba };
};

const pixel = (source: RgbaImage, x: number, y: number): readonly [number, number, number, number] => {
  const index = (y * source.dimensions.width + x) * 4;
  const r = source.rgba[index];
  const g = source.rgba[index + 1];
  const b = source.rgba[index + 2];
  const a = source.rgba[index + 3];
  if (r === undefined || g === undefined || b === undefined || a === undefined) {
    throw new Error(`Missing pixel at ${x},${y}`);
  }
  return [r, g, b, a];
};

describe("terrainTexturePipeline", () => {
  it("publishes every terrain material as a 512px full-colour release texture", () => {
    // Given: the Phase 13 terrain release contract.
    const expected = { width: 512, height: 512, footprint: { width: 1, height: 1 }, palettePolicy: "full-colour-generated" };

    // When/Then: every terrain key advertises the 512px full-colour texture contract.
    assert.deepEqual(TERRAIN_SPECS, {
      grass: expected,
      forest_floor: expected,
      water: expected,
      rock: expected,
      packed_earth_road: expected,
    });
  });

  it("produces an opaque 512px texture that preserves generated RGB away from blend bands", () => {
    // Given: an arbitrary translucent generated texture.
    const source = image(512, 512, (x, y) => [x % 256, y % 256, (x + y) % 256, (x * y) % 256]);

    // When: every terrain policy processes that same untrusted source.
    for (const key of TERRAIN_KEYS) {
      const result = processTerrainRgba(source, key);

      // Then: release dimensions, opacity, and offset source colour are exact.
      assert.deepEqual(result.texture.dimensions, { width: 512, height: 512 });
      assert.deepEqual(pixel(result.texture, 128, 128).slice(0, 3), pixel(source, 384, 384).slice(0, 3));
      assert.equal(result.texture.rgba.every((channel, index) => index % 4 !== 3 || channel === 255), true);
    }
  });

  it("moves generated borders inward before making opposing edges exactly compatible", () => {
    // Given: a generated texture with a dark left half and light right half.
    const dark = [28, 48, 64] as const;
    const light = [124, 172, 194] as const;
    const source = image(512, 512, (x, y) => {
      const base = x < 256 ? dark : light;
      return [base[0] + (y % 29), base[1] + (y % 31), base[2] + (y % 37), 255];
    });

    // When: the tile is periodicised.
    const { texture } = processTerrainRgba(source, "water");

    // Then: the half-turn offset moves those old outer borders to the tile interior.
    assert.ok(pixel(texture, 64, 256)[0] > pixel(texture, 320, 256)[0]);

    // And: both pairs of new opposing edges are byte-identical at every coordinate.
    for (let position = 0; position < 512; position += 1) {
      assert.deepEqual(pixel(texture, 0, position), pixel(texture, 511, position));
      assert.deepEqual(pixel(texture, position, 0), pixel(texture, position, 511));
    }
  });

  it("constructs a byte-identical 2x2 tiling buffer", () => {
    // Given: a periodic release texture.
    const source = image(512, 512, (x, y) => [x % 128, y % 128, 80, 255]);
    const { texture } = processTerrainRgba(source, "grass");

    // When: a QA tiling preview is constructed.
    const tiled = buildTerrainTile2x2(texture);

    // Then: all four quadrants contain the exact release tile bytes.
    assert.deepEqual(tiled.dimensions, { width: 1024, height: 1024 });
    for (const [x, y] of [[19, 23], [531, 23], [19, 535], [531, 535]] as const) {
      assert.deepEqual(pixel(tiled, x, y), pixel(texture, x % 512, y % 512));
    }
  });

  it("reports opposing-edge, join-band, and internal-reference deltas for both axes", () => {
    // Given: a flat seamless texture.
    const flat = image(512, 512, () => [64, 80, 48, 255]);

    // When: its seamlessness metrics are measured.
    const metrics = measureTerrainSeams(flat);

    // Then: every exact and band-level delta is zero and reportable by axis.
    assert.deepEqual(metrics, {
      horizontalOpposingEdgeMaxDelta: 0,
      verticalOpposingEdgeMaxDelta: 0,
      horizontalJoinBandDelta: 0,
      verticalJoinBandDelta: 0,
      horizontalInternalBandDelta: 0,
      verticalInternalBandDelta: 0,
    });
  });

  it("rejects a synthetic visible seam even when the first and last pixels match", () => {
    // Given: exact black boundary pixels hiding bright near-boundary seam bands.
    const syntheticSeam = image(512, 512, (x, y) => {
      const nearVerticalJoin = x > 0 && x < 5;
      const nearHorizontalJoin = y > 0 && y < 5;
      const value = nearVerticalJoin || nearHorizontalJoin ? 255 : 0;
      return [value, value, value, 255];
    });

    // When/Then: band energy catches the visible seam that edge equality alone misses.
    const metrics = measureTerrainSeams(syntheticSeam);
    assert.equal(metrics.horizontalOpposingEdgeMaxDelta, 0);
    assert.equal(metrics.verticalOpposingEdgeMaxDelta, 0);
    assert.throws(() => assertTerrainSeams(metrics), /join band/i);
  });

  it("rejects generated terrain with 100 or fewer visible opaque RGB colours", () => {
    // Given: a seamless generated source whose visible RGB variety is below the Phase 13 floor.
    const lowColourSource = image(512, 512, () => [72, 80, 56, 255]);

    // When/Then: the release pipeline rejects texture candidates that read as flat or quantised.
    assert.throws(() => processTerrainRgba(lowColourSource, "grass"), /100 opaque RGB colours/i);
  });

  it("writes a resized periodic PNG through the real file boundary", () => {
    // Given: a small opaque RGB-like generated source on disk.
    const directory = mkdtempSync(path.join(tmpdir(), "terrain-pipeline-"));
    const inputPath = path.join(directory, "raw.png");
    const outputPath = path.join(directory, "grass.png");
    writePng(inputPath, image(32, 24, (x, y) => [40 + x, 70 + y, 35, 255]));

    // When: the real file adapter processes and writes it.
    const metrics = processTerrainFile(inputPath, outputPath, "grass");

    // Then: the PNG decoder observes the release contract and reportable metrics.
    const written = readPng(outputPath);
    assert.deepEqual(written.dimensions, { width: 512, height: 512 });
    assert.equal(written.rgba.every((channel, index) => index % 4 !== 3 || channel === 255), true);
    assert.equal(metrics.horizontalOpposingEdgeMaxDelta, 0);
    assert.equal(metrics.verticalOpposingEdgeMaxDelta, 0);
  });
});
