import { mkdirSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { writePng, type RgbaImage } from "../../../../../scripts/processBuildingSprite";
import {
  ACCEPTED_REFERENCE_KEYS,
  BUILDING_KEYS,
  BUILDING_SPECS,
  FOLIAGE_CANDIDATE_COUNT,
  FOLIAGE_KEYS,
  FOLIAGE_SPECS,
  TERRAIN_KEYS,
  TERRAIN_SPECS,
  TREE_STUMP_KEYS,
  type AcceptedReference,
  type BuildingAsset,
  type FoliageSelection,
  type FoliageAsset,
  type ParchmentMetrics,
  type TerrainAsset,
  type WorldAsset,
  type WorldAssetManifest,
} from "../../../../../scripts/worldAssetContracts";
import { assertWorldAssetFiles, parseWorldAssetManifest } from "../../../../../scripts/worldAssetManifest";

const SCENARIOS = ["valid", "bad-hash", "bad-dimension", "exact-set", "missing-file"] as const;
type Scenario = (typeof SCENARIOS)[number];

const hex = (index: number): string => (index % 16).toString(16).repeat(64);

const isScenario = (value: string): value is Scenario =>
  SCENARIOS.some((scenario) => scenario === value);

const image = (width: number, height: number): RgbaImage => ({
  dimensions: { width, height },
  rgba: new Uint8Array(width * height * 4),
});

const writeAssetPng = (repoRoot: string, relativePath: string, width: number, height: number): void => {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writePng(filePath, image(width, height));
};

const acceptedReferences = (): readonly AcceptedReference[] =>
  ACCEPTED_REFERENCE_KEYS.map((key, index) => ({
    key,
    path: `public/assets/buildings/candidates_v2/${key}.png`,
    sha256: hex(index + 1),
    width: key === "granary_08" ? 160 : 96,
    height: key === "mill_02" ? 160 : key === "granary_08" ? 144 : 112,
  }));

const foliageSelections = (): readonly FoliageSelection[] =>
  TREE_STUMP_KEYS.map((key, keyIndex) => {
    const spec = FOLIAGE_SPECS[key];
    return {
      key,
      selectedCandidate: 1,
      tieBreak: "lowest-seed",
      candidates: Array.from({ length: FOLIAGE_CANDIDATE_COUNT }, (_, index) => {
        const candidate = index + 1;
        return {
          candidate,
          seed: 64052000 + (keyIndex + 1) * 100 + candidate,
          path: `raw/foliage/${key}_${String(candidate).padStart(2, "0")}.png`,
          sha256: hex(keyIndex + candidate),
          width: spec.width,
          height: spec.height,
          palette: true,
          alpha: true,
          transparentBackground: true,
          bakedGroundShadowAbsent: true,
          selected: candidate === 1,
          hardRejected: false,
          rubric: {
            trunkGroundContact: candidate === 1 ? 2 : 1,
            silhouette: 2,
            lightingVariation: 2,
            referenceStyle: 2,
            total: candidate === 1 ? 8 : 7,
          },
        };
      }),
    };
  });

const parchmentMetrics: ParchmentMetrics = {
  decision: "flat-token",
  thresholds: {
    joinBandMaxDelta: 24,
    joinToInternalRatio: 2,
    internalTolerance: 4,
    blockLumaRangeMax: 16,
    blockLumaStandardDeviationMin: 1,
    blockLumaStandardDeviationMax: 8,
  },
  candidates: [],
};

const buildingAssets = (): readonly BuildingAsset[] =>
  BUILDING_KEYS.map((key, index) => {
    const spec = BUILDING_SPECS[key];
    return {
      key,
      category: "building",
      path: `public/assets/buildings/${key}.png`,
      sha256: hex(index + 1),
      width: spec.width,
      height: spec.height,
      anchor: { x: spec.width / 2, y: spec.baselineY },
      footprint: spec.footprint,
      source: { seed: 64050000 + index, candidate: 1 },
      palettePolicy: "canonical-building",
      alphaPolicy: "transparent-outline-179",
    };
  });

const foliageAssets = (): readonly FoliageAsset[] =>
  FOLIAGE_KEYS.map((key, index) => {
    const spec = FOLIAGE_SPECS[key];
    return {
      key,
      category: "foliage",
      path: `public/assets/foliage/${key}.png`,
      sha256: hex(index + 4),
      width: spec.width,
      height: spec.height,
      anchor: { x: spec.width / 2, y: spec.baselineY },
      footprint: spec.footprint,
      source: { seed: 64052000 + (index + 1) * 100 + 1, candidate: 1 },
      palettePolicy: key === "field_stone" ? "stone-earth" : "foliage-timber",
      alphaPolicy: "transparent-outline-179",
      variation: { selection: "hash", scale: { min: 0.7, max: 1.3 }, offset: "in-tile", sway: "sine" },
    };
  });

const terrainAssets = (): readonly TerrainAsset[] =>
  TERRAIN_KEYS.map((key, index) => {
    const spec = TERRAIN_SPECS[key];
    return {
      key,
      category: "terrain",
      path: `public/assets/terrain/${key}.png`,
      sha256: hex(index + 8),
      width: spec.width,
      height: spec.height,
      anchor: { x: 0, y: 0 },
      footprint: spec.footprint,
      source: { seed: 64053000 + index + 1, candidate: 1 },
      palettePolicy: spec.palettePolicy,
      alphaPolicy: "opaque",
      seamMetrics: {
        horizontalJoinDelta: 0,
        verticalJoinDelta: 0,
        horizontalInternalDelta: 0,
        verticalInternalDelta: 0,
        threshold: 24,
        passed: true,
      },
    };
  });

const writeFiles = (repoRoot: string, assets: readonly WorldAsset[]): void => {
  for (const reference of acceptedReferences()) {
    writeAssetPng(repoRoot, reference.path, reference.width, reference.height);
  }
  for (const asset of assets) {
    writeAssetPng(repoRoot, asset.path, asset.width, asset.height);
  }
};

const fixture = (scenario: Scenario): WorldAssetManifest => {
  const references = acceptedReferences();
  const assets: readonly WorldAsset[] = [...buildingAssets(), ...foliageAssets(), ...terrainAssets()];
  const mutatedReferences = scenario === "bad-hash"
    ? references.map((reference) => reference.key === "house_03" ? { ...reference, sha256: "bad" } : reference)
    : references;
  const mutatedAssets = scenario === "bad-dimension"
    ? assets.map((asset) => asset.key === "tree_oak_large" ? { ...asset, width: asset.width + 1 } : asset)
    : scenario === "exact-set" ? assets.slice(1) : assets;
  return {
    version: 1,
    acceptedReferences: mutatedReferences,
    foliageSelections: foliageSelections(),
    parchmentMetrics,
    assets: mutatedAssets,
  };
};

const run = (scenario: Scenario): number => {
  const repoRoot = mkdtempSync(path.join(tmpdir(), "phase8-synthetic-world-assets-"));
  try {
    const manifest = fixture(scenario);
    writeFiles(repoRoot, manifest.assets);
    if (scenario === "missing-file") {
      unlinkSync(path.join(repoRoot, "public/assets/terrain/water.png"));
    }
    const parsed = parseWorldAssetManifest(manifest);
    assertWorldAssetFiles(parsed, repoRoot);
    console.log(`SYNTHETIC_VERIFIER_PASS scenario=${scenario} assets=${parsed.assets.length} selections=${parsed.foliageSelections.length}`);
    return 0;
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
    console.log(`cleanup=removed path=${repoRoot}`);
  }
};

const main = (): number => { // no-excuse-ok: catch
  const scenarioArg = process.argv[2];
  if (scenarioArg === undefined || !isScenario(scenarioArg)) {
    console.error(`Usage: tsx syntheticVerifierCli.ts ${SCENARIOS.join("|")}`);
    return 2;
  }
  try {
    return run(scenarioArg);
  } catch (caught) {
    if (caught instanceof Error) {
      console.error(`SYNTHETIC_VERIFIER_FAIL scenario=${scenarioArg} ${caught.name}: ${caught.message}`);
      return 1;
    }
    throw caught;
  }
};

process.exitCode = main();
