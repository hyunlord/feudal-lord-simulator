import path from "node:path";

export { assertReportAlignment } from "./uiAssetReportRow";

const EXPECTED_KEYS = [
  "scroll_frame",
  "wood_console",
  "seal_slot",
  "parchment_texture",
  "illumination_corner",
] as const;

export type AlphaContract = "transparent" | "opaque";

export type CandidateContract = {
  readonly index: number;
  readonly seed: number;
  readonly path: string;
  readonly width: number;
  readonly height: number;
};

export type AssetContract = {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly alpha: AlphaContract;
  readonly beforePath: string;
  readonly finalPath: string;
  readonly selectedIndex: number;
  readonly candidates: readonly CandidateContract[];
};

export type AssetManifest = {
  readonly assets: readonly AssetContract[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`manifest ${key} must be a nonempty string`);
  }
  return value;
};

const requireNumber = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`manifest ${key} must be a positive integer`);
  }
  return value;
};

const parseAlpha = (value: string): AlphaContract => {
  if (value === "transparent" || value === "opaque") {
    return value;
  }
  throw new Error(`manifest alpha must be transparent or opaque, got ${value}`);
};

const parseCandidate = (value: unknown): CandidateContract => {
  if (!isRecord(value)) {
    throw new Error("manifest candidate must be an object");
  }
  return {
    index: requireNumber(value, "index"),
    seed: requireNumber(value, "seed"),
    path: requireString(value, "path"),
    width: requireNumber(value, "width"),
    height: requireNumber(value, "height"),
  };
};

const parseAsset = (value: unknown): AssetContract => {
  if (!isRecord(value)) {
    throw new Error("manifest asset must be an object");
  }
  const candidatesValue = value["candidates"];
  if (!Array.isArray(candidatesValue) || candidatesValue.length === 0) {
    throw new Error("manifest candidates must be a nonempty array");
  }
  return {
    key: requireString(value, "key"),
    width: requireNumber(value, "width"),
    height: requireNumber(value, "height"),
    alpha: parseAlpha(requireString(value, "alpha")),
    beforePath: requireString(value, "beforePath"),
    finalPath: requireString(value, "finalPath"),
    selectedIndex: requireNumber(value, "selectedIndex"),
    candidates: candidatesValue.map(parseCandidate),
  };
};

export const parseManifest = (value: unknown): AssetManifest => {
  if (!isRecord(value)) {
    throw new Error("manifest must be an object");
  }
  const assetsValue = value["assets"];
  if (!Array.isArray(assetsValue)) {
    throw new Error("manifest assets must be an array");
  }
  return { assets: assetsValue.map(parseAsset) };
};

export const alphaPresent = (rgba: Uint8Array): boolean => {
  for (let index = 3; index < rgba.length; index += 4) {
    if (rgba[index] !== 255) {
      return true;
    }
  }
  return false;
};

export const assertAlphaContract = (
  key: string,
  alpha: AlphaContract,
  before: Uint8Array,
  after: Uint8Array,
): void => {
  if (before.length !== after.length) {
    throw new Error(`${key} alpha byte comparison needs equal buffer lengths`);
  }
  for (let index = 3; index < before.length; index += 4) {
    if (before[index] !== after[index]) {
      throw new Error(`${key} alpha byte changed at byte ${index}`);
    }
  }
  const hasTransparency = alphaPresent(after);
  if (alpha === "transparent" && !hasTransparency) {
    throw new Error(`${key} expected transparency but final image is fully opaque`);
  }
  if (alpha === "opaque" && hasTransparency) {
    throw new Error(`${key} expected opaque alpha but final image has transparency`);
  }
};

const assetByKey = (manifest: AssetManifest, key: string): AssetContract => {
  const asset = manifest.assets.find((candidate) => candidate.key === key);
  if (asset === undefined) {
    throw new Error(`${key} manifest entry is missing`);
  }
  return asset;
};

const candidateBasenames = (asset: AssetContract): readonly string[] =>
  asset.candidates.map((candidate) => path.basename(candidate.path)).sort();

export const assertManifestContract = (
  manifest: AssetManifest,
  key: string,
  activeCandidateNames: readonly string[],
): AssetContract => {
  const asset = assetByKey(manifest, key);
  const selected = asset.candidates.find((candidate) => candidate.index === asset.selectedIndex);
  if (selected === undefined) {
    throw new Error(`${key} selected candidate ${asset.selectedIndex} is missing from manifest`);
  }
  const indexes = new Set<number>();
  for (const candidate of asset.candidates) {
    if (indexes.has(candidate.index)) {
      throw new Error(`${key} duplicate candidate index ${candidate.index}`);
    }
    indexes.add(candidate.index);
    if (path.isAbsolute(candidate.path) || path.win32.isAbsolute(candidate.path)) {
      throw new Error(`${key} candidate path must be relative to the supplied candidate root`);
    }
    const actualBasename = path.basename(candidate.path);
    const expectedBasename = `candidate_${candidate.index}_seed_${candidate.seed}.png`;
    if (actualBasename !== expectedBasename) {
      throw new Error(`${key} candidate ${candidate.index} basename ${actualBasename} did not match ${expectedBasename}`);
    }
    if (candidate.path !== path.join(key, actualBasename)) {
      throw new Error(`${key} candidate ${candidate.index} path is not under its asset directory`);
    }
  }
  const expected = candidateBasenames(asset);
  const active = [...activeCandidateNames].sort();
  if (active.length > 0 && JSON.stringify(active) !== JSON.stringify(expected)) {
    throw new Error(`${key} active candidates ${active.join(",")} did not match manifest ${expected.join(",")}`);
  }
  return asset;
};

export const assertExactManifestKeys = (manifest: AssetManifest): void => {
  const actual = manifest.assets.map((asset) => asset.key).sort();
  const expected = [...EXPECTED_KEYS].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`manifest asset keys ${actual.join(",")} did not match ${expected.join(",")}`);
  }
};
