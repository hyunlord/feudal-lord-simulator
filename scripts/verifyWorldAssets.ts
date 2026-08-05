import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CANONICAL_PALETTE, RAMPS } from "../src/content/palette";
import {
  assertMillHeight,
  assertVisibleWidthBand,
  readPng,
  type BuildingSubject,
  type RgbaImage,
} from "./processBuildingSprite";
import {
  TERRAIN_KEYS,
  TERRAIN_POLICIES,
  assertTerrainSeams,
  measureTerrainSeams,
  type TerrainKey,
} from "./terrainTexturePipeline";
import {
  BUILDING_KEYS,
  BUILDING_SPECS,
  FOLIAGE_KEYS,
  TERRAIN_SPECS,
  type WorldAssetManifest,
} from "./worldAssetContracts";
import { assertWorldAssetFiles, parseWorldAssetManifest } from "./worldAssetManifest";
import {
  BUILDING_SPRITE_CONTRACTS,
  FOLIAGE_SPRITE_CONTRACTS,
  assertHouseHeightProgression,
  assertSpriteContract,
} from "./worldSpritePipeline";

export class WorldAssetVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldAssetVerificationError";
  }
}

const rgbKey = (hex: string): string => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`;
};

const canonicalColours = new Set(CANONICAL_PALETTE.map(rgbKey));
const NEW_BUILDING_KEYS = [
  "house_l1", "house_l2", "house_l3", "well", "storehouse", "wheat_farm", "logging_camp", "sawmill",
] as const satisfies readonly (keyof typeof BUILDING_SPRITE_CONTRACTS)[];
const RELEASE_FOLIAGE_KEYS = [
  "tree_conifer_a", "tree_conifer_b", "tree_broadleaf_a", "tree_broadleaf_b", "shrub_a", "shrub_b",
] as const satisfies readonly (keyof typeof FOLIAGE_SPRITE_CONTRACTS)[];

const assertExactPngSet = (directory: string, expectedKeys: readonly string[]): void => {
  const expected = expectedKeys.map((key) => `${key}.png`).sort();
  const actual = readdirSync(directory).filter((name) => name.toLowerCase().endsWith(".png")).sort();
  const unexpected = actual.filter((name) => !expected.includes(name));
  if (unexpected.length > 0) {
    throw new WorldAssetVerificationError(`unexpected PNG in ${directory}: ${unexpected.join(",")}`);
  }
  const missing = expected.filter((name) => !actual.includes(name));
  if (missing.length > 0) throw new WorldAssetVerificationError(`missing PNG in ${directory}: ${missing.join(",")}`);
};

const assertPromotedContract = (image: RgbaImage, key: "house_l0" | "mill" | "barn"): void => {
  const spec = BUILDING_SPECS[key];
  const subject: BuildingSubject = key === "house_l0" ? "house" : key === "barn" ? "granary" : "mill";
  assertVisibleWidthBand(image, subject);
  if (subject === "mill") assertMillHeight(image);
  for (let index = 0; index < image.rgba.length; index += 4) {
    const alpha = image.rgba[index + 3];
    if (alpha !== 0 && alpha !== 179 && alpha !== 255) {
      throw new WorldAssetVerificationError(`${key} has unsupported alpha ${String(alpha)}`);
    }
    if (alpha !== 0) {
      const colour = `${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]}`;
      if (!canonicalColours.has(colour)) throw new WorldAssetVerificationError(`${key} has non-canonical colour ${colour}`);
    }
  }
  for (let y = spec.baselineY + 1; y < spec.height; y += 1) {
    for (let x = 0; x < spec.width; x += 1) {
      if (image.rgba[(y * spec.width + x) * 4 + 3] !== 0) {
        throw new WorldAssetVerificationError(`${key} has an opaque pixel below baseline ${spec.baselineY}`);
      }
    }
  }
};

const assertStablePromotions = (repoRoot: string, phase4bRoot: string): void => {
  const pairs = [
    ["house_l0.png", "house_03.png"],
    ["mill.png", "mill_02.png"],
    ["barn.png", "granary_08.png"],
  ] as const;
  for (const [releaseName, sourceName] of pairs) {
    const release = readFileSync(path.join(repoRoot, "public", "assets", "buildings", releaseName));
    const source = readFileSync(path.join(phase4bRoot, sourceName));
    if (!release.equals(source)) {
      throw new WorldAssetVerificationError(`${releaseName} is not byte-identical to ${sourceName}`);
    }
  }
};

const assertSpriteCategories = (repoRoot: string): void => {
  const buildings = path.join(repoRoot, "public", "assets", "buildings");
  for (const key of NEW_BUILDING_KEYS) {
    assertSpriteContract(readPng(path.join(buildings, `${key}.png`)), key);
  }
  const foliage = path.join(repoRoot, "public", "assets", "foliage");
  for (const key of RELEASE_FOLIAGE_KEYS) {
    assertSpriteContract(readPng(path.join(foliage, `${key}.png`)), key);
  }
  const promoted = {
    house_l0: readPng(path.join(buildings, "house_l0.png")),
    mill: readPng(path.join(buildings, "mill.png")),
    barn: readPng(path.join(buildings, "barn.png")),
  };
  assertPromotedContract(promoted.house_l0, "house_l0");
  assertPromotedContract(promoted.mill, "mill");
  assertPromotedContract(promoted.barn, "barn");
  assertHouseHeightProgression({
    house_l0: promoted.house_l0,
    house_l1: readPng(path.join(buildings, "house_l1.png")),
    house_l2: readPng(path.join(buildings, "house_l2.png")),
    house_l3: readPng(path.join(buildings, "house_l3.png")),
  });
};

const allowedTerrainColours = (key: TerrainKey): ReadonlySet<string> =>
  new Set(TERRAIN_POLICIES[key].ramps.flatMap((ramp) => RAMPS[ramp]).map(rgbKey));

const assertTerrainCategories = (repoRoot: string): void => {
  for (const key of TERRAIN_KEYS) {
    const image = readPng(path.join(repoRoot, "public", "assets", "terrain", `${key}.png`));
    const allowed = allowedTerrainColours(key);
    for (let index = 0; index < image.rgba.length; index += 4) {
      if (image.rgba[index + 3] !== 255) throw new WorldAssetVerificationError(`${key} terrain must be opaque`);
      const colour = `${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]}`;
      if (!allowed.has(colour) && !canonicalColours.has(colour)) {
        throw new WorldAssetVerificationError(`${key} terrain violates its palette policy`);
      }
    }
    assertTerrainSeams(measureTerrainSeams(image));
  }
};

export const verifyWorldAssets = (repoRoot: string, phase4bRoot: string): WorldAssetManifest => {
  const manifestPath = path.join(repoRoot, "public", "assets", "world_asset_manifest.json");
  const manifest = parseWorldAssetManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  assertWorldAssetFiles(manifest, repoRoot);
  assertExactPngSet(path.join(repoRoot, "public", "assets", "buildings"), BUILDING_KEYS);
  assertExactPngSet(path.join(repoRoot, "public", "assets", "foliage"), FOLIAGE_KEYS);
  assertExactPngSet(path.join(repoRoot, "public", "assets", "terrain"), Object.keys(TERRAIN_SPECS));
  assertSpriteCategories(repoRoot);
  assertTerrainCategories(repoRoot);
  assertStablePromotions(repoRoot, phase4bRoot);
  return manifest;
};

const main = (): number => { // no-excuse-ok: catch
  try {
    const repoRoot = process.argv[2];
    const phase4bRoot = process.argv[3];
    if (repoRoot === undefined || phase4bRoot === undefined) {
      throw new WorldAssetVerificationError("Usage: tsx scripts/verifyWorldAssets.ts <repo-root> <phase4b-root>");
    }
    verifyWorldAssets(repoRoot, phase4bRoot);
    writeFileSync(1, "World asset release verification passed\n");
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
