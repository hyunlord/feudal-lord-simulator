import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { writePng } from "../scripts/processBuildingSprite";
import {
  BUILDING_KEYS,
  BUILDING_SPECS,
  FOLIAGE_KEYS,
  FOLIAGE_SPECS,
  TERRAIN_KEYS,
  TERRAIN_SPECS,
  WORLD_ASSET_KEYS,
  type BuildingAsset,
  type FoliageAsset,
  type TerrainAsset,
  type WorldAssetManifest,
} from "../scripts/worldAssetContracts";
import {
  assertExactWorldAssetKeys,
  assertWorldAssetFiles,
  parseWorldAssetManifest,
} from "../scripts/worldAssetManifest";

const source = { seed: 64050101, candidate: 1 } as const;

const manifestFixture = (): WorldAssetManifest => ({
  version: 1,
  assets: [
    ...BUILDING_KEYS.map((key): BuildingAsset => {
      const spec = BUILDING_SPECS[key];
      return {
      key,
      category: "building" as const,
      path: `public/assets/buildings/${key}.png`,
      width: spec.width,
      height: spec.height,
      anchor: { x: spec.width / 2, y: spec.baselineY },
      footprint: spec.footprint,
      source,
      palettePolicy: "canonical-building" as const,
      alphaPolicy: "transparent-outline-179" as const,
      };
    }),
    ...FOLIAGE_KEYS.map((key): FoliageAsset => {
      const spec = FOLIAGE_SPECS[key];
      return {
      key,
      category: "foliage" as const,
      path: `public/assets/foliage/${key}.png`,
      width: spec.width,
      height: spec.height,
      anchor: { x: spec.width / 2, y: spec.baselineY },
      footprint: spec.footprint,
      source,
      palettePolicy: "foliage-timber" as const,
      alphaPolicy: "transparent-outline-179" as const,
      variation: {
        selection: "hash" as const,
        scale: { min: 0.75, max: 1.25 },
        offset: "in-tile" as const,
        sway: "sine" as const,
      },
      };
    }),
    ...TERRAIN_KEYS.map((key): TerrainAsset => {
      const spec = TERRAIN_SPECS[key];
      return {
      key,
      category: "terrain" as const,
      path: `public/assets/terrain/${key}.png`,
      width: spec.width,
      height: spec.height,
      anchor: { x: 0, y: 0 },
      footprint: spec.footprint,
      source,
      palettePolicy: spec.palettePolicy,
      alphaPolicy: "opaque" as const,
      seamMetrics: {
        horizontalJoinDelta: 0,
        verticalJoinDelta: 0,
        horizontalInternalDelta: 1,
        verticalInternalDelta: 1,
        threshold: 2,
        passed: true,
      },
      };
    }),
  ],
});

describe("world asset manifest", () => {
  it("parses the exact release keys, dimensions, anchors, and footprints", () => {
    // Given: a complete release manifest generated from the declared contracts.
    const input = manifestFixture();

    // When: the untrusted JSON value crosses the manifest boundary.
    const parsed = parseWorldAssetManifest(input);

    // Then: all 22 exact keys and their bottom-centre contracts are preserved.
    assert.doesNotThrow(() => assertExactWorldAssetKeys(parsed.assets));
    assert.deepEqual(parsed.assets.map((entry) => entry.key).sort(), [...WORLD_ASSET_KEYS].sort());
    const manor = parsed.assets.find((entry) => entry.key === "house_l3");
    assert.deepEqual(manor, {
      key: "house_l3",
      category: "building",
      path: "public/assets/buildings/house_l3.png",
      width: 160,
      height: 192,
      anchor: { x: 80, y: 176 },
      footprint: { width: 2, height: 2 },
      source,
      palettePolicy: "canonical-building",
      alphaPolicy: "transparent-outline-179",
    });
  });

  it("preserves the exact foliage variation and terrain seam contracts", () => {
    // Given: valid foliage and terrain metadata.
    const input = manifestFixture();

    // When: the manifest is parsed.
    const parsed = parseWorldAssetManifest(input);

    // Then: future renderer variation and automated seam evidence remain typed data.
    const shrub = parsed.assets.find((entry) => entry.key === "shrub_b");
    assert.equal(shrub?.category, "foliage");
    if (shrub?.category === "foliage") {
      assert.deepEqual(shrub.variation, {
        selection: "hash",
        scale: { min: 0.75, max: 1.25 },
        offset: "in-tile",
        sway: "sine",
      });
    }
    const grass = parsed.assets.find((entry) => entry.key === "grass");
    assert.equal(grass?.category, "terrain");
    if (grass?.category === "terrain") {
      assert.equal(grass.seamMetrics.passed, true);
      assert.equal(grass.alphaPolicy, "opaque");
    }
  });

  it("rejects duplicate and missing release keys", () => {
    // Given: one manifest with a duplicate and one with an omitted key.
    const valid = manifestFixture();
    const first = valid.assets[0];
    assert.ok(first);

    // When / Then: exact-key validation rejects both incomplete states.
    assert.throws(
      () => parseWorldAssetManifest({ ...valid, assets: [...valid.assets, first] }),
      /duplicate world asset key/,
    );
    assert.throws(
      () => parseWorldAssetManifest({ ...valid, assets: valid.assets.slice(1) }),
      /world asset keys/,
    );
  });

  it("rejects wrong dimensions and non-bottom-centre anchors", () => {
    // Given: an otherwise valid house contract with stale geometry.
    const valid = manifestFixture();
    const houseIndex = valid.assets.findIndex((entry) => entry.key === "house_l1");
    const house = valid.assets[houseIndex];
    assert.ok(house);

    // When / Then: declared geometry must match the literal contract map.
    const wrongDimensions = valid.assets.map((entry) =>
      entry.key === "house_l1" ? { ...entry, width: 95 } : entry
    );
    assert.throws(
      () => parseWorldAssetManifest({ ...valid, assets: wrongDimensions }),
      /house_l1 dimensions/,
    );
    const wrongAnchor = valid.assets.map((entry) =>
      entry.key === "house_l1" ? { ...entry, anchor: { ...entry.anchor, x: 47 } } : entry
    );
    assert.throws(
      () => parseWorldAssetManifest({ ...valid, assets: wrongAnchor }),
      /house_l1 anchor/,
    );
  });

  it("rejects path traversal and machine-specific paths", () => {
    // Given: an otherwise valid foliage entry.
    const valid = manifestFixture();
    const index = valid.assets.findIndex((entry) => entry.key === "shrub_a");
    const shrub = valid.assets[index];
    assert.ok(shrub);

    // When / Then: only its exact portable repo-relative release path is accepted.
    for (const invalidPath of ["../shrub_a.png", "/tmp/shrub_a.png", "C:\\tmp\\shrub_a.png"]) {
      const assets = valid.assets.map((entry) =>
        entry.key === "shrub_a" ? { ...entry, path: invalidPath } : entry
      );
      assert.throws(() => parseWorldAssetManifest({ ...valid, assets }), /shrub_a path/);
    }
  });

  it("rejects category-policy mismatches and incomplete category metadata", () => {
    // Given: category fields copied across incompatible asset classes.
    const valid = manifestFixture();
    const foliageIndex = valid.assets.findIndex((entry) => entry.key === "tree_conifer_a");
    const terrainIndex = valid.assets.findIndex((entry) => entry.key === "water");
    const foliage = valid.assets[foliageIndex];
    const terrain = valid.assets[terrainIndex];
    assert.ok(foliage);
    assert.ok(terrain);

    // When / Then: policy and category-only evidence cannot silently drift.
    const wrongPolicy = valid.assets.map((entry) =>
      entry.key === "tree_conifer_a" ? { ...entry, palettePolicy: "canonical-building" } : entry
    );
    assert.throws(
      () => parseWorldAssetManifest({ ...valid, assets: wrongPolicy }),
      /tree_conifer_a palettePolicy/,
    );
    const missingSeams = valid.assets.map((entry) =>
      entry.key === "water" ? { ...entry, seamMetrics: undefined } : entry
    );
    assert.throws(
      () => parseWorldAssetManifest({ ...valid, assets: missingSeams }),
      /water seamMetrics/,
    );
  });

  it("rejects nonexistent files and PNGs whose on-disk dimensions drift", () => {
    // Given: a complete parsed manifest and an isolated release root.
    const parsed = parseWorldAssetManifest(manifestFixture());
    const root = mkdtempSync(path.join(tmpdir(), "phase4c-manifest-"));
    try {
      // When / Then: no declared file may be absent.
      assert.throws(() => assertWorldAssetFiles(parsed, root), /missing world asset file/);

      // Given: all declared PNGs exist, except one has stale dimensions.
      for (const asset of parsed.assets) {
        const dimensions = asset.key === "house_l1"
          ? { width: asset.width - 1, height: asset.height }
          : { width: asset.width, height: asset.height };
        writePng(path.join(root, asset.path), {
          dimensions,
          rgba: new Uint8Array(dimensions.width * dimensions.height * 4),
        });
      }

      // When / Then: the decoded PNG dimensions must match the manifest.
      assert.throws(() => assertWorldAssetFiles(parsed, root), /house_l1 file dimensions/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
