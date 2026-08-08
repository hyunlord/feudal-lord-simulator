import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { assertSelectedFoliageCandidate, assertSelectedTerrainCandidate } from "./phase10SurfaceValidators";
import { readPng, writePng } from "./processBuildingSprite";
import { processTerrainFile } from "./terrainTexturePipeline";
import {
  FOLIAGE_SPECS,
  TERRAIN_KEYS,
  TERRAIN_SPECS,
  type FoliageKey,
  type TerrainKey,
} from "./worldAssetContracts";
import { processWorldSprite, type FoliageSpriteKey } from "./worldSpritePipeline";

const SELECTED_FOLIAGE_KEYS = [
  "tree_oak_large",
  "tree_oak_small",
  "tree_pine_tall",
  "tree_pine_short",
  "tree_birch",
  "tree_dead",
] as const satisfies readonly FoliageKey[];

type SelectedFoliageKey = (typeof SELECTED_FOLIAGE_KEYS)[number];
type SurfaceCategory = "foliage" | "terrain";

type BaseSelectionEntry = {
  readonly category: SurfaceCategory;
  readonly candidate: number;
  readonly seed: number;
  readonly sourcePath: string;
  readonly rawSha256: string;
};

type FoliageSelectionEntry = BaseSelectionEntry & {
  readonly key: SelectedFoliageKey;
  readonly category: "foliage";
};

type TerrainSelectionEntry = BaseSelectionEntry & {
  readonly key: TerrainKey;
  readonly category: "terrain";
};

type SelectionEntry = FoliageSelectionEntry | TerrainSelectionEntry;

type SurfaceReportAsset = {
  readonly key: SelectionEntry["key"];
  readonly category: SurfaceCategory;
  readonly candidate: number;
  readonly seed: number;
  readonly sourcePath: string;
  readonly rawSha256: string;
  readonly outputPath: string;
  readonly outputSha256: string;
  readonly width: number;
  readonly height: number;
};

export type Phase10SurfacePostprocessReport = {
  readonly version: 1;
  readonly selectionsPath: string;
  readonly outputRoot: string;
  readonly foliage: readonly SurfaceReportAsset[];
  readonly terrain: readonly SurfaceReportAsset[];
  readonly assets: readonly SurfaceReportAsset[];
};

export type Phase10SurfacePostprocessOptions = {
  readonly selectionsPath: string;
  readonly outputRoot: string;
};

export class Phase10SurfacePostprocessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Phase10SurfacePostprocessError";
  }
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string): Readonly<Record<string, unknown>> => {
  if (!isRecord(value)) throw new Phase10SurfacePostprocessError(`${label} must be an object`);
  return value;
};

const requireString = (record: Readonly<Record<string, unknown>>, key: string, label: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Phase10SurfacePostprocessError(`${label} ${key} must be a nonempty string`);
  }
  return value;
};

const requireInteger = (record: Readonly<Record<string, unknown>>, key: string, label: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Phase10SurfacePostprocessError(`${label} ${key} must be an integer`);
  }
  return value;
};

const isSelectedFoliageKey = (key: string): key is SelectedFoliageKey =>
  SELECTED_FOLIAGE_KEYS.some((candidate) => candidate === key);

const isTerrainKey = (key: string): key is TerrainKey =>
  TERRAIN_KEYS.some((candidate) => candidate === key);

const requiredKeys = (): readonly string[] => [...SELECTED_FOLIAGE_KEYS, ...TERRAIN_KEYS];

const sha256File = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const parseEntry = (value: unknown): SelectionEntry => {
  const record = requireRecord(value, "selection");
  const key = requireString(record, "group", "selection");
  const category = requireString(record, "category", key);
  if (category !== "foliage" && category !== "terrain") {
    throw new Phase10SurfacePostprocessError(`${key} category must be foliage or terrain`);
  }
  if (category === "foliage" && !isSelectedFoliageKey(key)) {
    throw new Phase10SurfacePostprocessError(`${key} is not a selected Phase10 foliage key`);
  }
  if (category === "terrain" && !isTerrainKey(key)) {
    throw new Phase10SurfacePostprocessError(`${key} is not a terrain key`);
  }
  const rawSha256 = requireString(record, "sha256", key);
  if (!SHA256_PATTERN.test(rawSha256)) throw new Phase10SurfacePostprocessError(`${key} sha256 must be lowercase hex`);
  const sourcePath = requireString(record, "source_abs_path", key);
  if (!path.isAbsolute(sourcePath)) throw new Phase10SurfacePostprocessError(`${key} source_abs_path must be absolute`);
  const candidate = requireInteger(record, "candidate", key);
  const seed = requireInteger(record, "seed", key);
  if (category === "foliage" && isSelectedFoliageKey(key)) {
    return { key, category, candidate, seed, sourcePath, rawSha256 };
  }
  if (category === "terrain" && isTerrainKey(key)) {
    return { key, category, candidate, seed, sourcePath, rawSha256 };
  }
  throw new Phase10SurfacePostprocessError(`${key} has inconsistent category ${category}`);
};

const parseSelections = (filePath: string): readonly SelectionEntry[] => {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  const record = requireRecord(parsed, "selection document");
  const rawSelections = record["selections"];
  if (!Array.isArray(rawSelections)) throw new Phase10SurfacePostprocessError("selection document selections must be an array");
  const selections = rawSelections.map(parseEntry);
  const sortedActual = selections.map((selection) => selection.key).sort();
  const sortedExpected = [...requiredKeys()].sort();
  if (sortedActual.length !== sortedExpected.length || sortedActual.some((key, index) => key !== sortedExpected[index])) {
    throw new Phase10SurfacePostprocessError(`selection document must contain exactly ${sortedExpected.join(",")}`);
  }
  return selections;
};

const assertRawSha = (selection: SelectionEntry): void => {
  const actual = sha256File(selection.sourcePath);
  if (actual !== selection.rawSha256) {
    throw new Phase10SurfacePostprocessError(`${selection.key} raw sha mismatch: expected ${selection.rawSha256}, got ${actual}`);
  }
};

const outputPathFor = (outputRoot: string, selection: SelectionEntry): string =>
  path.join(outputRoot, selection.category, `${selection.key}.png`);

const processFoliage = (selection: SelectionEntry, outputPath: string): void => {
  if (selection.category !== "foliage" || !isSelectedFoliageKey(selection.key)) {
    throw new Phase10SurfacePostprocessError(`${selection.key} must be selected foliage`);
  }
  const processed = processWorldSprite(readPng(selection.sourcePath), selection.key as FoliageSpriteKey);
  writePng(outputPath, processed);
  assertSelectedFoliageCandidate(outputPath, selection.key);
};

const processTerrain = (selection: SelectionEntry, outputPath: string): void => {
  if (selection.category !== "terrain" || !isTerrainKey(selection.key)) {
    throw new Phase10SurfacePostprocessError(`${selection.key} must be terrain`);
  }
  processTerrainFile(selection.sourcePath, outputPath, selection.key);
  assertSelectedTerrainCandidate(outputPath, selection.key);
};

const reportAsset = (selection: SelectionEntry, outputRoot: string): SurfaceReportAsset => {
  const outputPath = outputPathFor(outputRoot, selection);
  const dimensions = selection.category === "foliage"
    ? FOLIAGE_SPECS[selection.key]
    : TERRAIN_SPECS[selection.key];
  return {
    key: selection.key,
    category: selection.category,
    candidate: selection.candidate,
    seed: selection.seed,
    sourcePath: selection.sourcePath,
    rawSha256: selection.rawSha256,
    outputPath,
    outputSha256: sha256File(outputPath),
    width: dimensions.width,
    height: dimensions.height,
  };
};

const run = (options: Phase10SurfacePostprocessOptions): Phase10SurfacePostprocessReport => {
  const selections = parseSelections(options.selectionsPath);
  const assets: SurfaceReportAsset[] = [];
  for (const selection of selections) {
    assertRawSha(selection);
    const outputPath = outputPathFor(options.outputRoot, selection);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    if (selection.category === "foliage") processFoliage(selection, outputPath);
    else processTerrain(selection, outputPath);
    assets.push(reportAsset(selection, options.outputRoot));
  }
  const report = {
    version: 1,
    selectionsPath: options.selectionsPath,
    outputRoot: options.outputRoot,
    foliage: assets.filter((asset) => asset.category === "foliage"),
    terrain: assets.filter((asset) => asset.category === "terrain"),
    assets,
  } as const satisfies Phase10SurfacePostprocessReport;
  writeFileSync(path.join(options.outputRoot, "postprocess-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
};

const main = (): number => { // no-excuse-ok: catch
  try {
    const [, , selectionsPath, outputRoot] = process.argv;
    if (selectionsPath === undefined || outputRoot === undefined) {
      throw new Phase10SurfacePostprocessError("Usage: tsx scripts/preparePhase10SurfaceSelections.ts <selections.json> <output-root>");
    }
    run({ selectionsPath, outputRoot });
    writeFileSync(1, "Phase10 surface postprocess passed\n");
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

export const preparePhase10SurfaceSelections = { run, sha256File } as const;
