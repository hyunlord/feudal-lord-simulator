import path from "node:path";

import { PALETTE, RAMPS } from "../src/content/palette";

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

const requireReleasePngPath = (
  record: Record<string, unknown>,
  key: "beforePath" | "finalPath",
  directory: string,
): string => {
  const value = requireString(record, key);
  const normalised = path.posix.normalize(value);
  const isPortableRelativePath =
    !path.isAbsolute(value)
    && !path.win32.isAbsolute(value)
    && !value.includes("\\")
    && normalised.startsWith(`${directory}/`)
    && path.posix.extname(normalised).toLowerCase() === ".png";
  if (!isPortableRelativePath) {
    throw new Error(`manifest ${key} must stay under ${directory} as a repo-relative PNG`);
  }
  return normalised;
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
    beforePath: requireReleasePngPath(value, "beforePath", "docs/asset-evidence/before"),
    finalPath: requireReleasePngPath(value, "finalPath", "public/assets/ui"),
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

const requireRgbaDimensions = (
  rgba: Uint8Array,
  width: number,
  height: number,
): void => {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    rgba.length !== width * height * 4
  ) {
    throw new Error(
      `RGBA dimensions ${width}x${height} did not match ${rgba.length} bytes`,
    );
  }
};

export const assertScrollFrameTransparency = (
  rgba: Uint8Array,
  width: number,
  height: number,
): void => {
  requireRgbaDimensions(rgba, width, height);

  const interior = {
    left: Math.floor(width * 0.25),
    top: Math.floor(height * 0.25),
    right: Math.ceil(width * 0.75),
    bottom: Math.ceil(height * 0.75),
  };
  let interiorPixels = 0;
  let transparentInteriorPixels = 0;
  for (let y = interior.top; y < interior.bottom; y += 1) {
    for (let x = interior.left; x < interior.right; x += 1) {
      interiorPixels += 1;
      if (rgba[(y * width + x) * 4 + 3] === 0) {
        transparentInteriorPixels += 1;
      }
    }
  }
  const interiorTransparency = transparentInteriorPixels / interiorPixels;
  if (interiorTransparency < 0.7) {
    throw new Error(
      `scroll_frame interior transparency was ${(
        interiorTransparency * 100
      ).toFixed(1)}%, expected at least 70%`,
    );
  }

  const exteriorBandX = Math.max(1, Math.ceil(width * 0.04));
  const exteriorBandY = Math.max(1, Math.ceil(height * 0.04));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isExteriorBand =
        x < exteriorBandX ||
        x >= width - exteriorBandX ||
        y < exteriorBandY ||
        y >= height - exteriorBandY;
      if (isExteriorBand && rgba[(y * width + x) * 4 + 3] !== 0) {
        throw new Error(
          `scroll_frame outside perimeter contains a non-transparent pixel at ${x},${y}`,
        );
      }
    }
  }
};

const hexToRgbKey = (hex: string): string => {
  const parsed = Number.parseInt(hex.slice(1), 16);
  return `${(parsed >> 16) & 255},${(parsed >> 8) & 255},${parsed & 255}`;
};

const rgbKeyAt = (rgba: Uint8Array, width: number, x: number, y: number): string => {
  const index = (y * width + x) * 4;
  const r = rgba[index];
  const g = rgba[index + 1];
  const b = rgba[index + 2];
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error(`RGBA pixel ${x},${y} was incomplete`);
  }
  return `${r},${g},${b}`;
};

const alphaAt = (rgba: Uint8Array, width: number, x: number, y: number): number => {
  const alpha = rgba[(y * width + x) * 4 + 3];
  if (alpha === undefined) {
    throw new Error(`RGBA pixel ${x},${y} was incomplete`);
  }
  return alpha;
};

const luminanceFromKey = (rgbKey: string): number => {
  const [r, g, b] = rgbKey.split(",").map(Number);
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error(`RGB key ${rgbKey} was incomplete`);
  }
  return r * 0.299 + g * 0.587 + b * 0.114;
};

const average = (values: readonly number[]): number => {
  if (values.length === 0) {
    throw new Error("cannot average an empty luminance set");
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const scrollAccentKeys = new Set([
  hexToRgbKey(PALETTE.gold),
  hexToRgbKey(PALETTE.ultramarine),
  hexToRgbKey(PALETTE.vermilion),
]);

export const assertScrollFrameFinalArt = (
  rgba: Uint8Array,
  width: number,
  height: number,
): void => {
  assertScrollFrameTransparency(rgba, width, height);

  const opaqueRgbKeys = new Set<string>();
  const presentAccents = new Set<string>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(rgba, width, x, y) > 0) {
        const rgbKey = rgbKeyAt(rgba, width, x, y);
        opaqueRgbKeys.add(rgbKey);
        if (scrollAccentKeys.has(rgbKey)) {
          presentAccents.add(rgbKey);
        }
      }
    }
  }
  if (presentAccents.size !== scrollAccentKeys.size) {
    throw new Error("scroll_frame opaque pixels must include gold, ultramarine, and vermilion accent families");
  }
  if (opaqueRgbKeys.size < 5) {
    throw new Error(`scroll_frame opaque palette diversity was ${opaqueRgbKeys.size}, expected at least 5 colours`);
  }
};

const darkWoodKeys = new Set([
  hexToRgbKey(PALETTE.ink),
  hexToRgbKey(RAMPS.timber[0]),
]);

const countDarkRecessRuns = (rgba: Uint8Array, width: number, y: number): number => {
  const minRunWidth = Math.max(3, Math.floor(width * 0.1));
  let runs = 0;
  let runStart: number | undefined;
  for (let x = 0; x < width; x += 1) {
    const isDark = darkWoodKeys.has(rgbKeyAt(rgba, width, x, y)) && alphaAt(rgba, width, x, y) === 255;
    if (isDark && runStart === undefined) {
      runStart = x;
    }
    if ((!isDark || x === width - 1) && runStart !== undefined) {
      const runEnd = isDark && x === width - 1 ? x + 1 : x;
      if (runEnd - runStart >= minRunWidth) {
        runs += 1;
      }
      runStart = undefined;
    }
  }
  return runs;
};

export const assertWoodConsoleFinalArt = (
  rgba: Uint8Array,
  width: number,
  height: number,
): void => {
  requireRgbaDimensions(rgba, width, height);

  const scanY = Math.floor(height * 0.5);
  const darkRuns = countDarkRecessRuns(rgba, width, scanY);
  if (darkRuns !== 3) {
    throw new Error(`wood_console expected three dark recess runs, found ${darkRuns}`);
  }

  const nonRecessRgbKeys = new Set<string>();
  const nonRecessLuminance: number[] = [];
  const topLuminance: number[] = [];
  const topLimit = Math.max(1, Math.floor(height * 0.18));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(rgba, width, x, y) !== 255) {
        throw new Error("wood_console expected fully opaque alpha");
      }
      const rgbKey = rgbKeyAt(rgba, width, x, y);
      if (!darkWoodKeys.has(rgbKey)) {
        nonRecessRgbKeys.add(rgbKey);
        const luminance = luminanceFromKey(rgbKey);
        nonRecessLuminance.push(luminance);
        if (y > 0 && y <= topLimit) {
          topLuminance.push(luminance);
        }
      }
    }
  }
  if (nonRecessRgbKeys.size < 4) {
    throw new Error(`wood_console grain variation used ${nonRecessRgbKeys.size} non-recess colours, expected at least 4`);
  }
  const bodyLuminance = average(nonRecessLuminance);
  const raisedEdgeLuminance = average(topLuminance);
  if (raisedEdgeLuminance <= bodyLuminance + 8) {
    throw new Error("wood_console raised upper-edge highlight is not visibly brighter than the body");
  }
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
