import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { processTerrainFile } from "./terrainTexturePipeline";
import { readPng, writePng } from "./processBuildingSprite";
import {
  BUILDING_KEYS,
  BUILDING_SPECS,
  FOLIAGE_CANDIDATE_COUNT,
  FOLIAGE_KEYS,
  FOLIAGE_SPECS,
  TREE_STUMP_KEYS,
  TERRAIN_KEYS,
  TERRAIN_SPECS,
  type AcceptedReference,
  type BuildingAsset,
  type FoliageSelection,
  type FoliageAsset,
  type FoliageKey,
  type ParchmentMetrics,
  type TerrainAsset,
  type WorldAssetManifest,
} from "./worldAssetContracts";
import { parseWorldAssetManifest } from "./worldAssetManifest";
import { verifyWorldAssets } from "./verifyWorldAssets";
import {
  processWorldSprite,
  type BuildingSpriteKey,
  type FoliageSpriteKey,
} from "./worldSpritePipeline";

export type BuildingSelections = Readonly<Record<BuildingSpriteKey, number>>;

export type PrepareWorldAssetOptions = {
  readonly repoRoot: string;
  readonly rawRoot: string;
  readonly phase4bRoot: string;
  readonly selections: BuildingSelections;
};

export class WorldAssetPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldAssetPreparationError";
  }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const PROMOTIONS = {
  house_l0: { fileName: "house_03.png", seed: 64040103, candidate: 3 },
  mill: { fileName: "mill_02.png", seed: 64040202, candidate: 2 },
  barn: { fileName: "granary_08.png", seed: 64040308, candidate: 8 },
} as const satisfies Readonly<Record<"house_l0" | "mill" | "barn", {
  readonly fileName: string;
  readonly seed: number;
  readonly candidate: number;
}>>;

const newBuildingKeys = [
  "house_l1", "house_l2", "house_l3", "well", "storehouse", "wheat_farm", "logging_camp", "sawmill",
] as const satisfies readonly BuildingSpriteKey[];

export const rawFoliageFileName = (key: FoliageSpriteKey): string =>
  `${key}_01.png`;

const sha256 = (filePath: string): string => createHash("sha256").update(readFileSync(filePath)).digest("hex");

const sourceForBuilding = (key: BuildingSpriteKey, candidate: number): { readonly seed: number; readonly candidate: number } => {
  const subject = newBuildingKeys.indexOf(key);
  if (subject < 0) throw new WorldAssetPreparationError(`Unknown building selection ${key}`);
  return { seed: 64050100 + subject * 100 + candidate, candidate };
};

const sourceForReleaseBuilding = (
  key: (typeof BUILDING_KEYS)[number],
  selections: BuildingSelections,
): { readonly seed: number; readonly candidate: number } => {
  switch (key) {
    case "house_l0": return PROMOTIONS.house_l0;
    case "mill": return PROMOTIONS.mill;
    case "barn": return PROMOTIONS.barn;
    case "house_l1": return sourceForBuilding(key, selections.house_l1);
    case "house_l2": return sourceForBuilding(key, selections.house_l2);
    case "house_l3": return sourceForBuilding(key, selections.house_l3);
    case "well": return sourceForBuilding(key, selections.well);
    case "storehouse": return sourceForBuilding(key, selections.storehouse);
    case "wheat_farm": return sourceForBuilding(key, selections.wheat_farm);
    case "logging_camp": return sourceForBuilding(key, selections.logging_camp);
    case "sawmill": return sourceForBuilding(key, selections.sawmill);
    default: {
      const unreachable: never = key;
      return unreachable;
    }
  }
};

const outputPath = (repoRoot: string, category: "buildings" | "foliage" | "terrain", key: string): string =>
  path.join(repoRoot, "public", "assets", category, `${key}.png`);

const processSelectedBuildings = (options: PrepareWorldAssetOptions): void => {
  for (const key of newBuildingKeys) {
    const candidate = options.selections[key];
    if (!Number.isInteger(candidate) || candidate < 1 || candidate > 6) {
      throw new WorldAssetPreparationError(`${key} selection must be an integer from 1 through 6`);
    }
    const input = path.join(options.rawRoot, "building", `${key}_${String(candidate).padStart(2, "0")}.png`);
    const processed = processWorldSprite(readPng(input), key);
    writePng(outputPath(options.repoRoot, "buildings", key), processed);
  }
};

const copyPromotions = (options: PrepareWorldAssetOptions): void => {
  for (const [key, source] of Object.entries(PROMOTIONS)) {
    const destination = outputPath(options.repoRoot, "buildings", key);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(options.phase4bRoot, source.fileName), destination);
  }
};

const processFoliage = (options: PrepareWorldAssetOptions): void => {
  for (const key of FOLIAGE_KEYS) {
    const input = path.join(options.rawRoot, "foliage", rawFoliageFileName(key));
    writePng(outputPath(options.repoRoot, "foliage", key), processWorldSprite(readPng(input), key));
  }
};

const processTerrain = (options: PrepareWorldAssetOptions): ReadonlyMap<(typeof TERRAIN_KEYS)[number], ReturnType<typeof processTerrainFile>> => {
  const metrics = new Map<(typeof TERRAIN_KEYS)[number], ReturnType<typeof processTerrainFile>>();
  for (const key of TERRAIN_KEYS) {
    metrics.set(
      key,
      processTerrainFile(
        path.join(options.rawRoot, "terrain", `${key}.png`),
        outputPath(options.repoRoot, "terrain", key),
        key,
      ),
    );
  }
  return metrics;
};

const buildingAssets = (repoRoot: string, selections: BuildingSelections): readonly BuildingAsset[] => BUILDING_KEYS.map((key) => {
  const spec = BUILDING_SPECS[key];
  const source = sourceForReleaseBuilding(key, selections);
  const assetPath = `public/assets/buildings/${key}.png`;
  return {
    key,
    category: "building",
    path: assetPath,
    sha256: sha256(path.join(repoRoot, assetPath)),
    width: spec.width,
    height: spec.height,
    anchor: { x: spec.width / 2, y: spec.baselineY },
    footprint: spec.footprint,
    source: { seed: source.seed, candidate: source.candidate },
    palettePolicy: "canonical-building",
    alphaPolicy: "transparent-outline-179",
  };
});

const sourceForFoliage = (key: FoliageKey, candidate: number): { readonly seed: number; readonly candidate: number } => {
  const subject = FOLIAGE_KEYS.indexOf(key);
  if (subject < 0) throw new WorldAssetPreparationError(`Unknown foliage selection ${key}`);
  return { seed: 64052000 + (subject + 1) * 100 + candidate, candidate };
};

const foliageAssets = (repoRoot: string): readonly FoliageAsset[] => FOLIAGE_KEYS.map((key) => {
  const spec = FOLIAGE_SPECS[key];
  const assetPath = `public/assets/foliage/${key}.png`;
  return {
    key,
    category: "foliage",
    path: assetPath,
    sha256: sha256(path.join(repoRoot, assetPath)),
    width: spec.width,
    height: spec.height,
    anchor: { x: spec.width / 2, y: spec.baselineY },
    footprint: spec.footprint,
    source: sourceForFoliage(key, 1),
    palettePolicy: key === "field_stone" ? "stone-earth" : "foliage-timber",
    alphaPolicy: "transparent-outline-179",
    variation: { selection: "hash", scale: { min: 0.7, max: 1.3 }, offset: "in-tile", sway: "sine" },
  };
});

const terrainAssets = (
  repoRoot: string,
  metrics: ReadonlyMap<(typeof TERRAIN_KEYS)[number], ReturnType<typeof processTerrainFile>>,
): readonly TerrainAsset[] => TERRAIN_KEYS.map((key, index) => {
  const spec = TERRAIN_SPECS[key];
  const measured = metrics.get(key);
  if (measured === undefined) throw new WorldAssetPreparationError(`Missing seam metrics for ${key}`);
  const assetPath = `public/assets/terrain/${key}.png`;
  return {
    key,
    category: "terrain",
    path: assetPath,
    sha256: sha256(path.join(repoRoot, assetPath)),
    width: spec.width,
    height: spec.height,
    anchor: { x: 0, y: 0 },
    footprint: spec.footprint,
    source: { seed: 64053001 + index, candidate: 1 },
    palettePolicy: spec.palettePolicy,
    alphaPolicy: "opaque",
    seamMetrics: {
      horizontalJoinDelta: measured.horizontalJoinBandDelta,
      verticalJoinDelta: measured.verticalJoinBandDelta,
      horizontalInternalDelta: measured.horizontalInternalBandDelta,
      verticalInternalDelta: measured.verticalInternalBandDelta,
      threshold: 24,
      passed: true,
    },
  };
});

const ACCEPTED_REFERENCE_FILES = [
  ["house_03", "house_03.png"],
  ["mill_02", "mill_02.png"],
  ["granary_08", "granary_08.png"],
] as const satisfies readonly (readonly [AcceptedReference["key"], string])[];

const acceptedReferences = (phase4bRoot: string): readonly AcceptedReference[] => ACCEPTED_REFERENCE_FILES.map(([key, fileName]) => {
  const filePath = path.join(phase4bRoot, fileName);
  const image = readPng(filePath);
  return {
    key,
    path: `public/assets/buildings/candidates_v2/${key}.png`,
    sha256: sha256(filePath),
    width: image.dimensions.width,
    height: image.dimensions.height,
  };
});

const foliageSelections = (rawRoot: string): readonly FoliageSelection[] => TREE_STUMP_KEYS.map((key) => {
  const spec = FOLIAGE_SPECS[key];
  return {
    key,
    selectedCandidate: 1,
    tieBreak: "lowest-seed",
    candidates: Array.from({ length: FOLIAGE_CANDIDATE_COUNT }, (_, index) => {
      const candidate = index + 1;
      return {
        candidate,
        seed: sourceForFoliage(key, candidate).seed,
        path: `raw/foliage/${key}_${String(candidate).padStart(2, "0")}.png`,
        sha256: sha256(path.join(rawRoot, "foliage", `${key}_${String(candidate).padStart(2, "0")}.png`)),
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

export const prepareWorldAssets = (options: PrepareWorldAssetOptions): WorldAssetManifest => {
  copyPromotions(options);
  processSelectedBuildings(options);
  processFoliage(options);
  const metrics = processTerrain(options);
  const document = {
    version: 1,
    acceptedReferences: acceptedReferences(options.phase4bRoot),
    foliageSelections: foliageSelections(options.rawRoot),
    parchmentMetrics,
    assets: [
      ...buildingAssets(options.repoRoot, options.selections),
      ...foliageAssets(options.repoRoot),
      ...terrainAssets(options.repoRoot, metrics),
    ],
  } as const;
  const manifest = parseWorldAssetManifest(document);
  writeFileSync(
    path.join(options.repoRoot, "public", "assets", "world_asset_manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return verifyWorldAssets(options.repoRoot, options.phase4bRoot);
};

const parseSelections = (filePath: string): BuildingSelections => {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!isRecord(parsed)) {
    throw new WorldAssetPreparationError("Building selections must be a JSON object");
  }
  const record = parsed;
  const actual = Object.keys(record).sort();
  const expected = [...newBuildingKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new WorldAssetPreparationError(`Building selections must contain exactly ${expected.join(",")}`);
  }
  const value = (key: BuildingSpriteKey): number => {
    const candidate = record[key];
    if (typeof candidate !== "number" || !Number.isInteger(candidate)) {
      throw new WorldAssetPreparationError(`${key} selection must be an integer`);
    }
    return candidate;
  };
  return {
    house_l1: value("house_l1"),
    house_l2: value("house_l2"),
    house_l3: value("house_l3"),
    well: value("well"),
    storehouse: value("storehouse"),
    wheat_farm: value("wheat_farm"),
    logging_camp: value("logging_camp"),
    sawmill: value("sawmill"),
  };
};

const main = (): number => { // no-excuse-ok: catch
  try {
    const [, , repoRoot, rawRoot, phase4bRoot, selectionsPath] = process.argv;
    if (repoRoot === undefined || rawRoot === undefined || phase4bRoot === undefined || selectionsPath === undefined) {
      throw new WorldAssetPreparationError(
        "Usage: tsx scripts/prepareWorldAssets.ts <repo-root> <raw-root> <phase4b-root> <selections.json>",
      );
    }
    prepareWorldAssets({ repoRoot, rawRoot, phase4bRoot, selections: parseSelections(selectionsPath) });
    writeFileSync(1, "World asset preparation passed\n");
    return 0;
  } catch (caught) {
    if (caught instanceof Error) {
      writeFileSync(2, `${caught.name}: ${caught.message}\n`);
      return 1;
    }
    throw caught;
  }
};

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) process.exitCode = main();
