import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { RAMPS } from "../src/content/palette";
import {
  prepareWorldAssets,
  rawFoliageFileName,
  type BuildingSelections,
} from "../scripts/prepareWorldAssets";
import { readPng, writePng, type RgbaImage } from "../scripts/processBuildingSprite";
import { verifyWorldAssets } from "../scripts/verifyWorldAssets";
import { FOLIAGE_KEYS, TREE_STUMP_KEYS, WORLD_ASSET_KEYS } from "../scripts/worldAssetContracts";
import { parseWorldAssetManifest } from "../scripts/worldAssetManifest";

const selections = {
  house_l1: 1,
  house_l2: 2,
  house_l3: 3,
  well: 4,
  storehouse: 5,
  wheat_farm: 6,
  logging_camp: 1,
  sawmill: 2,
} as const satisfies BuildingSelections;

const rgb = (hex: string): readonly [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const fileSha256 = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const image = (width: number, height: number, background: readonly [number, number, number, number]): RgbaImage => {
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < rgba.length; index += 4) rgba.set(background, index);
  return { dimensions: { width, height }, rgba };
};

const fill = (
  target: RgbaImage,
  left: number,
  top: number,
  right: number,
  bottom: number,
  colour: readonly [number, number, number, number],
): void => {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) target.rgba.set(colour, (y * target.dimensions.width + x) * 4);
  }
};

const writeRawSprite = (filePath: string, width: number, height: number, colour: string): void => {
  const source = image(width + 16, height + 16, [0, 255, 255, 255]);
  fill(source, 8, 8, width + 8, height + 8, [...rgb(colour), 255]);
  writePng(filePath, source);
};

const writePromoted = (filePath: string, width: number, height: number, visibleWidth: number, visibleHeight: number): void => {
  const promoted = image(width, height, [0, 0, 0, 0]);
  const left = Math.floor((width - visibleWidth) / 2);
  fill(promoted, left, height - 16 - visibleHeight, left + visibleWidth, height - 16, [...rgb(RAMPS.thatch[2]), 255]);
  writePng(filePath, promoted);
};

type Fixture = {
  readonly root: string;
  readonly rawRoot: string;
  readonly phase4bRoot: string;
};

const fixture = (): Fixture => {
  const root = mkdtempSync(path.join(tmpdir(), "phase4c-release-"));
  const rawRoot = path.join(root, "raw");
  const phase4bRoot = path.join(root, "phase4b");
  mkdirSync(path.join(rawRoot, "building"), { recursive: true });
  mkdirSync(path.join(rawRoot, "foliage"), { recursive: true });
  mkdirSync(path.join(rawRoot, "terrain"), { recursive: true });
  mkdirSync(phase4bRoot, { recursive: true });

  const buildingShapes = [
    ["house_l1", 64, 28, selections.house_l1], ["house_l2", 64, 46, selections.house_l2],
    ["house_l3", 128, 92, selections.house_l3], ["well", 64, 40, selections.well],
    ["storehouse", 128, 70, selections.storehouse], ["wheat_farm", 128, 48, selections.wheat_farm],
    ["logging_camp", 64, 45, selections.logging_camp], ["sawmill", 80, 55, selections.sawmill],
  ] as const;
  for (const [key, width, height, candidate] of buildingShapes) {
    writeRawSprite(
      path.join(rawRoot, "building", `${key}_${String(candidate).padStart(2, "0")}.png`),
      width,
      height,
      key === "wheat_farm" ? RAMPS.earth[2] : RAMPS.plaster[2],
    );
  }
  for (const [key, [width, height]] of Object.entries({
    tree_oak_large: [56, 86], tree_oak_small: [42, 60], tree_pine_tall: [38, 94],
    tree_pine_short: [36, 64], tree_birch: [34, 74], tree_dead: [34, 58],
    stump_fresh: [30, 14], stump_old: [28, 12], shrub_a: [30, 20], shrub_b: [24, 16],
    grass_tuft: [22, 12], field_stone: [18, 10],
  } as const)) {
    const candidates = TREE_STUMP_KEYS.some((candidateKey) => candidateKey === key) ? 8 : 1;
    for (let candidate = 1; candidate <= candidates; candidate += 1) {
      writeRawSprite(
        path.join(rawRoot, "foliage", `${key}_${String(candidate).padStart(2, "0")}.png`),
        width,
        height,
        key === "field_stone" ? RAMPS.stone[2] : RAMPS.foliage[2],
      );
    }
  }
  for (const key of ["grass", "forest_floor", "water", "rock", "packed_earth_road"] as const) {
    const terrain = image(256, 256, [...rgb(RAMPS.earth[2]), 255]);
    writePng(path.join(rawRoot, "terrain", `${key}.png`), terrain);
  }
  writePromoted(path.join(phase4bRoot, "house_03.png"), 96, 112, 78, 20);
  writePromoted(path.join(phase4bRoot, "mill_02.png"), 96, 160, 90, 71);
  writePromoted(path.join(phase4bRoot, "granary_08.png"), 160, 144, 128, 70);
  return { root, rawRoot, phase4bRoot };
};

describe("Phase 4C world asset release", () => {
  it("maps every Phase 8 release foliage key to its selected raw candidate filename", () => {
    for (const key of FOLIAGE_KEYS) assert.equal(rawFoliageFileName(key), `${key}_01.png`);
  });

  it("prepares the exact release, preserves Phase 4B bytes, and writes a complete manifest", () => {
    // Given: explicit building selections, raw category inputs, and the three accepted Phase 4B files.
    const test = fixture();
    try {
      const originals = new Map([
        ["house_l0", readFileSync(path.join(test.phase4bRoot, "house_03.png"))],
        ["mill", readFileSync(path.join(test.phase4bRoot, "mill_02.png"))],
        ["barn", readFileSync(path.join(test.phase4bRoot, "granary_08.png"))],
      ]);

      // When: the real preparation boundary builds the release.
      const manifest = prepareWorldAssets({
        repoRoot: test.root,
        rawRoot: test.rawRoot,
        phase4bRoot: test.phase4bRoot,
        selections,
      });

      // Then: all exact keys validate and promoted assets remain byte-identical.
      assert.deepEqual(manifest.assets.map((asset) => asset.key), [...WORLD_ASSET_KEYS]);
      assert.deepEqual(
        Object.fromEntries(
          manifest.assets
            .filter((asset) => asset.category === "building" && asset.key in selections)
            .map((asset) => [asset.key, asset.source]),
        ),
        {
          house_l1: { seed: 64050101, candidate: 1 },
          house_l2: { seed: 64050202, candidate: 2 },
          house_l3: { seed: 64050303, candidate: 3 },
          well: { seed: 64050404, candidate: 4 },
          storehouse: { seed: 64050505, candidate: 5 },
          wheat_farm: { seed: 64050606, candidate: 6 },
          logging_camp: { seed: 64050701, candidate: 1 },
          sawmill: { seed: 64050802, candidate: 2 },
        },
      );
      assert.deepEqual(
        Object.fromEntries(
          manifest.assets
            .filter((asset) => asset.category === "foliage")
            .map((asset) => [asset.key, asset.source]),
        ),
        {
          tree_oak_large: { seed: 64052101, candidate: 1 },
          tree_oak_small: { seed: 64052201, candidate: 1 },
          tree_pine_tall: { seed: 64052301, candidate: 1 },
          tree_pine_short: { seed: 64052401, candidate: 1 },
          tree_birch: { seed: 64052501, candidate: 1 },
          tree_dead: { seed: 64052601, candidate: 1 },
          stump_fresh: { seed: 64052701, candidate: 1 },
          stump_old: { seed: 64052801, candidate: 1 },
          shrub_a: { seed: 64052901, candidate: 1 },
          shrub_b: { seed: 64053001, candidate: 1 },
          grass_tuft: { seed: 64053101, candidate: 1 },
          field_stone: { seed: 64053201, candidate: 1 },
        },
      );
      assert.doesNotThrow(() => verifyWorldAssets(test.root, test.phase4bRoot));
      for (const [key, bytes] of originals) {
        assert.deepEqual(readFileSync(path.join(test.root, "public", "assets", "buildings", `${key}.png`)), bytes);
      }
      assert.equal(readPng(path.join(test.root, "public", "assets", "terrain", "grass.png")).dimensions.width, 256);
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("rejects an unexpected top-level PNG without treating historical candidate folders as release files", () => {
    // Given: a complete prepared release plus a preserved nested Phase 4B candidate and one stray release PNG.
    const test = fixture();
    try {
      prepareWorldAssets({ repoRoot: test.root, rawRoot: test.rawRoot, phase4bRoot: test.phase4bRoot, selections });
      const historical = path.join(test.root, "public", "assets", "buildings", "candidates_v2");
      mkdirSync(historical, { recursive: true });
      writePromoted(path.join(historical, "house_01.png"), 96, 112, 78, 20);
      writePromoted(path.join(test.root, "public", "assets", "buildings", "unexpected.png"), 96, 112, 78, 20);

      // When / Then: exact top-level release membership rejects only the stray release file.
      assert.throws(() => verifyWorldAssets(test.root, test.phase4bRoot), /unexpected PNG.*unexpected\.png/);
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("rejects a category-invalid asset even when its filename and dimensions are correct", () => {
    // Given: a complete release whose terrain alpha contract has been corrupted.
    const test = fixture();
    try {
      prepareWorldAssets({ repoRoot: test.root, rawRoot: test.rawRoot, phase4bRoot: test.phase4bRoot, selections });
      const terrainPath = path.join(test.root, "public", "assets", "terrain", "water.png");
      const terrain = readPng(terrainPath);
      terrain.rgba[3] = 0;
      writePng(terrainPath, terrain);
      const manifestPath = path.join(test.root, "public", "assets", "world_asset_manifest.json");
      const manifest = parseWorldAssetManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
      const updatedManifest = {
        ...manifest,
        assets: manifest.assets.map((asset) =>
          asset.key === "water" ? { ...asset, sha256: fileSha256(terrainPath) } : asset
        ),
      };
      writeFileSync(manifestPath, `${JSON.stringify(updatedManifest, null, 2)}\n`);

      // When / Then: the terrain validator rejects non-opaque release pixels.
      assert.throws(() => verifyWorldAssets(test.root, test.phase4bRoot), /water.*opaque/);
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });
});
