import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { RAMPS } from "../src/content/palette";
import { readPng, writePng, type RgbaImage } from "../scripts/processBuildingSprite";
import { assertSelectedFoliageCandidate, assertSelectedTerrainCandidate } from "../scripts/phase10SurfaceValidators";
import { preparePhase10SurfaceSelections } from "../scripts/preparePhase10SurfaceSelections";
import { FOLIAGE_SPECS, TERRAIN_KEYS, type FoliageKey, type TerrainKey } from "../scripts/worldAssetContracts";

const shaPattern = /^[a-f0-9]{64}$/;
const selectedFoliage = [
  ["tree_oak_large", 1],
  ["tree_oak_small", 1],
  ["tree_pine_tall", 2],
  ["tree_pine_short", 6],
  ["tree_birch", 4],
  ["tree_dead", 5],
] as const satisfies readonly (readonly [FoliageKey, number])[];

const rgb = (hex: string): readonly [number, number, number] => {
  const parsed = Number.parseInt(hex.slice(1), 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
};

const setPixel = (
  image: RgbaImage,
  x: number,
  y: number,
  colour: readonly [number, number, number, number],
): void => {
  image.rgba.set(colour, (y * image.dimensions.width + x) * 4);
};

const image = (width: number, height: number, colour: readonly [number, number, number, number]): RgbaImage => {
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < rgba.length; index += 4) rgba.set(colour, index);
  return { dimensions: { width, height }, rgba };
};

const sourceFoliage = (key: FoliageKey): RgbaImage => {
  const spec = FOLIAGE_SPECS[key];
  const source = image(128, 128, [0, 255, 255, 255]);
  const [timberR, timberG, timberB] = rgb(RAMPS.timber[2]);
  const trunkLeft = 60;
  const trunkRight = 68;
  for (let y = 78; y < 126; y += 1) {
    for (let x = trunkLeft; x < trunkRight; x += 1) setPixel(source, x, y, [timberR, timberG, timberB, 255]);
  }
  const canopyTop = key === "tree_dead" ? 20 : 14;
  const canopyBottom = key === "tree_dead" ? 86 : 82;
  for (let y = canopyTop; y < canopyBottom; y += 1) {
    for (let x = 22; x < 106; x += 1) {
      const branch = key === "tree_dead" && ((x + y) % 13 === 0 || Math.abs(x - 64) < 3);
      const leaf = key !== "tree_dead" && Math.hypot((x - 64) / 38, (y - 48) / 28) < 1 && (x + y) % 11 !== 0;
      if (!branch && !leaf) continue;
      const ramp = branch ? RAMPS.timber : RAMPS.foliage;
      const [r, g, b] = rgb(ramp[(x + y) % ramp.length] ?? ramp[2]);
      setPixel(source, x, y, [r, g, b, 255]);
    }
  }
  assert.ok(spec.width > 0);
  return source;
};

const sourceTerrain = (key: TerrainKey): RgbaImage => {
  const ramp = key === "water"
    ? RAMPS.water
    : key === "rock"
      ? RAMPS.stone
      : key === "packed_earth_road"
        ? RAMPS.earth
        : RAMPS.foliage;
  const terrain = image(256, 256, [0, 0, 0, 255]);
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const [r, g, b] = rgb(ramp[(Math.floor(x / 16) + Math.floor(y / 16)) % ramp.length] ?? ramp[2]);
      setPixel(terrain, x, y, [r, g, b, 255]);
    }
  }
  return terrain;
};

const createFixture = (): { readonly root: string; readonly selectionsPath: string; readonly outputRoot: string } => {
  const root = mkdtempSync(path.join(tmpdir(), "phase10-postprocess-"));
  const candidateRoot = path.join(root, "candidates");
  const entries: unknown[] = [];
  for (const [key, candidate] of selectedFoliage) {
    const directory = path.join(candidateRoot, key);
    const sourcePath = path.join(directory, `${key}_${String(candidate).padStart(2, "0")}.png`);
    writePng(sourcePath, sourceFoliage(key));
    const sha256 = preparePhase10SurfaceSelections.sha256File(sourcePath);
    entries.push({ group: key, category: "foliage", candidate, source_abs_path: sourcePath, seed: 71000000 + candidate, sha256 });
  }
  for (const key of TERRAIN_KEYS) {
    const directory = path.join(candidateRoot, key);
    const sourcePath = path.join(directory, `${key}_01.png`);
    writePng(sourcePath, sourceTerrain(key));
    const sha256 = preparePhase10SurfaceSelections.sha256File(sourcePath);
    entries.push({ group: key, category: "terrain", candidate: 1, source_abs_path: sourcePath, seed: 71010000, sha256 });
  }
  const selectionsPath = path.join(root, "selections.json");
  writeFileSync(selectionsPath, `${JSON.stringify({ selections: entries }, null, 2)}\n`);
  return { root, selectionsPath, outputRoot: path.join(root, "integrated") };
};

describe("Phase10 Part5 selected surface postprocess", () => {
  it("Given visual selections When prepared Then only staged foliage and terrain PNGs are written", () => {
    const fixture = createFixture();
    try {
      const report = preparePhase10SurfaceSelections.run({
        selectionsPath: fixture.selectionsPath,
        outputRoot: fixture.outputRoot,
      });

      assert.equal(report.assets.length, 11);
      assert.equal(report.foliage.length, 6);
      assert.equal(report.terrain.length, 5);
      for (const asset of report.assets) {
        assert.match(asset.rawSha256, shaPattern);
        assert.match(asset.outputSha256, shaPattern);
        assert.equal(asset.rawSha256.length, 64);
        assert.equal(asset.outputSha256.length, 64);
        const category = asset.category === "foliage" ? "foliage" : "terrain";
        const outputPath = path.join(fixture.outputRoot, category, `${asset.key}.png`);
        assert.deepEqual(readPng(outputPath).dimensions, { width: asset.width, height: asset.height });
      }
      for (const [key] of selectedFoliage) {
        assertSelectedFoliageCandidate(path.join(fixture.outputRoot, "foliage", `${key}.png`), key);
      }
      for (const key of TERRAIN_KEYS) {
        assertSelectedTerrainCandidate(path.join(fixture.outputRoot, "terrain", `${key}.png`), key);
      }
      const reportJson = JSON.parse(readFileSync(path.join(fixture.outputRoot, "postprocess-report.json"), "utf8")) as unknown;
      assert.equal(typeof reportJson, "object");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("Given a stale raw sha When prepared Then the boundary rejects the selection before writing", () => {
    const fixture = createFixture();
    try {
      const parsed = JSON.parse(readFileSync(fixture.selectionsPath, "utf8")) as {
        readonly selections: readonly Record<string, unknown>[];
      };
      writeFileSync(
        fixture.selectionsPath,
        `${JSON.stringify({ selections: [{ ...parsed.selections[0], sha256: "0".repeat(64) }, ...parsed.selections.slice(1)] }, null, 2)}\n`,
      );

      assert.throws(
        () => preparePhase10SurfaceSelections.run({ selectionsPath: fixture.selectionsPath, outputRoot: fixture.outputRoot }),
        /raw sha mismatch/,
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
