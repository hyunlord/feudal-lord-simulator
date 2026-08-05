import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { RAMPS } from "../src/content/palette";
import {
  assertTerrainSeams,
  buildTerrainTile2x2,
  measureTerrainSeams,
  processTerrainFile,
  processTerrainRgba,
  TERRAIN_KEYS,
  TERRAIN_POLICIES,
  type TerrainKey,
} from "../scripts/terrainTexturePipeline";
import { readPng, writePng, type RgbaImage } from "../scripts/processBuildingSprite";

const rgbFromHex = (hex: string): readonly [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

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

const allowedColours = (key: TerrainKey): ReadonlySet<string> => {
  const colours = TERRAIN_POLICIES[key].ramps.flatMap((ramp) => RAMPS[ramp]);
  return new Set(colours.map((hex) => rgbFromHex(hex).join(",")));
};

describe("terrainTexturePipeline", () => {
  it("produces an opaque 256px texture restricted to the terrain policy ramps", () => {
    // Given: an arbitrary translucent generated texture.
    const source = image(256, 256, (x, y) => [x, y, (x + y) % 256, (x * y) % 256]);

    // When: every terrain policy processes that same untrusted source.
    for (const key of TERRAIN_KEYS) {
      const result = processTerrainRgba(source, key);

      // Then: release dimensions, opacity, and category palette membership are exact.
      assert.deepEqual(result.texture.dimensions, { width: 256, height: 256 });
      const allowed = allowedColours(key);
      for (let index = 0; index < result.texture.rgba.length; index += 4) {
        assert.equal(result.texture.rgba[index + 3], 255);
        assert.equal(
          allowed.has(`${result.texture.rgba[index]},${result.texture.rgba[index + 1]},${result.texture.rgba[index + 2]}`),
          true,
        );
      }
    }
  });

  it("moves generated borders inward before making opposing edges exactly compatible", () => {
    // Given: a generated texture with a dark left half and light right half.
    const dark = rgbFromHex(RAMPS.water[0]);
    const light = rgbFromHex(RAMPS.water[5]);
    const source = image(256, 256, (x) => [...(x < 128 ? dark : light), 255]);

    // When: the tile is periodicised.
    const { texture } = processTerrainRgba(source, "water");

    // Then: the half-turn offset moves those old outer borders to the tile interior.
    assert.ok(pixel(texture, 32, 128)[0] > pixel(texture, 160, 128)[0]);

    // And: both pairs of new opposing edges are byte-identical at every coordinate.
    for (let position = 0; position < 256; position += 1) {
      assert.deepEqual(pixel(texture, 0, position), pixel(texture, 255, position));
      assert.deepEqual(pixel(texture, position, 0), pixel(texture, position, 255));
    }
  });

  it("constructs a byte-identical 2x2 tiling buffer", () => {
    // Given: a periodic release texture.
    const source = image(256, 256, (x, y) => [x % 128, y % 128, 80, 255]);
    const { texture } = processTerrainRgba(source, "grass");

    // When: a QA tiling preview is constructed.
    const tiled = buildTerrainTile2x2(texture);

    // Then: all four quadrants contain the exact release tile bytes.
    assert.deepEqual(tiled.dimensions, { width: 512, height: 512 });
    for (const [x, y] of [[19, 23], [275, 23], [19, 279], [275, 279]] as const) {
      assert.deepEqual(pixel(tiled, x, y), pixel(texture, x % 256, y % 256));
    }
  });

  it("reports opposing-edge, join-band, and internal-reference deltas for both axes", () => {
    // Given: a flat seamless texture.
    const flat = image(256, 256, () => [64, 80, 48, 255]);

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
    const syntheticSeam = image(256, 256, (x, y) => {
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
    assert.deepEqual(written.dimensions, { width: 256, height: 256 });
    assert.equal(written.rgba.every((channel, index) => index % 4 !== 3 || channel === 255), true);
    assert.equal(metrics.horizontalOpposingEdgeMaxDelta, 0);
    assert.equal(metrics.verticalOpposingEdgeMaxDelta, 0);
  });
});
