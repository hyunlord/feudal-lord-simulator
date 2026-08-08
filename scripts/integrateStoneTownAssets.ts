import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { processSelectedStoneTownBuildings, type BuildingSelections, type StoneTownSelections } from "./prepareWorldAssets";
import { parseWorldAssetManifest } from "./worldAssetManifest";
import { verifyWorldAssets } from "./verifyWorldAssets";
import {
  BUILDING_SPECS,
  STONE_TOWN_ASSET_KEYS,
  type StoneTownAssetKey,
  type WorldAssetManifest,
} from "./worldAssetContracts";

export class StoneTownAssetIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoneTownAssetIntegrationError";
  }
}

type JsonRecord = Readonly<Record<string, unknown>>;
type SelectionDocument = {
  readonly building: BuildingSelections;
  readonly stoneTown: StoneTownSelections;
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string): JsonRecord => {
  if (!isRecord(value)) throw new StoneTownAssetIntegrationError(`${label} must be an object`);
  return value;
};

const requireCandidate = (record: JsonRecord, key: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 6) {
    throw new StoneTownAssetIntegrationError(`${key} selection must be an integer from 1 through 6`);
  }
  return value;
};

const parseSelections = (filePath: string): SelectionDocument => {
  const root = requireRecord(JSON.parse(readFileSync(filePath, "utf8")), "selection document");
  const building = requireRecord(root["building"], "building selections");
  const stoneTown = requireRecord(root["stoneTown"], "Stone Town selections");
  return {
    building: {
      house_l1: requireCandidate(building, "house_l1"),
      house_l2: requireCandidate(building, "house_l2"),
      house_l3: requireCandidate(building, "house_l3"),
      well: requireCandidate(building, "well"),
      storehouse: requireCandidate(building, "storehouse"),
      wheat_farm: requireCandidate(building, "wheat_farm"),
      logging_camp: requireCandidate(building, "logging_camp"),
      sawmill: requireCandidate(building, "sawmill"),
    },
    stoneTown: {
      quarry: requireCandidate(stoneTown, "quarry"),
      masonry: requireCandidate(stoneTown, "masonry"),
      market: requireCandidate(stoneTown, "market"),
      church: requireCandidate(stoneTown, "church"),
      keep: requireCandidate(stoneTown, "keep"),
      house_l4: requireCandidate(stoneTown, "house_l4"),
      stone_wall_segment: requireCandidate(stoneTown, "stone_wall_segment"),
    },
  };
};

const sha256 = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const stoneTownAsset = (
  repoRoot: string,
  selections: StoneTownSelections,
  key: StoneTownAssetKey,
) => {
  const spec = BUILDING_SPECS[key];
  const subject = STONE_TOWN_ASSET_KEYS.indexOf(key);
  if (subject < 0) throw new StoneTownAssetIntegrationError(`unknown Stone Town key ${key}`);
  const candidate = selections[key];
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
    source: { seed: 64054100 + subject * 100 + candidate, candidate },
    palettePolicy: "canonical-building",
    alphaPolicy: "transparent-outline-179",
  } as const;
};

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

export const integrateStoneTownAssets = (
  repoRoot: string,
  rawRoot: string,
  phase4bRoot: string,
  selectionsPath: string,
): WorldAssetManifest => {
  const selectionDocument = parseSelections(selectionsPath);
  processSelectedStoneTownBuildings({
    repoRoot,
    rawRoot,
    phase4bRoot,
    selections: selectionDocument.building,
    stoneTownSelections: selectionDocument.stoneTown,
  });
  const manifestPath = path.join(repoRoot, "public", "assets", "world_asset_manifest.json");
  const current = requireRecord(JSON.parse(readFileSync(manifestPath, "utf8")), "current manifest");
  const rawAssets = current["assets"];
  if (!Array.isArray(rawAssets)) throw new StoneTownAssetIntegrationError("current manifest assets must be an array");
  const stoneTownKeys = new Set<string>(STONE_TOWN_ASSET_KEYS);
  const nextDocument = {
    version: 1,
    acceptedReferences: current["acceptedReferences"],
    foliageSelections: current["foliageSelections"],
    parchmentMetrics: current["parchmentMetrics"],
    assets: [
      ...rawAssets.filter((asset) =>
        isRecord(asset) && typeof asset["key"] === "string" && !stoneTownKeys.has(asset["key"])
      ),
      ...STONE_TOWN_ASSET_KEYS.map((key) => stoneTownAsset(repoRoot, selectionDocument.stoneTown, key)),
    ],
  } as const;
  const manifest = parseWorldAssetManifest(nextDocument);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const verified = verifyWorldAssets(repoRoot, phase4bRoot);
  updateRuntimeManifest(repoRoot, verified);
  return verified;
};

const main = (): number => { // no-excuse-ok: catch
  try {
    const [, , repoRoot, rawRoot, phase4bRoot, selectionsPath, evidencePath] = process.argv;
    if (
      repoRoot === undefined
      || rawRoot === undefined
      || phase4bRoot === undefined
      || selectionsPath === undefined
    ) {
      throw new StoneTownAssetIntegrationError(
        "Usage: tsx scripts/integrateStoneTownAssets.ts <repo-root> <raw-root> <phase4b-root> <selections.json> [evidence-path]",
      );
    }
    const manifest = integrateStoneTownAssets(repoRoot, rawRoot, phase4bRoot, selectionsPath);
    if (evidencePath !== undefined) {
      mkdirSync(path.dirname(evidencePath), { recursive: true });
      writeFileSync(evidencePath, `${JSON.stringify({ assets: manifest.assets.length }, null, 2)}\n`);
    }
    writeFileSync(1, "Stone Town asset integration passed\n");
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
