import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { readPng } from "./processBuildingSprite";
import {
  ACCEPTED_REFERENCE_KEYS,
  BUILDING_KEYS,
  BUILDING_SPECS,
  FOLIAGE_KEYS,
  FOLIAGE_SPECS,
  TREE_STUMP_KEYS,
  TERRAIN_KEYS,
  TERRAIN_SPECS,
  WORLD_ASSET_KEYS,
  type AcceptedReference,
  type Anchor,
  type AssetSource,
  type FoliageKey,
  type FoliageSelection,
  type FoliageVariation,
  type Footprint,
  type ParchmentCandidateMetrics,
  type ParchmentMetrics,
  type TerrainKey,
  type TerrainSeamMetrics,
  type WorldAsset,
  type WorldAssetManifest,
} from "./worldAssetContracts";
export { parseFoliageSelectionContract } from "./worldAssetFoliageSelection";
import { parseFoliageSelectionContract } from "./worldAssetFoliageSelection";

type JsonRecord = Readonly<Record<string, unknown>>;
type CommonFields = {
  readonly path: string;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
  readonly anchor: Anchor;
  readonly footprint: Footprint;
  readonly source: AssetSource;
};

export class WorldAssetManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldAssetManifestError";
  }
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string): JsonRecord => {
  if (!isRecord(value)) {
    throw new WorldAssetManifestError(`${label} must be an object`);
  }
  return value;
};

const requireString = (record: JsonRecord, key: string, label: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new WorldAssetManifestError(`${label} ${key} must be a nonempty string`);
  }
  return value;
};

const requireBoolean = (record: JsonRecord, key: string, label: string): boolean => {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new WorldAssetManifestError(`${label} ${key} must be boolean`);
  }
  return value;
};

const requirePositiveInteger = (record: JsonRecord, key: string, label: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new WorldAssetManifestError(`${label} ${key} must be a positive integer`);
  }
  return value;
};

const requireNonnegativeNumber = (record: JsonRecord, key: string, label: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new WorldAssetManifestError(`${label} ${key} must be a nonnegative number`);
  }
  return value;
};

const requireSha256 = (record: JsonRecord, key: string, label: string): string => {
  const value = requireString(record, key, label);
  if (!/^[0-9a-f]{64}$/u.test(value)) {
    throw new WorldAssetManifestError(`${label} ${key} must be a lowercase sha256`);
  }
  return value;
};

const isMember = <Value extends string>(values: readonly Value[], value: string): value is Value =>
  values.some((candidate) => candidate === value);

const parsePair = (value: unknown, label: string): Footprint => {
  const record = requireRecord(value, label);
  return {
    width: requirePositiveInteger(record, "width", label),
    height: requirePositiveInteger(record, "height", label),
  };
};

const parseAnchor = (value: unknown, label: string): Anchor => {
  const record = requireRecord(value, label);
  return {
    x: requireNonnegativeNumber(record, "x", label),
    y: requireNonnegativeNumber(record, "y", label),
  };
};

const parseSource = (value: unknown, label: string): AssetSource => {
  const record = requireRecord(value, label);
  return {
    seed: requirePositiveInteger(record, "seed", label),
    candidate: requirePositiveInteger(record, "candidate", label),
  };
};

const parseCommon = (record: JsonRecord, key: string): CommonFields => ({
  path: requireString(record, "path", key),
  sha256: requireSha256(record, "sha256", key),
  width: requirePositiveInteger(record, "width", key),
  height: requirePositiveInteger(record, "height", key),
  anchor: parseAnchor(record["anchor"], `${key} anchor`),
  footprint: parsePair(record["footprint"], `${key} footprint`),
  source: parseSource(record["source"], `${key} source`),
});

const assertExactCommon = (
  key: string,
  category: "building" | "foliage" | "terrain",
  common: CommonFields,
  expected: { readonly width: number; readonly height: number; readonly baselineY?: number; readonly footprint: Footprint },
): void => {
  if (common.width !== expected.width || common.height !== expected.height) {
    throw new WorldAssetManifestError(
      `${key} dimensions ${common.width}x${common.height} did not match ${expected.width}x${expected.height}`,
    );
  }
  const expectedAnchor = category === "terrain"
    ? { x: 0, y: 0 }
    : { x: expected.width / 2, y: expected.baselineY ?? expected.height };
  if (common.anchor.x !== expectedAnchor.x || common.anchor.y !== expectedAnchor.y) {
    throw new WorldAssetManifestError(`${key} anchor must be ${expectedAnchor.x},${expectedAnchor.y}`);
  }
  if (
    common.footprint.width !== expected.footprint.width
    || common.footprint.height !== expected.footprint.height
  ) {
    throw new WorldAssetManifestError(
      `${key} footprint must be ${expected.footprint.width}x${expected.footprint.height}`,
    );
  }
  const expectedPath = `public/assets/${category === "building" ? "buildings" : category}/${key}.png`;
  if (
    common.path !== expectedPath
    || path.isAbsolute(common.path)
    || path.win32.isAbsolute(common.path)
    || common.path.includes("\\")
    || path.posix.normalize(common.path) !== common.path
  ) {
    throw new WorldAssetManifestError(`${key} path must be the portable repo-relative path ${expectedPath}`);
  }
};

const parseVariation = (value: unknown, key: FoliageKey): FoliageVariation => {
  const record = requireRecord(value, `${key} variation`);
  const scale = requireRecord(record["scale"], `${key} variation scale`);
  if (
    record["selection"] !== "hash"
    || requireNonnegativeNumber(scale, "min", `${key} variation scale`) !== 0.7
    || requireNonnegativeNumber(scale, "max", `${key} variation scale`) !== 1.3
    || record["offset"] !== "in-tile"
    || record["sway"] !== "sine"
  ) {
    throw new WorldAssetManifestError(`${key} variation must preserve hash, 0.7-1.3 scale, in-tile offset, and sine sway`);
  }
  return { selection: "hash", scale: { min: 0.7, max: 1.3 }, offset: "in-tile", sway: "sine" };
};

const parseAcceptedReferences = (value: unknown): readonly AcceptedReference[] => {
  if (!Array.isArray(value)) {
    throw new WorldAssetManifestError("acceptedReferences must be an array");
  }
  const references = value.map((entry): AcceptedReference => {
    const record = requireRecord(entry, "accepted reference");
    const key = requireString(record, "key", "accepted reference");
    if (!isMember(ACCEPTED_REFERENCE_KEYS, key)) {
      throw new WorldAssetManifestError(`${key} is not an accepted reference key`);
    }
    const referencePath = requireString(record, "path", key);
    const expectedPath = `public/assets/buildings/candidates_v2/${key}.png`;
    if (referencePath !== expectedPath) {
      throw new WorldAssetManifestError(`${key} path must be ${expectedPath}`);
    }
    return {
      key,
      path: referencePath,
      sha256: requireSha256(record, "sha256", key),
      width: requirePositiveInteger(record, "width", key),
      height: requirePositiveInteger(record, "height", key),
    };
  });
  const keys = references.map((reference) => reference.key);
  if (keys.length !== ACCEPTED_REFERENCE_KEYS.length || keys.some((key, index) => key !== ACCEPTED_REFERENCE_KEYS[index])) {
    throw new WorldAssetManifestError("acceptedReferences must be house_03,mill_02,granary_08 in order");
  }
  return references;
};

const parseFoliageSelections = (value: unknown): readonly FoliageSelection[] => {
  if (!Array.isArray(value)) {
    throw new WorldAssetManifestError("foliageSelections must be an array");
  }
  const selections = value.map(parseFoliageSelectionContract);
  const keys = selections.map((selection) => selection.key);
  if (keys.length !== TREE_STUMP_KEYS.length || keys.some((key, index) => key !== TREE_STUMP_KEYS[index])) {
    throw new WorldAssetManifestError("foliageSelections must match exact tree and stump keys in order");
  }
  return selections;
};

const parseParchmentMetrics = (value: unknown): ParchmentMetrics => {
  const record = requireRecord(value, "parchmentMetrics");
  const decision = requireString(record, "decision", "parchmentMetrics");
  if (decision !== "flat-token" && decision !== "generated-texture") {
    throw new WorldAssetManifestError("parchmentMetrics decision must be flat-token or generated-texture");
  }
  const thresholds = requireRecord(record["thresholds"], "parchmentMetrics thresholds");
  const expectedThresholds = {
    joinBandMaxDelta: 24,
    joinToInternalRatio: 2,
    internalTolerance: 4,
    blockLumaRangeMax: 16,
    blockLumaStandardDeviationMin: 1,
    blockLumaStandardDeviationMax: 8,
  } as const;
  for (const [key, expected] of Object.entries(expectedThresholds)) {
    if (requireNonnegativeNumber(thresholds, key, "parchmentMetrics thresholds") !== expected) {
      throw new WorldAssetManifestError(`parchmentMetrics thresholds ${key} must be ${expected}`);
    }
  }
  const rawCandidates = record["candidates"];
  if (!Array.isArray(rawCandidates)) {
    throw new WorldAssetManifestError("parchmentMetrics candidates must be an array");
  }
  const candidates = rawCandidates.map((candidate): ParchmentCandidateMetrics => {
    const candidateRecord = requireRecord(candidate, "parchment candidate");
    return {
      candidate: requirePositiveInteger(candidateRecord, "candidate", "parchment candidate"),
      path: requireString(candidateRecord, "path", "parchment candidate"),
      sha256: requireSha256(candidateRecord, "sha256", "parchment candidate"),
      width: requirePositiveInteger(candidateRecord, "width", "parchment candidate"),
      height: requirePositiveInteger(candidateRecord, "height", "parchment candidate"),
      opposingEdgesByteCompatible: requireBoolean(candidateRecord, "opposingEdgesByteCompatible", "parchment candidate"),
      joinBandMaxDelta: requireNonnegativeNumber(candidateRecord, "joinBandMaxDelta", "parchment candidate"),
      internalBandMaxDelta: requireNonnegativeNumber(candidateRecord, "internalBandMaxDelta", "parchment candidate"),
      blockLumaRange: requireNonnegativeNumber(candidateRecord, "blockLumaRange", "parchment candidate"),
      blockLumaStandardDeviation: requireNonnegativeNumber(candidateRecord, "blockLumaStandardDeviation", "parchment candidate"),
      passed: requireBoolean(candidateRecord, "passed", "parchment candidate"),
    };
  });
  const passedCandidateCount = candidates.filter((candidate) => candidate.passed).length;
  if (decision === "flat-token" && passedCandidateCount > 0) {
    throw new WorldAssetManifestError("parchmentMetrics flat-token decision cannot include passing generated candidates");
  }
  if (decision === "generated-texture" && passedCandidateCount === 0) {
    throw new WorldAssetManifestError("parchmentMetrics generated-texture decision requires a passing generated candidate");
  }
  return { decision, thresholds: expectedThresholds, candidates };
};

const parseSeamMetrics = (value: unknown, key: TerrainKey): TerrainSeamMetrics => {
  const record = requireRecord(value, `${key} seamMetrics`);
  const metrics = {
    horizontalJoinDelta: requireNonnegativeNumber(record, "horizontalJoinDelta", `${key} seamMetrics`),
    verticalJoinDelta: requireNonnegativeNumber(record, "verticalJoinDelta", `${key} seamMetrics`),
    horizontalInternalDelta: requireNonnegativeNumber(record, "horizontalInternalDelta", `${key} seamMetrics`),
    verticalInternalDelta: requireNonnegativeNumber(record, "verticalInternalDelta", `${key} seamMetrics`),
    threshold: requireNonnegativeNumber(record, "threshold", `${key} seamMetrics`),
  };
  if (record["passed"] !== true) {
    throw new WorldAssetManifestError(`${key} seamMetrics passed must be true`);
  }
  return { ...metrics, passed: true };
};

const parseAsset = (value: unknown): WorldAsset => {
  const record = requireRecord(value, "world asset");
  const key = requireString(record, "key", "world asset");
  const category = requireString(record, "category", key);
  const common = parseCommon(record, key);
  switch (category) {
    case "building": {
      if (!isMember(BUILDING_KEYS, key)) throw new WorldAssetManifestError(`${key} is not a building key`);
      assertExactCommon(key, category, common, BUILDING_SPECS[key]);
      if (record["palettePolicy"] !== "canonical-building") {
        throw new WorldAssetManifestError(`${key} palettePolicy must be canonical-building`);
      }
      if (record["alphaPolicy"] !== "transparent-outline-179") {
        throw new WorldAssetManifestError(`${key} alphaPolicy must be transparent-outline-179`);
      }
      return { key, category, ...common, palettePolicy: "canonical-building", alphaPolicy: "transparent-outline-179" };
    }
    case "foliage": {
      if (!isMember(FOLIAGE_KEYS, key)) throw new WorldAssetManifestError(`${key} is not a foliage key`);
      assertExactCommon(key, category, common, FOLIAGE_SPECS[key]);
      const palettePolicy = key === "field_stone" ? "stone-earth" : "foliage-timber";
      if (record["palettePolicy"] !== palettePolicy) {
        throw new WorldAssetManifestError(`${key} palettePolicy must be ${palettePolicy}`);
      }
      if (record["alphaPolicy"] !== "transparent-outline-179") {
        throw new WorldAssetManifestError(`${key} alphaPolicy must be transparent-outline-179`);
      }
      return {
        key,
        category,
        ...common,
        palettePolicy,
        alphaPolicy: "transparent-outline-179",
        variation: parseVariation(record["variation"], key),
      };
    }
    case "terrain": {
      if (!isMember(TERRAIN_KEYS, key)) throw new WorldAssetManifestError(`${key} is not a terrain key`);
      const spec = TERRAIN_SPECS[key];
      assertExactCommon(key, category, common, spec);
      if (record["palettePolicy"] !== spec.palettePolicy) {
        throw new WorldAssetManifestError(`${key} palettePolicy must be ${spec.palettePolicy}`);
      }
      if (record["alphaPolicy"] !== "opaque") {
        throw new WorldAssetManifestError(`${key} alphaPolicy must be opaque`);
      }
      return {
        key,
        category,
        ...common,
        palettePolicy: spec.palettePolicy,
        alphaPolicy: "opaque",
        seamMetrics: parseSeamMetrics(record["seamMetrics"], key),
      };
    }
    default:
      throw new WorldAssetManifestError(`${key} category must be building, foliage, or terrain`);
  }
};

export const parseWorldAssetManifest = (value: unknown): WorldAssetManifest => {
  const record = requireRecord(value, "world asset manifest");
  if (record["version"] !== 1) throw new WorldAssetManifestError("world asset manifest version must be 1");
  const acceptedReferences = parseAcceptedReferences(record["acceptedReferences"]);
  const foliageSelections = parseFoliageSelections(record["foliageSelections"]);
  const parchmentMetrics = parseParchmentMetrics(record["parchmentMetrics"]);
  const assetsValue = record["assets"];
  if (!Array.isArray(assetsValue)) throw new WorldAssetManifestError("world asset manifest assets must be an array");
  const assets = assetsValue.map(parseAsset);
  assertExactWorldAssetKeys(assets);
  return { version: 1, acceptedReferences, foliageSelections, parchmentMetrics, assets };
};

export const assertExactWorldAssetKeys = (assets: readonly WorldAsset[]): void => {
  const keys = assets.map((asset) => asset.key);
  if (new Set(keys).size !== keys.length) throw new WorldAssetManifestError("duplicate world asset key");
  const actual = [...keys].sort();
  const expected = [...WORLD_ASSET_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new WorldAssetManifestError(`world asset keys ${actual.join(",")} did not match ${expected.join(",")}`);
  }
};

export const assertWorldAssetFiles = (manifest: WorldAssetManifest, repoRoot: string): void => {
  for (const asset of manifest.assets) {
    const filePath = path.resolve(repoRoot, asset.path);
    if (!existsSync(filePath)) throw new WorldAssetManifestError(`missing world asset file ${asset.path}`);
    const image = readPng(filePath);
    if (image.dimensions.width !== asset.width || image.dimensions.height !== asset.height) {
      throw new WorldAssetManifestError(
        `${asset.key} file dimensions ${image.dimensions.width}x${image.dimensions.height} did not match ${asset.width}x${asset.height}`,
      );
    }
    const actualSha256 = createHash("sha256").update(readFileSync(filePath)).digest("hex");
    if (actualSha256 !== asset.sha256) {
      throw new WorldAssetManifestError(`${asset.key} file sha256 ${actualSha256} did not match ${asset.sha256}`);
    }
  }
};
