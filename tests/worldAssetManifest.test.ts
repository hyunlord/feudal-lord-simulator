import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { writePng } from "../scripts/processBuildingSprite";
import {
  ACCEPTED_REFERENCE_KEYS,
  BUILDING_KEYS,
  BUILDING_SPECS,
  FOLIAGE_CANDIDATE_COUNT,
  FOLIAGE_KEYS,
  FOLIAGE_SPECS,
  TREE_STUMP_KEYS,
  TERRAIN_KEYS,
  TERRAIN_SPECS,
  WORLD_ASSET_KEYS,
  type AcceptedReference,
  type BuildingAsset,
  type FoliageAsset,
  type FoliageSelection,
  type ParchmentMetrics,
  type TerrainAsset,
  type WorldAssetManifest,
} from "../scripts/worldAssetContracts";
import {
  assertExactWorldAssetKeys,
  assertWorldAssetFiles,
  parseWorldAssetManifest,
} from "../scripts/worldAssetManifest";

const source = { seed: 64050101, candidate: 1 } as const;
const sha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const acceptedReferences = ACCEPTED_REFERENCE_KEYS.map((key, index): AcceptedReference => ({
  key,
  path: `public/assets/buildings/candidates_v2/${key}.png`,
  sha256: `${String(index).repeat(64)}`,
  width: index === 2 ? 160 : 96,
  height: index === 1 ? 160 : index === 2 ? 144 : 112,
}));

const foliageSelection = (key: (typeof TREE_STUMP_KEYS)[number]): FoliageSelection => ({
  key,
  selectedCandidate: 2,
  tieBreak: "lowest-seed",
  candidates: Array.from({ length: FOLIAGE_CANDIDATE_COUNT }, (_, index) => ({
    candidate: index + 1,
    seed: 65000000 + index + 1,
    path: `raw/foliage/${key}_${String(index + 1).padStart(2, "0")}.png`,
    sha256: `${(index + 1).toString(16).repeat(64).slice(0, 64)}`,
    width: FOLIAGE_SPECS[key].width,
    height: FOLIAGE_SPECS[key].height,
    palette: true,
    alpha: true,
    transparentBackground: true,
    bakedGroundShadowAbsent: true,
    selected: index === 1,
    hardRejected: false,
    rubric: {
      trunkGroundContact: index === 1 ? 2 : 1,
      silhouette: 2,
      lightingVariation: 2,
      referenceStyle: 2,
      total: index === 1 ? 8 : 7,
    },
  })),
});

const parchmentMetrics: ParchmentMetrics = {
  decision: "generated-texture",
  thresholds: {
    joinBandMaxDelta: 24,
    joinToInternalRatio: 2,
    internalTolerance: 4,
    blockLumaRangeMax: 16,
    blockLumaStandardDeviationMin: 1,
    blockLumaStandardDeviationMax: 8,
  },
  candidates: [
    {
      candidate: 1,
      path: "raw/parchment/parchment_01.png",
      sha256,
      width: 256,
      height: 256,
      opposingEdgesByteCompatible: true,
      joinBandMaxDelta: 20,
      internalBandMaxDelta: 9,
      blockLumaRange: 12,
      blockLumaStandardDeviation: 3,
      passed: true,
    },
  ],
};

const manifestFixture = (): WorldAssetManifest => ({
  version: 1,
  acceptedReferences,
  foliageSelections: TREE_STUMP_KEYS.map(foliageSelection),
  parchmentMetrics,
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
      sha256,
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
      sha256,
      palettePolicy: key === "field_stone" ? "stone-earth" as const : "foliage-timber" as const,
      alphaPolicy: "transparent-outline-179" as const,
      variation: {
        selection: "hash" as const,
        scale: { min: 0.7, max: 1.3 },
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
      sha256,
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

const fileSha256 = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const writeManifestPngs = (
  manifest: WorldAssetManifest,
  root: string,
  dimensionsForKey: (asset: WorldAssetManifest["assets"][number]) => { readonly width: number; readonly height: number },
): WorldAssetManifest => {
  for (const asset of manifest.assets) {
    const dimensions = dimensionsForKey(asset);
    writePng(path.join(root, asset.path), {
      dimensions,
      rgba: new Uint8Array(dimensions.width * dimensions.height * 4),
    });
  }
  return {
    ...manifest,
    assets: manifest.assets.map((asset) => ({
      ...asset,
      sha256: fileSha256(path.join(root, asset.path)),
    })),
  };
};

describe("world asset manifest", () => {
  it("parses the exact release keys, dimensions, anchors, and footprints", () => {
    // Given: a complete release manifest generated from the declared contracts.
    const input = manifestFixture();

    // When: the untrusted JSON value crosses the manifest boundary.
    const parsed = parseWorldAssetManifest(input);

    // Then: all 28 exact keys and their bottom-centre contracts are preserved.
    assert.doesNotThrow(() => assertExactWorldAssetKeys(parsed.assets));
    assert.deepEqual(parsed.assets.map((entry) => entry.key).sort(), [...WORLD_ASSET_KEYS].sort());
    assert.equal(parsed.assets.length, 28);
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
      sha256,
      palettePolicy: "canonical-building",
      alphaPolicy: "transparent-outline-179",
    });
  });

  it("preserves non-tree ground cover while replacing runtime tree and stump release keys", () => {
    // Given: the Phase 8 release key contract.
    const expectedFoliage = [
      "tree_oak_large",
      "tree_oak_small",
      "tree_pine_tall",
      "tree_pine_short",
      "tree_birch",
      "tree_dead",
      "stump_fresh",
      "stump_old",
      "shrub_a",
      "shrub_b",
      "grass_tuft",
      "field_stone",
    ];

    // When / Then: old generic tree aliases are gone, and ground-cover keys remain.
    assert.deepEqual([...FOLIAGE_KEYS], expectedFoliage);
    assert.equal(FOLIAGE_SPECS.tree_oak_large.width, 88);
    assert.equal(FOLIAGE_SPECS.tree_oak_large.height, 112);
    assert.equal(FOLIAGE_SPECS.tree_pine_tall.height, 120);
    assert.equal(FOLIAGE_SPECS.stump_old.width, 36);
    assert.equal(FOLIAGE_SPECS.shrub_a.width, 40);
  });

  it("requires accepted references, eight candidates per tree or stump, hashes, and parchment metrics", () => {
    // Given: a complete synthetic Phase 8 manifest.
    const valid = manifestFixture();

    // When: the manifest is parsed.
    const parsed = parseWorldAssetManifest(valid);

    // Then: metadata that drives later DGX selection remains exact and auditable.
    assert.deepEqual(parsed.acceptedReferences.map((entry) => entry.key), [...ACCEPTED_REFERENCE_KEYS]);
    assert.equal(parsed.foliageSelections.length, 8);
    assert.equal(parsed.foliageSelections.every((selection) => selection.candidates.length === 8), true);
    assert.equal(parsed.parchmentMetrics.thresholds.joinBandMaxDelta, 24);
    assert.equal(parsed.parchmentMetrics.thresholds.blockLumaStandardDeviationMax, 8);
  });

  it("rejects flat parchment fallback when a generated candidate passed", () => {
    // Given: parchment metrics with a candidate that satisfies the generation thresholds.
    const valid = manifestFixture();

    // When / Then: a flat-token decision cannot override a passing generated texture candidate.
    assert.throws(
      () => parseWorldAssetManifest({
        ...valid,
        parchmentMetrics: { ...valid.parchmentMetrics, decision: "flat-token" },
      }),
      /parchmentMetrics flat-token decision cannot include passing generated candidates/,
    );
  });

  it("rejects missing reference hash, incomplete candidate sets, wrong rubric totals, and non-lowest-seed ties", () => {
    // Given: a valid strict manifest fixture.
    const valid = manifestFixture();

    // When / Then: each required audit field is a hard manifest boundary.
    assert.throws(
      () => parseWorldAssetManifest({
        ...valid,
        acceptedReferences: valid.acceptedReferences.map((entry) =>
          entry.key === "house_03" ? { ...entry, sha256: "" } : entry
        ),
      }),
      /house_03 sha256/,
    );
    assert.throws(
      () => parseWorldAssetManifest({
        ...valid,
        foliageSelections: valid.foliageSelections.map((entry) =>
          entry.key === "tree_oak_large" ? { ...entry, candidates: entry.candidates.slice(1) } : entry
        ),
      }),
      /tree_oak_large candidates must contain exactly 8/,
    );
    assert.throws(
      () => parseWorldAssetManifest({
        ...valid,
        foliageSelections: valid.foliageSelections.map((selection) =>
          selection.key === "tree_oak_large"
            ? {
              ...selection,
              candidates: selection.candidates.map((candidate) =>
                candidate.candidate === 2
                  ? { ...candidate, rubric: { ...candidate.rubric, total: 7 } }
                  : candidate
              ),
            }
            : selection
        ),
      }),
      /tree_oak_large candidate 2 rubric total/,
    );
    assert.throws(
      () => parseWorldAssetManifest({
        ...valid,
        foliageSelections: valid.foliageSelections.map((selection) =>
          selection.key === "tree_oak_large"
            ? {
              ...selection,
              candidates: selection.candidates.map((candidate) =>
                candidate.candidate === 1
                  ? { ...candidate, seed: 1, rubric: { ...candidate.rubric, trunkGroundContact: 2, total: 8 }, selected: false }
                  : candidate
              ),
            }
            : selection
        ),
      }),
      /tree_oak_large selected candidate must use lowest seed among top score/,
    );
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
        scale: { min: 0.7, max: 1.3 },
        offset: "in-tile",
        sway: "sine",
      });
    }
    const stone = parsed.assets.find((entry) => entry.key === "field_stone");
    assert.equal(stone?.category, "foliage");
    if (stone?.category === "foliage") assert.equal(stone.palettePolicy, "stone-earth");
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
    const foliageIndex = valid.assets.findIndex((entry) => entry.key === "tree_oak_large");
    const terrainIndex = valid.assets.findIndex((entry) => entry.key === "water");
    const foliage = valid.assets[foliageIndex];
    const terrain = valid.assets[terrainIndex];
    assert.ok(foliage);
    assert.ok(terrain);

    // When / Then: policy and category-only evidence cannot silently drift.
    const wrongPolicy = valid.assets.map((entry) =>
      entry.key === "tree_oak_large" ? { ...entry, palettePolicy: "canonical-building" } : entry
    );
    assert.throws(
      () => parseWorldAssetManifest({ ...valid, assets: wrongPolicy }),
      /tree_oak_large palettePolicy/,
    );
    const wrongStonePolicy = valid.assets.map((entry) =>
      entry.key === "field_stone" ? { ...entry, palettePolicy: "foliage-timber" } : entry
    );
    assert.throws(
      () => parseWorldAssetManifest({ ...valid, assets: wrongStonePolicy }),
      /field_stone palettePolicy/,
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

      // Given: all declared PNGs exist with matching hashes, except one has stale dimensions.
      const hashed = writeManifestPngs(parsed, root, (asset) =>
        asset.key === "house_l1"
          ? { width: asset.width - 1, height: asset.height }
          : { width: asset.width, height: asset.height }
      );

      // When / Then: the decoded PNG dimensions must match the manifest.
      assert.throws(() => assertWorldAssetFiles(hashed, root), /house_l1 file dimensions/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects PNG files whose bytes do not match the manifest sha256", () => {
    // Given: every declared PNG exists at the exact declared dimensions.
    const parsed = parseWorldAssetManifest(manifestFixture());
    const root = mkdtempSync(path.join(tmpdir(), "phase8-manifest-hash-"));
    try {
      const hashed = writeManifestPngs(parsed, root, (asset) => ({ width: asset.width, height: asset.height }));
      const mismatched = {
        ...hashed,
        assets: hashed.assets.map((asset) =>
          asset.key === "house_l1" ? { ...asset, sha256: "f".repeat(64) } : asset
        ),
      };

      // When / Then: a syntactically valid but incorrect digest is rejected.
      assert.throws(() => assertWorldAssetFiles(mismatched, root), /house_l1 file sha256/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
