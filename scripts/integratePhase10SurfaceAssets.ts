import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  processTerrainFile,
  type TerrainKey,
  type TerrainSeamMetrics as PipelineTerrainSeamMetrics,
} from "./terrainTexturePipeline";
import { readPng, writePng } from "./processBuildingSprite";
import { processWorldSprite } from "./worldSpritePipeline";
import { assertSelectedFoliageCandidate, assertSelectedTerrainCandidate } from "./phase10SurfaceValidators";
import { parseWorldAssetManifest } from "./worldAssetManifest";
import { verifyWorldAssets } from "./verifyWorldAssets";
import {
  BUILDING_KEYS,
  FOLIAGE_KEYS,
  FOLIAGE_SPECS,
  STONE_TOWN_ASSET_KEYS,
  TERRAIN_KEYS,
  TERRAIN_SPECS,
  type FoliageKey,
  type TerrainSeamMetrics as ManifestTerrainSeamMetrics,
  type WorldAsset,
  type WorldAssetManifest,
} from "./worldAssetContracts";

export class Phase10SurfaceIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Phase10SurfaceIntegrationError";
  }
}

type JsonRecord = Readonly<Record<string, unknown>>;

export type Phase10SurfaceCategory = "foliage" | "terrain";

export type Phase10SurfaceSelection = {
  readonly group: FoliageKey | TerrainKey;
  readonly category: Phase10SurfaceCategory;
  readonly candidate: number;
  readonly seed: number;
  readonly sourceAbsPath: string;
  readonly sha256: string;
};

export type Phase10SurfaceIntegrationSummary = {
  readonly selectionPath: string;
  readonly repoRoot: string;
  readonly phase4bRoot: string;
  readonly assets: readonly {
    readonly key: string;
    readonly category: Phase10SurfaceCategory;
    readonly candidate: number;
    readonly seed: number;
    readonly sourceAbsPath: string;
    readonly sourceSha256: string;
    readonly releasePath: string;
    readonly releaseSha256: string;
    readonly width: number;
    readonly height: number;
    readonly seamMetrics?: ManifestTerrainSeamMetrics;
  }[];
  readonly manifestAssetCount: number;
  readonly manifestSha256: string;
  readonly runtimeManifestSha256: string;
};

const SELECTED_FOLIAGE_KEYS = [
  "tree_oak_large",
  "tree_oak_small",
  "tree_pine_tall",
  "tree_pine_short",
  "tree_birch",
  "tree_dead",
] as const satisfies readonly FoliageKey[];

const SELECTED_TERRAIN_KEYS = [
  "grass",
  "forest_floor",
  "water",
  "rock",
  "packed_earth_road",
] as const satisfies readonly TerrainKey[];

const selectedFoliageKeySet = new Set<string>(SELECTED_FOLIAGE_KEYS);
const selectedTerrainKeySet = new Set<string>(SELECTED_TERRAIN_KEYS);
const selectedSurfaceKeySet = new Set<string>([...SELECTED_FOLIAGE_KEYS, ...SELECTED_TERRAIN_KEYS]);
const stoneTownAssetKeySet = new Set<string>(STONE_TOWN_ASSET_KEYS);
const releaseManifestOrder = [
  ...BUILDING_KEYS.filter((key) => !stoneTownAssetKeySet.has(key)),
  ...FOLIAGE_KEYS,
  ...TERRAIN_KEYS,
  ...STONE_TOWN_ASSET_KEYS,
] as const;
const worldAssetOrder: ReadonlyMap<string, number> = new Map(releaseManifestOrder.map((key, index) => [key, index]));

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string): JsonRecord => {
  if (!isRecord(value)) throw new Phase10SurfaceIntegrationError(`${label} must be an object`);
  return value;
};

const requireString = (record: JsonRecord, key: string, label: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Phase10SurfaceIntegrationError(`${label} ${key} must be a nonempty string`);
  }
  return value;
};

const requirePositiveInteger = (record: JsonRecord, key: string, label: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Phase10SurfaceIntegrationError(`${label} ${key} must be a positive integer`);
  }
  return value;
};

const requireSha256 = (record: JsonRecord, key: string, label: string): string => {
  const value = requireString(record, key, label);
  if (!/^[0-9a-f]{64}$/u.test(value)) {
    throw new Phase10SurfaceIntegrationError(`${label} ${key} must be a lowercase sha256`);
  }
  return value;
};

const fileSha256 = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const assertArrayKeys = (
  selections: readonly Phase10SurfaceSelection[],
  category: Phase10SurfaceCategory,
  expected: readonly string[],
): void => {
  const actual = selections.filter((selection) => selection.category === category).map((selection) => selection.group);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Phase10SurfaceIntegrationError(
      `${category} selections must be exactly ${expected.join(",")} in order`,
    );
  }
};

const parseSelectionEntry = (value: unknown): Phase10SurfaceSelection => {
  const record = requireRecord(value, "Phase10 surface selection");
  const group = requireString(record, "group", "Phase10 surface selection");
  const category = requireString(record, "category", group);
  if (category !== "foliage" && category !== "terrain") {
    throw new Phase10SurfaceIntegrationError(`${group} category must be foliage or terrain`);
  }
  if (category === "foliage" && !selectedFoliageKeySet.has(group)) {
    throw new Phase10SurfaceIntegrationError(`${group} is not a Phase10 selected foliage key`);
  }
  if (category === "terrain" && !selectedTerrainKeySet.has(group)) {
    throw new Phase10SurfaceIntegrationError(`${group} is not a Phase10 selected terrain key`);
  }
  const candidate = requirePositiveInteger(record, "candidate", group);
  if (candidate > 6) throw new Phase10SurfaceIntegrationError(`${group} candidate must be 1 through 6`);
  return {
    group: group as FoliageKey | TerrainKey,
    category,
    candidate,
    seed: requirePositiveInteger(record, "seed", group),
    sourceAbsPath: requireString(record, "source_abs_path", group),
    sha256: requireSha256(record, "sha256", group),
  };
};

export const parsePhase10SurfaceSelectionDocument = (selectionPath: string): readonly Phase10SurfaceSelection[] => {
  const root = requireRecord(JSON.parse(readFileSync(selectionPath, "utf8")), "Phase10 surface selection document");
  const unacceptableGroups = root["unacceptable_groups"];
  if (!Array.isArray(unacceptableGroups)) {
    throw new Phase10SurfaceIntegrationError("unacceptable_groups must be an array");
  }
  if (unacceptableGroups.length > 0) {
    throw new Phase10SurfaceIntegrationError(`cannot integrate unacceptable groups: ${unacceptableGroups.join(",")}`);
  }
  const rawSelections = root["selections"];
  if (!Array.isArray(rawSelections)) {
    throw new Phase10SurfaceIntegrationError("selections must be an array");
  }
  const selections = rawSelections.map(parseSelectionEntry);
  if (new Set(selections.map((selection) => selection.group)).size !== selections.length) {
    throw new Phase10SurfaceIntegrationError("Phase10 surface selections must not contain duplicate groups");
  }
  assertArrayKeys(selections, "foliage", SELECTED_FOLIAGE_KEYS);
  assertArrayKeys(selections, "terrain", SELECTED_TERRAIN_KEYS);
  for (const selection of selections) {
    if (path.isAbsolute(selection.sourceAbsPath) !== true) {
      throw new Phase10SurfaceIntegrationError(`${selection.group} source_abs_path must be absolute`);
    }
    if (!existsSync(selection.sourceAbsPath)) {
      throw new Phase10SurfaceIntegrationError(`${selection.group} source image is missing: ${selection.sourceAbsPath}`);
    }
    const actualSha256 = fileSha256(selection.sourceAbsPath);
    if (actualSha256 !== selection.sha256) {
      throw new Phase10SurfaceIntegrationError(
        `${selection.group} source sha256 ${actualSha256} did not match ${selection.sha256}`,
      );
    }
  }
  return selections;
};

const manifestSeamMetrics = (metrics: PipelineTerrainSeamMetrics) => ({
  horizontalJoinDelta: metrics.horizontalJoinBandDelta,
  verticalJoinDelta: metrics.verticalJoinBandDelta,
  horizontalInternalDelta: metrics.horizontalInternalBandDelta,
  verticalInternalDelta: metrics.verticalInternalBandDelta,
  threshold: 24,
  passed: true,
} as const);

const updateRuntimeManifest = (repoRoot: string, manifest: WorldAssetManifest): void => {
  const runtime = {
    assets: manifest.assets.map((asset) => ({
      key: asset.key,
      category: asset.category,
      path: asset.path,
      width: asset.width,
      height: asset.height,
      anchor: asset.anchor,
      footprint: asset.footprint,
    })),
  } as const;
  writeFileSync(
    path.join(repoRoot, "src", "render", "worldAssetManifest.generated.ts"),
    `export const runtimeWorldAssetManifest = ${JSON.stringify(runtime, null, 2)} as const;\n`,
  );
};

const foliageAsset = (repoRoot: string, selection: Phase10SurfaceSelection): WorldAsset => {
  const key = selection.group as FoliageKey;
  const spec = FOLIAGE_SPECS[key];
  const assetPath = `public/assets/foliage/${key}.png`;
  return {
    key,
    category: "foliage",
    path: assetPath,
    sha256: fileSha256(path.join(repoRoot, assetPath)),
    width: spec.width,
    height: spec.height,
    anchor: { x: spec.width / 2, y: spec.baselineY },
    footprint: spec.footprint,
    source: { seed: selection.seed, candidate: selection.candidate },
    palettePolicy: "foliage-timber",
    alphaPolicy: "transparent-outline-179",
    variation: { selection: "hash", scale: { min: 0.7, max: 1.3 }, offset: "in-tile", sway: "sine" },
  };
};

const terrainAsset = (
  repoRoot: string,
  selection: Phase10SurfaceSelection,
  seamMetrics: PipelineTerrainSeamMetrics,
): WorldAsset => {
  const key = selection.group as TerrainKey;
  const spec = TERRAIN_SPECS[key];
  const assetPath = `public/assets/terrain/${key}.png`;
  return {
    key,
    category: "terrain",
    path: assetPath,
    sha256: fileSha256(path.join(repoRoot, assetPath)),
    width: spec.width,
    height: spec.height,
    anchor: { x: 0, y: 0 },
    footprint: spec.footprint,
    source: { seed: selection.seed, candidate: selection.candidate },
    palettePolicy: spec.palettePolicy,
    alphaPolicy: "opaque",
    seamMetrics: manifestSeamMetrics(seamMetrics),
  };
};

export const integratePhase10SurfaceAssets = (
  repoRoot: string,
  phase4bRoot: string,
  selectionPath: string,
  summaryPath?: string,
): Phase10SurfaceIntegrationSummary => {
  const selections = parsePhase10SurfaceSelectionDocument(selectionPath);
  const seamMetricByKey = new Map<TerrainKey, PipelineTerrainSeamMetrics>();

  for (const selection of selections) {
    if (selection.category === "foliage") {
      const key = selection.group as FoliageKey;
      const releasePath = path.join(repoRoot, "public", "assets", "foliage", `${key}.png`);
      writePng(releasePath, processWorldSprite(readPng(selection.sourceAbsPath), key));
      assertSelectedFoliageCandidate(releasePath, key);
      continue;
    }
    const key = selection.group as TerrainKey;
    const releasePath = path.join(repoRoot, "public", "assets", "terrain", `${key}.png`);
    const metrics = processTerrainFile(selection.sourceAbsPath, releasePath, key);
    assertSelectedTerrainCandidate(releasePath, key);
    seamMetricByKey.set(key, metrics);
  }

  const manifestPath = path.join(repoRoot, "public", "assets", "world_asset_manifest.json");
  const current = requireRecord(JSON.parse(readFileSync(manifestPath, "utf8")), "current world asset manifest");
  const currentAssets = current["assets"];
  if (!Array.isArray(currentAssets)) {
    throw new Phase10SurfaceIntegrationError("current manifest assets must be an array");
  }
  const selectionByKey: ReadonlyMap<string, Phase10SurfaceSelection> = new Map(
    selections.map((selection) => [selection.group, selection]),
  );
  const replacementAsset = (asset: unknown): unknown => {
    if (!isRecord(asset) || typeof asset["key"] !== "string" || !selectedSurfaceKeySet.has(asset["key"])) return asset;
    const key = asset["key"];
    const selection = selectionByKey.get(key);
    if (selection === undefined) throw new Phase10SurfaceIntegrationError(`${key} selection is missing`);
    if (selection.category === "foliage") return foliageAsset(repoRoot, selection);
    const metrics = seamMetricByKey.get(key as TerrainKey);
    if (metrics === undefined) throw new Phase10SurfaceIntegrationError(`${key} terrain integration result is missing`);
    return terrainAsset(repoRoot, selection, metrics);
  };
  const nextDocument = {
    version: 1,
    acceptedReferences: current["acceptedReferences"],
    foliageSelections: current["foliageSelections"],
    parchmentMetrics: current["parchmentMetrics"],
    assets: [...currentAssets.map(replacementAsset)]
      .sort((left: unknown, right: unknown) => {
        const leftKey = isRecord(left) && typeof left["key"] === "string" ? left["key"] : "";
        const rightKey = isRecord(right) && typeof right["key"] === "string" ? right["key"] : "";
        return (worldAssetOrder.get(leftKey) ?? Number.MAX_SAFE_INTEGER)
          - (worldAssetOrder.get(rightKey) ?? Number.MAX_SAFE_INTEGER);
      }),
  } as const;
  const manifest = parseWorldAssetManifest(nextDocument);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const verified = verifyWorldAssets(repoRoot, phase4bRoot);
  updateRuntimeManifest(repoRoot, verified);

  const assets = selections.map((selection) => {
    const releasePath = selection.category === "foliage"
      ? `public/assets/foliage/${selection.group}.png`
      : `public/assets/terrain/${selection.group}.png`;
    const image = readPng(path.join(repoRoot, releasePath));
    const terrain = selection.category === "terrain"
      ? verified.assets.find((asset) => asset.key === selection.group && asset.category === "terrain")
      : undefined;
    const metrics = terrain?.category === "terrain" ? terrain.seamMetrics : undefined;
    return {
      key: selection.group,
      category: selection.category,
      candidate: selection.candidate,
      seed: selection.seed,
      sourceAbsPath: selection.sourceAbsPath,
      sourceSha256: selection.sha256,
      releasePath,
      releaseSha256: fileSha256(path.join(repoRoot, releasePath)),
      width: image.dimensions.width,
      height: image.dimensions.height,
      ...(metrics === undefined ? {} : { seamMetrics: metrics }),
    };
  });
  const summary: Phase10SurfaceIntegrationSummary = {
    selectionPath,
    repoRoot,
    phase4bRoot,
    assets,
    manifestAssetCount: verified.assets.length,
    manifestSha256: fileSha256(manifestPath),
    runtimeManifestSha256: fileSha256(path.join(repoRoot, "src", "render", "worldAssetManifest.generated.ts")),
  };
  if (summaryPath !== undefined) {
    mkdirSync(path.dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
  return summary;
};

const main = (): number => { // no-excuse-ok: CLI boundary prints caught errors
  try {
    const [, , repoRoot, phase4bRoot, selectionPath, summaryPath] = process.argv;
    if (repoRoot === undefined || phase4bRoot === undefined || selectionPath === undefined) {
      throw new Phase10SurfaceIntegrationError(
        "Usage: tsx scripts/integratePhase10SurfaceAssets.ts <repo-root> <phase4b-root> <selections.json> [summary-path]",
      );
    }
    integratePhase10SurfaceAssets(repoRoot, phase4bRoot, selectionPath, summaryPath);
    writeFileSync(1, "Phase10 surface asset integration passed\n");
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
