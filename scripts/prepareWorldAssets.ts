import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { assertTerrainSeams, measureTerrainSeams, processTerrainFile } from "./terrainTexturePipeline";
import { readPng, writePng } from "./processBuildingSprite";
import {
  BUILDING_KEYS,
  BUILDING_SPECS,
  FOLIAGE_CANDIDATE_COUNT,
  FOLIAGE_KEYS,
  FOLIAGE_SPECS,
  STONE_TOWN_ASSET_KEYS,
  TREE_STUMP_KEYS,
  TERRAIN_KEYS,
  TERRAIN_SPECS,
  type AcceptedReference,
  type BuildingAsset,
  type FoliageSelection,
  type FoliageAsset,
  type FoliageKey,
  type FoliageCandidate,
  type ParchmentMetrics,
  type ParchmentCandidateMetrics,
  type SelectionRubric,
  type StoneTownAssetKey,
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

export class WorldAssetPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldAssetPreparationError";
  }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string): Readonly<Record<string, unknown>> => {
  if (!isRecord(value)) throw new WorldAssetPreparationError(`${label} must be an object`);
  return value;
};

const requireNumber = (record: Readonly<Record<string, unknown>>, key: string, label: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new WorldAssetPreparationError(`${label} ${key} must be a finite number`);
  }
  return value;
};

const requirePositiveInteger = (record: Readonly<Record<string, unknown>>, key: string, label: string): number => {
  const value = requireNumber(record, key, label);
  if (!Number.isInteger(value) || value <= 0) {
    throw new WorldAssetPreparationError(`${label} ${key} must be a positive integer`);
  }
  return value;
};

const requireBoolean = (record: Readonly<Record<string, unknown>>, key: string, label: string): boolean => {
  const value = record[key];
  if (typeof value !== "boolean") throw new WorldAssetPreparationError(`${label} ${key} must be boolean`);
  return value;
};

const requireString = (record: Readonly<Record<string, unknown>>, key: string, label: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new WorldAssetPreparationError(`${label} ${key} must be a nonempty string`);
  }
  return value;
};

const requireTrue = (record: Readonly<Record<string, unknown>>, key: string, label: string): true => {
  if (record[key] !== true) throw new WorldAssetPreparationError(`${label} ${key} must be true`);
  return true;
};

const requireScore = (record: Readonly<Record<string, unknown>>, key: string, label: string): 0 | 1 | 2 => {
  const value = record[key];
  if (value !== 0 && value !== 1 && value !== 2) throw new WorldAssetPreparationError(`${label} ${key} must be 0, 1, or 2`);
  return value;
};

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

type ReleaseBuildingSelectionKey = (typeof newBuildingKeys)[number];
export type BuildingSelections = Readonly<Record<ReleaseBuildingSelectionKey, number>>;
export type StoneTownSelections = Readonly<Record<StoneTownAssetKey, number>>;

export type PrepareWorldAssetOptions = {
  readonly repoRoot: string;
  readonly rawRoot: string;
  readonly phase4bRoot: string;
  readonly selections: BuildingSelections;
  readonly stoneTownSelections: StoneTownSelections;
};

export const rawFoliageFileName = (key: FoliageSpriteKey, candidate = 1): string =>
  `${key}_${String(candidate).padStart(2, "0")}.png`;

const sha256 = (filePath: string): string => createHash("sha256").update(readFileSync(filePath)).digest("hex");

const sourceForBuilding = (key: ReleaseBuildingSelectionKey, candidate: number): { readonly seed: number; readonly candidate: number } => {
  const subject = newBuildingKeys.indexOf(key);
  if (subject < 0) throw new WorldAssetPreparationError(`Unknown building selection ${key}`);
  return { seed: 64050100 + subject * 100 + candidate, candidate };
};

const sourceForStoneTownBuilding = (
  key: StoneTownAssetKey,
  selections: StoneTownSelections,
): { readonly seed: number; readonly candidate: number } => {
  const subject = STONE_TOWN_ASSET_KEYS.indexOf(key);
  if (subject < 0) throw new WorldAssetPreparationError(`Unknown Stone Town selection ${key}`);
  const candidate = selections[key];
  return { seed: 64054100 + subject * 100 + candidate, candidate };
};

const sourceForReleaseBuilding = (
  key: (typeof BUILDING_KEYS)[number],
  selections: BuildingSelections,
  stoneTownSelections: StoneTownSelections,
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
    case "quarry":
    case "masonry":
    case "market":
    case "church":
    case "keep":
    case "house_l4":
    case "stone_wall_segment":
      return sourceForStoneTownBuilding(key, stoneTownSelections);
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

export const processSelectedStoneTownBuildings = (options: PrepareWorldAssetOptions): void => {
  for (const key of STONE_TOWN_ASSET_KEYS) {
    const candidate = options.stoneTownSelections[key];
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

const copyOrProcessWorldSprite = (input: string, output: string, key: FoliageSpriteKey): void => {
  const source = readPng(input);
  const spec = FOLIAGE_SPECS[key];
  if (source.dimensions.width === spec.width && source.dimensions.height === spec.height) {
    writePng(output, source);
    return;
  }
  writePng(output, processWorldSprite(source, key));
};

const processFoliage = (
  options: PrepareWorldAssetOptions,
  selections: ReadonlyMap<(typeof TREE_STUMP_KEYS)[number], FoliageSelection>,
): void => {
  for (const key of FOLIAGE_KEYS) {
    const selected = TREE_STUMP_KEYS.some((candidate) => candidate === key)
      ? selections.get(key as (typeof TREE_STUMP_KEYS)[number])?.selectedCandidate ?? 1
      : 1;
    const input = path.join(options.rawRoot, "foliage", rawFoliageFileName(key, selected));
    copyOrProcessWorldSprite(input, outputPath(options.repoRoot, "foliage", key), key);
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

const buildingAssets = (options: PrepareWorldAssetOptions): readonly BuildingAsset[] => BUILDING_KEYS.map((key) => {
  const spec = BUILDING_SPECS[key];
  const source = sourceForReleaseBuilding(key, options.selections, options.stoneTownSelections);
  const assetPath = `public/assets/buildings/${key}.png`;
  return {
    key,
    category: "building",
    path: assetPath,
    sha256: sha256(path.join(options.repoRoot, assetPath)),
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

const foliageAssets = (
  repoRoot: string,
  selections: ReadonlyMap<(typeof TREE_STUMP_KEYS)[number], FoliageSelection>,
): readonly FoliageAsset[] => FOLIAGE_KEYS.map((key) => {
  const spec = FOLIAGE_SPECS[key];
  const assetPath = `public/assets/foliage/${key}.png`;
  const selected = TREE_STUMP_KEYS.some((candidate) => candidate === key)
    ? selections.get(key as (typeof TREE_STUMP_KEYS)[number])?.selectedCandidate ?? 1
    : 1;
  return {
    key,
    category: "foliage",
    path: assetPath,
    sha256: sha256(path.join(repoRoot, assetPath)),
    width: spec.width,
    height: spec.height,
    anchor: { x: spec.width / 2, y: spec.baselineY },
    footprint: spec.footprint,
    source: sourceForFoliage(key, selected),
    palettePolicy: key === "field_stone" ? "stone-earth" : "foliage-timber",
    alphaPolicy: "transparent-outline-179",
    variation: { selection: "hash", scale: { min: 0.7, max: 1.3 }, offset: "in-tile", sway: "sine" },
  };
});

type AssetTerrainMetrics = {
  readonly horizontalJoinBandDelta: number;
  readonly verticalJoinBandDelta: number;
  readonly horizontalInternalBandDelta: number;
  readonly verticalInternalBandDelta: number;
};

const terrainAssets = (
  repoRoot: string,
  metrics: ReadonlyMap<(typeof TERRAIN_KEYS)[number], AssetTerrainMetrics>,
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

const measureExistingTerrain = (repoRoot: string): ReadonlyMap<(typeof TERRAIN_KEYS)[number], AssetTerrainMetrics> => {
  const metrics = new Map<(typeof TERRAIN_KEYS)[number], AssetTerrainMetrics>();
  for (const key of TERRAIN_KEYS) {
    const measured = measureTerrainSeams(readPng(outputPath(repoRoot, "terrain", key)));
    assertTerrainSeams(measured);
    metrics.set(key, {
      horizontalJoinBandDelta: measured.horizontalJoinBandDelta,
      verticalJoinBandDelta: measured.verticalJoinBandDelta,
      horizontalInternalBandDelta: measured.horizontalInternalBandDelta,
      verticalInternalBandDelta: measured.verticalInternalBandDelta,
    });
  }
  return metrics;
};

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

const parseRubric = (value: unknown, label: string): SelectionRubric => {
  const record = requireRecord(value, label);
  const scores = {
    trunkGroundContact: requireScore(record, "trunkGroundContact", label),
    silhouette: requireScore(record, "silhouette", label),
    lightingVariation: requireScore(record, "lightingVariation", label),
    referenceStyle: requireScore(record, "referenceStyle", label),
  };
  const total = requireNumber(record, "total", label);
  const expected = scores.trunkGroundContact + scores.silhouette + scores.lightingVariation + scores.referenceStyle;
  if (total !== expected) throw new WorldAssetPreparationError(`${label} total must equal ${expected}`);
  return { ...scores, total };
};

const parseFoliageCandidate = (value: unknown, key: (typeof TREE_STUMP_KEYS)[number]): FoliageCandidate => {
  const record = requireRecord(value, `${key} candidate`);
  const candidate = requirePositiveInteger(record, "candidate", key);
  return {
    candidate,
    seed: requirePositiveInteger(record, "seed", `${key} candidate ${candidate}`),
    path: requireString(record, "path", `${key} candidate ${candidate}`),
    sha256: requireString(record, "sha256", `${key} candidate ${candidate}`),
    width: requirePositiveInteger(record, "width", `${key} candidate ${candidate}`),
    height: requirePositiveInteger(record, "height", `${key} candidate ${candidate}`),
    palette: requireTrue(record, "palette", `${key} candidate ${candidate}`),
    alpha: requireTrue(record, "alpha", `${key} candidate ${candidate}`),
    transparentBackground: requireTrue(record, "transparentBackground", `${key} candidate ${candidate}`),
    bakedGroundShadowAbsent: requireTrue(record, "bakedGroundShadowAbsent", `${key} candidate ${candidate}`),
    selected: requireBoolean(record, "selected", `${key} candidate ${candidate}`),
    hardRejected: requireBoolean(record, "hardRejected", `${key} candidate ${candidate}`),
    rubric: parseRubric(record["rubric"], `${key} candidate ${candidate} rubric`),
  };
};

const parseFoliageLedger = (rawRoot: string): readonly FoliageSelection[] | null => {
  const filePath = path.join(rawRoot, "foliage_selection_ledger.json");
  if (!existsSync(filePath)) return null;
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  const record = requireRecord(parsed, "foliage selection ledger");
  if (record["version"] !== 1) throw new WorldAssetPreparationError("foliage selection ledger version must be 1");
  const rawSelections = record["selections"];
  if (!Array.isArray(rawSelections)) throw new WorldAssetPreparationError("foliage selection ledger selections must be an array");
  return rawSelections.map((entry, index): FoliageSelection => {
    const selection = requireRecord(entry, "foliage selection");
    const key = TREE_STUMP_KEYS[index];
    if (key === undefined || selection["key"] !== key) {
      throw new WorldAssetPreparationError("foliage selection ledger must follow TREE_STUMP_KEYS order");
    }
    if (selection["tieBreak"] !== "lowest-seed") throw new WorldAssetPreparationError(`${key} tieBreak must be lowest-seed`);
    const rawCandidates = selection["candidates"];
    if (!Array.isArray(rawCandidates) || rawCandidates.length !== FOLIAGE_CANDIDATE_COUNT) {
      throw new WorldAssetPreparationError(`${key} candidates must contain exactly ${FOLIAGE_CANDIDATE_COUNT}`);
    }
    return {
      key,
      selectedCandidate: requirePositiveInteger(selection, "selectedCandidate", key),
      tieBreak: "lowest-seed",
      candidates: rawCandidates.map((candidate) => parseFoliageCandidate(candidate, key)),
    };
  });
};

const fallbackFoliageSelections = (rawRoot: string): readonly FoliageSelection[] => TREE_STUMP_KEYS.map((key) => {
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

const defaultParchmentMetrics: ParchmentMetrics = {
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

const parseParchmentCandidate = (value: unknown): ParchmentCandidateMetrics => {
  const record = requireRecord(value, "parchment candidate");
  return {
    candidate: requirePositiveInteger(record, "candidate", "parchment candidate"),
    path: requireString(record, "path", "parchment candidate"),
    sha256: requireString(record, "sha256", "parchment candidate"),
    width: requirePositiveInteger(record, "width", "parchment candidate"),
    height: requirePositiveInteger(record, "height", "parchment candidate"),
    opposingEdgesByteCompatible: requireBoolean(record, "opposingEdgesByteCompatible", "parchment candidate"),
    joinBandMaxDelta: requireNumber(record, "joinBandMaxDelta", "parchment candidate"),
    internalBandMaxDelta: requireNumber(record, "internalBandMaxDelta", "parchment candidate"),
    blockLumaRange: requireNumber(record, "blockLumaRange", "parchment candidate"),
    blockLumaStandardDeviation: requireNumber(record, "blockLumaStandardDeviation", "parchment candidate"),
    passed: requireBoolean(record, "passed", "parchment candidate"),
  };
};

const parchmentMetrics = (rawRoot: string): ParchmentMetrics => {
  const filePath = path.join(rawRoot, "parchment_decision.json");
  if (!existsSync(filePath)) return defaultParchmentMetrics;
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  const record = requireRecord(parsed, "parchment decision");
  const metrics = {
    ...defaultParchmentMetrics,
    decision: record["decision"] === "generated-texture" ? "generated-texture" as const : "flat-token" as const,
    candidates: Array.isArray(record["candidates"]) ? record["candidates"].map(parseParchmentCandidate) : [],
  };
  return metrics;
};

const writeManifestFromReleaseFiles = (
  options: PrepareWorldAssetOptions,
  selections: readonly FoliageSelection[],
  terrainMetrics: ReadonlyMap<(typeof TERRAIN_KEYS)[number], AssetTerrainMetrics>,
): WorldAssetManifest => {
  const selectionByKey = new Map(selections.map((selection) => [selection.key, selection]));
  const document = {
    version: 1,
    acceptedReferences: acceptedReferences(options.phase4bRoot),
    foliageSelections: selections,
    parchmentMetrics: parchmentMetrics(options.rawRoot),
    assets: [
      ...buildingAssets(options),
      ...foliageAssets(options.repoRoot, selectionByKey),
      ...terrainAssets(options.repoRoot, terrainMetrics),
    ],
  } as const;
  const manifest = parseWorldAssetManifest(document);
  writeFileSync(
    path.join(options.repoRoot, "public", "assets", "world_asset_manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return verifyWorldAssets(options.repoRoot, options.phase4bRoot);
};

export const refreshWorldAssetManifest = (options: PrepareWorldAssetOptions): WorldAssetManifest => {
  const selections = parseFoliageLedger(options.rawRoot) ?? fallbackFoliageSelections(options.rawRoot);
  return writeManifestFromReleaseFiles(options, selections, measureExistingTerrain(options.repoRoot));
};

export const prepareWorldAssets = (options: PrepareWorldAssetOptions): WorldAssetManifest => {
  const selections = parseFoliageLedger(options.rawRoot) ?? fallbackFoliageSelections(options.rawRoot);
  const selectionByKey = new Map(selections.map((selection) => [selection.key, selection]));
  copyPromotions(options);
  processSelectedBuildings(options);
  processSelectedStoneTownBuildings(options);
  processFoliage(options, selectionByKey);
  const metrics = processTerrain(options);
  return writeManifestFromReleaseFiles(options, selections, metrics);
};

type ParsedSelections = {
  readonly selections: BuildingSelections;
  readonly stoneTownSelections: StoneTownSelections;
};

const selectionRecord = (
  parsed: Readonly<Record<string, unknown>>,
  key: "building" | "stoneTown",
): Readonly<Record<string, unknown>> => {
  const nested = parsed[key];
  return isRecord(nested) ? nested : parsed;
};

const parseSelections = (filePath: string): ParsedSelections => {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!isRecord(parsed)) {
    throw new WorldAssetPreparationError("Building selections must be a JSON object");
  }
  const record = selectionRecord(parsed, "building");
  const stoneTownRecord = selectionRecord(parsed, "stoneTown");
  const actual = Object.keys(record).sort();
  const expected = [...newBuildingKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new WorldAssetPreparationError(`Building selections must contain exactly ${expected.join(",")}`);
  }
  const actualStoneTown = Object.keys(stoneTownRecord).sort();
  const expectedStoneTown = [...STONE_TOWN_ASSET_KEYS].sort();
  if (
    actualStoneTown.length !== expectedStoneTown.length
    || actualStoneTown.some((key, index) => key !== expectedStoneTown[index])
  ) {
    throw new WorldAssetPreparationError(`Stone Town selections must contain exactly ${expectedStoneTown.join(",")}`);
  }
  const value = (key: BuildingSpriteKey): number => {
    const candidate = record[key];
    if (typeof candidate !== "number" || !Number.isInteger(candidate)) {
      throw new WorldAssetPreparationError(`${key} selection must be an integer`);
    }
    return candidate;
  };
  const stoneTownValue = (key: StoneTownAssetKey): number => {
    const candidate = stoneTownRecord[key];
    if (typeof candidate !== "number" || !Number.isInteger(candidate)) {
      throw new WorldAssetPreparationError(`${key} selection must be an integer`);
    }
    return candidate;
  };
  return {
    selections: {
      house_l1: value("house_l1"),
      house_l2: value("house_l2"),
      house_l3: value("house_l3"),
      well: value("well"),
      storehouse: value("storehouse"),
      wheat_farm: value("wheat_farm"),
      logging_camp: value("logging_camp"),
      sawmill: value("sawmill"),
    },
    stoneTownSelections: {
      quarry: stoneTownValue("quarry"),
      masonry: stoneTownValue("masonry"),
      market: stoneTownValue("market"),
      church: stoneTownValue("church"),
      keep: stoneTownValue("keep"),
      house_l4: stoneTownValue("house_l4"),
      stone_wall_segment: stoneTownValue("stone_wall_segment"),
    },
  };
};

const main = (): number => { // no-excuse-ok: catch
  try {
    const [, , repoRoot, rawRoot, phase4bRoot, selectionsPath, mode] = process.argv;
    if (repoRoot === undefined || rawRoot === undefined || phase4bRoot === undefined || selectionsPath === undefined) {
      throw new WorldAssetPreparationError(
        "Usage: tsx scripts/prepareWorldAssets.ts <repo-root> <raw-root> <phase4b-root> <selections.json> [--refresh-manifest-only]",
      );
    }
    const parsed = parseSelections(selectionsPath);
    const options = { repoRoot, rawRoot, phase4bRoot, ...parsed };
    if (mode === "--refresh-manifest-only") refreshWorldAssetManifest(options);
    else prepareWorldAssets(options);
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
