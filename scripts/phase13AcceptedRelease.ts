import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readPng, type RgbaImage } from "./processBuildingSprite";
import { parseWorldAssetManifest } from "./worldAssetManifest";
import {
  BUILDING_KEYS,
  FOLIAGE_KEYS,
  TERRAIN_KEYS,
  WORLD_ASSET_KEYS,
  type AssetSource,
  type WorldAssetKey,
} from "./worldAssetContracts";

export type Phase13AssetCategory = "building" | "foliage" | "terrain";
export type Phase13ReleaseMode = "legacy-promotions" | "phase13-full-colour" | "phase13-partial-accepted-release";
export type Phase13AcceptedAsset = {
  readonly category: Phase13AssetCategory;
  readonly key: WorldAssetKey;
};
export type Phase13AcceptedRelease = {
  readonly version: 1;
  readonly mode: "phase13-partial-accepted-release";
  readonly accepted: readonly Phase13AcceptedAsset[];
};
export type Phase13ReleaseStatus = {
  readonly key: WorldAssetKey;
  readonly category: Phase13AssetCategory;
  readonly status: "accepted-generated" | "preserved-existing";
  readonly path: string;
  readonly sha256: string;
  readonly source: AssetSource;
};
type Phase13ReleaseEvidence = {
  readonly version: 1;
  readonly mode: "phase13-partial-accepted-release";
  readonly statuses: readonly Phase13ReleaseStatus[];
};

export class Phase13AcceptedReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Phase13AcceptedReleaseError";
  }
}

export const PHASE13_EVIDENCE_PATH = path.join("docs", "asset-evidence", "phase13WorldRelease.json");

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isWorldAssetKey = (value: string): value is WorldAssetKey =>
  WORLD_ASSET_KEYS.some((key) => key === value);

export const categoryForWorldAssetKey = (key: WorldAssetKey): Phase13AssetCategory => {
  if (BUILDING_KEYS.some((candidate) => candidate === key)) return "building";
  if (FOLIAGE_KEYS.some((candidate) => candidate === key)) return "foliage";
  return "terrain";
};

export const phase13SourceForWorldAsset = (key: WorldAssetKey): AssetSource => {
  const index = WORLD_ASSET_KEYS.indexOf(key);
  if (index < 0) throw new Phase13AcceptedReleaseError(`unknown Phase13 source key ${key}`);
  return { seed: 71300001 + index, candidate: 1 };
};

export const releasePathForWorldAsset = (key: WorldAssetKey): string => {
  const category = categoryForWorldAssetKey(key);
  const folder = category === "building" ? "buildings" : category;
  return path.join("public", "assets", folder, `${key}.png`);
};

export const rawPathForAcceptedAsset = (rawRoot: string, asset: Phase13AcceptedAsset): string => {
  const fileName = asset.category === "terrain" ? `${asset.key}.png` : `${asset.key}_01.png`;
  return path.join(rawRoot, asset.category, fileName);
};

export const acceptedKeySet = (release: Phase13AcceptedRelease): ReadonlySet<WorldAssetKey> =>
  new Set(release.accepted.map((asset) => asset.key));

const assertAssetSource = (key: WorldAssetKey, value: unknown): AssetSource => {
  if (!isRecord(value)) throw new Phase13AcceptedReleaseError(`${key} evidence source is invalid`);
  const seed = value["seed"];
  const candidate = value["candidate"];
  if (typeof seed !== "number" || typeof candidate !== "number" || !Number.isInteger(seed) || !Number.isInteger(candidate)) {
    throw new Phase13AcceptedReleaseError(`${key} evidence source is invalid`);
  }
  return { seed, candidate };
};

const parsePhase13ReleaseStatus = (value: unknown): Phase13ReleaseStatus => {
  if (!isRecord(value) || typeof value["key"] !== "string" || !isWorldAssetKey(value["key"])) {
    throw new Phase13AcceptedReleaseError("Phase13 release evidence contains an invalid key");
  }
  const key = value["key"];
  const category = value["category"];
  const status = value["status"];
  const releasePath = value["path"];
  const sha256 = value["sha256"];
  if (category !== "building" && category !== "foliage" && category !== "terrain") {
    throw new Phase13AcceptedReleaseError(`${key} evidence category is invalid`);
  }
  if (status !== "accepted-generated" && status !== "preserved-existing") {
    throw new Phase13AcceptedReleaseError(`${key} evidence status is invalid`);
  }
  if (typeof releasePath !== "string") throw new Phase13AcceptedReleaseError(`${key} evidence path is invalid`);
  if (typeof sha256 !== "string") throw new Phase13AcceptedReleaseError(`${key} evidence sha256 is invalid`);
  return { key, category, status, path: releasePath, sha256, source: assertAssetSource(key, value["source"]) };
};

const readPhase13ReleaseEvidence = (filePath: string): Phase13ReleaseEvidence => {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!isRecord(parsed) || parsed["version"] !== 1 || parsed["mode"] !== "phase13-partial-accepted-release") {
    throw new Phase13AcceptedReleaseError("Phase13 release evidence header is invalid");
  }
  const statuses = parsed["statuses"];
  if (!Array.isArray(statuses) || statuses.length !== WORLD_ASSET_KEYS.length) {
    throw new Phase13AcceptedReleaseError("Phase13 release evidence must include every world asset key");
  }
  return { version: 1, mode: "phase13-partial-accepted-release", statuses: statuses.map(parsePhase13ReleaseStatus) };
};

export const readPhase13AcceptedRelease = (filePath: string): Phase13AcceptedRelease => {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!isRecord(parsed)) throw new Phase13AcceptedReleaseError("accepted release record must be an object");
  if (parsed["version"] !== 1) throw new Phase13AcceptedReleaseError("accepted release version must be 1");
  if (parsed["mode"] !== "phase13-partial-accepted-release") {
    throw new Phase13AcceptedReleaseError("accepted release mode must be phase13-partial-accepted-release");
  }
  const rawAccepted = parsed["accepted"];
  if (!Array.isArray(rawAccepted) || rawAccepted.length === 0) {
    throw new Phase13AcceptedReleaseError("accepted release must contain at least one accepted asset");
  }
  const seen = new Set<string>();
  const accepted = rawAccepted.map((entry): Phase13AcceptedAsset => {
    if (!isRecord(entry)) throw new Phase13AcceptedReleaseError("accepted asset must be an object");
    const category = entry["category"];
    const key = entry["key"];
    if (category !== "building" && category !== "foliage" && category !== "terrain") {
      throw new Phase13AcceptedReleaseError("accepted asset category must be building, foliage, or terrain");
    }
    if (typeof key !== "string" || !isWorldAssetKey(key)) {
      throw new Phase13AcceptedReleaseError(`unknown accepted asset key ${String(key)}`);
    }
    const actualCategory = categoryForWorldAssetKey(key);
    if (actualCategory !== category) {
      throw new Phase13AcceptedReleaseError(`category mismatch for ${key}: ${category} is not ${actualCategory}`);
    }
    if (seen.has(key)) throw new Phase13AcceptedReleaseError(`duplicate accepted asset key ${key}`);
    seen.add(key);
    return { category, key };
  });
  return { version: 1, mode: "phase13-partial-accepted-release", accepted };
};

export const assertAcceptedRawAssetsExist = (rawRoot: string, release: Phase13AcceptedRelease): void => {
  for (const asset of release.accepted) {
    const filePath = rawPathForAcceptedAsset(rawRoot, asset);
    if (!existsSync(filePath)) throw new Phase13AcceptedReleaseError(`missing raw Phase13 asset for ${asset.key}: ${filePath}`);
  }
};

export const sha256File = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const visibleColourCount = (image: RgbaImage, requireOpaque: boolean): number => {
  const colours = new Set<string>();
  for (let index = 0; index < image.rgba.length; index += 4) {
    const alpha = image.rgba[index + 3];
    if (requireOpaque ? alpha !== 255 : alpha === 0) continue;
    colours.add(`${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]}`);
  }
  return colours.size;
};

export const assertPhase13AcceptedVisualFloors = (repoRoot: string, release: Phase13AcceptedRelease): void => {
  for (const asset of release.accepted) {
    if (asset.category === "foliage") continue;
    const filePath = path.join(repoRoot, releasePathForWorldAsset(asset.key));
    const image = readPng(filePath);
    const minimum = asset.category === "terrain" ? 100 : 80;
    const count = visibleColourCount(image, asset.category === "terrain");
    if (count <= minimum) {
      throw new Phase13AcceptedReleaseError(`${asset.key} has ${count} visible colours; expected more than ${minimum}`);
    }
  }
};

export const assertPhase13FullColourVisualFloors = (repoRoot: string): void => {
  const release: Phase13AcceptedRelease = {
    version: 1,
    mode: "phase13-partial-accepted-release",
    accepted: [
      ...BUILDING_KEYS.map((key) => ({ category: "building" as const, key })),
      ...TERRAIN_KEYS.map((key) => ({ category: "terrain" as const, key })),
    ],
  };
  assertPhase13AcceptedVisualFloors(repoRoot, release);
};

export const writePhase13ReleaseEvidence = (
  repoRoot: string,
  release: Phase13AcceptedRelease,
  sourceByKey: ReadonlyMap<WorldAssetKey, AssetSource>,
): void => {
  const accepted = acceptedKeySet(release);
  const statuses = WORLD_ASSET_KEYS.map((key): Phase13ReleaseStatus => {
    const relativePath = releasePathForWorldAsset(key);
    const source = sourceByKey.get(key);
    if (source === undefined) throw new Phase13AcceptedReleaseError(`missing release source for ${key}`);
    return {
      key,
      category: categoryForWorldAssetKey(key),
      status: accepted.has(key) ? "accepted-generated" : "preserved-existing",
      path: relativePath.split(path.sep).join("/"),
      sha256: sha256File(path.join(repoRoot, relativePath)),
      source,
    };
  });
  const evidencePath = path.join(repoRoot, PHASE13_EVIDENCE_PATH);
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify({ version: 1, mode: release.mode, statuses }, null, 2)}\n`);
};

export const assertPhase13ReleaseEvidence = (repoRoot: string, release: Phase13AcceptedRelease): void => {
  const evidencePath = path.join(repoRoot, PHASE13_EVIDENCE_PATH);
  const accepted = acceptedKeySet(release);
  const evidence = readPhase13ReleaseEvidence(evidencePath);
  const manifest = parseWorldAssetManifest(
    JSON.parse(readFileSync(path.join(repoRoot, "public", "assets", "world_asset_manifest.json"), "utf8")),
  );
  const manifestSourceByKey = new Map(manifest.assets.map((asset) => [asset.key, asset.source] as const));
  const statusByKey = new Map<WorldAssetKey, Phase13ReleaseStatus>();
  for (const entry of evidence.statuses) {
    const key = entry.key;
    if (statusByKey.has(key)) throw new Phase13AcceptedReleaseError(`duplicate Phase13 release evidence key ${key}`);
    statusByKey.set(key, entry);
  }
  for (const key of WORLD_ASSET_KEYS) {
    const entry = statusByKey.get(key);
    if (entry === undefined) throw new Phase13AcceptedReleaseError(`missing Phase13 release evidence key ${key}`);
    const expectedStatus = accepted.has(key) ? "accepted-generated" : "preserved-existing";
    const expectedPath = releasePathForWorldAsset(key).split(path.sep).join("/");
    const expectedSource = accepted.has(key) ? phase13SourceForWorldAsset(key) : manifestSourceByKey.get(key);
    if (expectedSource === undefined) throw new Phase13AcceptedReleaseError(`${key} manifest source is missing`);
    if (entry.category !== categoryForWorldAssetKey(key)) {
      throw new Phase13AcceptedReleaseError(`${key} evidence category must be ${categoryForWorldAssetKey(key)}`);
    }
    if (entry["status"] !== expectedStatus) throw new Phase13AcceptedReleaseError(`${key} evidence status must be ${expectedStatus}`);
    if (entry.path !== expectedPath) throw new Phase13AcceptedReleaseError(`${key} evidence path must be ${expectedPath}`);
    if (entry["sha256"] !== sha256File(path.join(repoRoot, releasePathForWorldAsset(key)))) {
      throw new Phase13AcceptedReleaseError(`${key} evidence sha256 does not match release file`);
    }
    if (entry.source.seed !== expectedSource.seed || entry.source.candidate !== expectedSource.candidate) {
      throw new Phase13AcceptedReleaseError(`${key} evidence source does not match release contract`);
    }
  }
};
