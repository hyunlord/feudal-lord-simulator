import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { readPng, writePng, type RgbaImage } from "./processBuildingSprite";
import {
  BUILDING_SPECS,
  FOLIAGE_SPECS,
  WORLD_ASSET_KEYS,
  type FoliageAsset,
  type WorldAsset,
  type WorldAssetManifest,
} from "./worldAssetContracts";
import { parseWorldAssetManifest } from "./worldAssetManifest";
import { verifyWorldAssets } from "./verifyWorldAssets";
import { processWorldSprite } from "./worldSpritePipeline";

export const PHASE4E_GROUND_COVER_KEYS = ["shrub_a", "shrub_b", "grass_tuft", "field_stone"] as const;
export type Phase4eGroundCoverKey = (typeof PHASE4E_GROUND_COVER_KEYS)[number];
export type Phase4eTargetKey = Phase4eGroundCoverKey | "sawmill";
export type Phase4eSelections = Readonly<Record<Phase4eTargetKey, number>>;
type Phase4eTargetAsset = Omit<WorldAsset, "sha256">;

export type PreparePhase4eAssetOptions = {
  readonly repoRoot: string;
  readonly rawRoot: string;
  readonly phase4bRoot: string;
  readonly selections: Phase4eSelections;
};

export class Phase4eAssetPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Phase4eAssetPreparationError";
  }
}

const TARGET_PATHS = new Set([
  "public/assets/buildings/sawmill.png",
  ...PHASE4E_GROUND_COVER_KEYS.map((key) => `public/assets/foliage/${key}.png`),
]);

const sha256 = (filePath: string): string => createHash("sha256").update(readFileSync(filePath)).digest("hex");

const RGBA = {
  ink: [42, 33, 24, 255],
  blade: [162, 173, 185, 255],
  plank: [149, 121, 90, 255],
  plankLight: [178, 149, 120, 255],
  sawdust: [180, 149, 115, 255],
} as const;

export const addPhase4eSawmillCues = (candidate: RgbaImage): RgbaImage => {
  if (candidate.dimensions.width !== 112 || candidate.dimensions.height !== 112) {
    throw new Phase4eAssetPreparationError("processed sawmill must be 112x112");
  }
  const rgba = new Uint8Array(candidate.rgba);
  const setPixel = (x: number, y: number, color: readonly [number, number, number, number]): void => {
    const offset = (y * candidate.dimensions.width + x) * 4;
    rgba.set(color, offset);
  };
  const plank = (x: number, y: number, width: number, color: readonly [number, number, number, number]): void => {
    for (let py = y; py < y + 4; py += 1) {
      for (let px = x; px < x + width; px += 1) {
        const border = py === y || py === y + 3 || px === x || px === x + width - 1;
        setPixel(px, py, border ? RGBA.ink : color);
      }
    }
  };

  for (let y = 18; y <= 78; y += 1) {
    setPixel(55, y, RGBA.blade);
    setPixel(56, y, RGBA.blade);
  }
  for (let y = 52; y <= 76; y += 4) setPixel(57, y, RGBA.ink);
  plank(74, 78, 24, RGBA.plank);
  plank(77, 83, 21, RGBA.plankLight);
  plank(72, 88, 24, RGBA.plank);
  for (let y = 93; y <= 95; y += 1) {
    for (let x = 60; x <= 78; x += 1) {
      if ((x + y) % 3 !== 0) setPixel(x, y, RGBA.sawdust);
    }
  }
  return { dimensions: candidate.dimensions, rgba };
};

export const snapshotUntouchedAssetHashes = (repoRoot: string): ReadonlyMap<string, string> => {
  const hashes = new Map<string, string>();
  for (const category of ["buildings", "foliage", "terrain"] as const) {
    const directory = path.join(repoRoot, "public", "assets", category);
    for (const name of readdirSync(directory).filter((entry) => entry.endsWith(".png")).sort()) {
      const relative = `public/assets/${category}/${name}`;
      if (!TARGET_PATHS.has(relative)) hashes.set(relative, sha256(path.join(repoRoot, relative)));
    }
  }
  return hashes;
};

export const assertUntouchedAssetHashes = (repoRoot: string, expected: ReadonlyMap<string, string>): void => {
  const actual = snapshotUntouchedAssetHashes(repoRoot);
  if (actual.size !== expected.size) throw new Phase4eAssetPreparationError("non-target asset membership changed");
  for (const [relative, digest] of expected) {
    if (actual.get(relative) !== digest) throw new Phase4eAssetPreparationError(`non-target asset changed: ${relative}`);
  }
};

export const sourceForPhase4eTarget = (
  key: Phase4eTargetKey,
  candidate: number,
): { readonly seed: number; readonly candidate: number } => {
  if (!Number.isInteger(candidate) || candidate < 1 || candidate > (key === "sawmill" ? 6 : 4)) {
    throw new Phase4eAssetPreparationError(`${key} selection is outside its candidate range`);
  }
  const subject = key === "sawmill" ? 8 : PHASE4E_GROUND_COVER_KEYS.indexOf(key) + 5;
  const base = key === "sawmill" ? 64050000 : 64052000;
  return { seed: base + subject * 100 + candidate, candidate };
};

const groundCoverAsset = (key: Phase4eGroundCoverKey, candidate: number): Omit<FoliageAsset, "sha256"> => {
  const spec = FOLIAGE_SPECS[key];
  return {
    key,
    category: "foliage",
    path: `public/assets/foliage/${key}.png`,
    width: spec.width,
    height: spec.height,
    anchor: { x: spec.width / 2, y: spec.baselineY },
    footprint: spec.footprint,
    source: sourceForPhase4eTarget(key, candidate),
    palettePolicy: key === "field_stone" ? "stone-earth" : "foliage-timber",
    alphaPolicy: "transparent-outline-179",
    variation: { selection: "hash", scale: { min: 0.7, max: 1.3 }, offset: "in-tile", sway: "sine" },
  };
};

const targetAssets = (selections: Phase4eSelections): ReadonlyMap<Phase4eTargetKey, Phase4eTargetAsset> => {
  const sawmill = BUILDING_SPECS.sawmill;
  return new Map<Phase4eTargetKey, Phase4eTargetAsset>([
    ["sawmill", {
      key: "sawmill",
      category: "building",
      path: "public/assets/buildings/sawmill.png",
      width: sawmill.width,
      height: sawmill.height,
      anchor: { x: sawmill.width / 2, y: sawmill.baselineY },
      footprint: sawmill.footprint,
      source: sourceForPhase4eTarget("sawmill", selections.sawmill),
      palettePolicy: "canonical-building",
      alphaPolicy: "transparent-outline-179",
    }],
    ...PHASE4E_GROUND_COVER_KEYS.map((key) => [key, groundCoverAsset(key, selections[key])] as const),
  ]);
};

export const preparePhase4eAssets = (options: PreparePhase4eAssetOptions): WorldAssetManifest => {
  const untouched = snapshotUntouchedAssetHashes(options.repoRoot);
  const targets = targetAssets(options.selections);
  const manifestPath = path.join(options.repoRoot, "public", "assets", "world_asset_manifest.json");
  const current = JSON.parse(readFileSync(manifestPath, "utf8")) as { readonly assets?: readonly WorldAsset[] };
  const existing = new Map((current.assets ?? []).map((asset) => [asset.key, asset]));

  for (const [key, asset] of targets) {
    const category = key === "sawmill" ? "building" : "foliage";
    const raw = path.join(options.rawRoot, category, `${key}_${String(options.selections[key]).padStart(2, "0")}.png`);
    const destination = path.join(options.repoRoot, asset.path);
    mkdirSync(path.dirname(destination), { recursive: true });
    const processed = processWorldSprite(readPng(raw), key);
    writePng(destination, key === "sawmill" ? addPhase4eSawmillCues(processed) : processed);
    existing.set(key, { ...asset, sha256: sha256(destination) } as WorldAsset);
  }

  const document = {
    version: 1,
    assets: WORLD_ASSET_KEYS.map((key) => existing.get(key)),
  };
  const manifest = parseWorldAssetManifest(document);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assertUntouchedAssetHashes(options.repoRoot, untouched);
  return verifyWorldAssets(options.repoRoot, options.phase4bRoot);
};

const parseSelections = (filePath: string): Phase4eSelections => {
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Readonly<Record<string, unknown>>;
  const keys = ["sawmill", ...PHASE4E_GROUND_COVER_KEYS] as const;
  if (Object.keys(parsed).sort().join(",") !== [...keys].sort().join(",")) {
    throw new Phase4eAssetPreparationError(`selections must contain exactly ${keys.join(",")}`);
  }
  return Object.fromEntries(keys.map((key) => {
    const candidate = parsed[key];
    if (typeof candidate !== "number") throw new Phase4eAssetPreparationError(`${key} selection must be a number`);
    sourceForPhase4eTarget(key, candidate);
    return [key, candidate];
  })) as Phase4eSelections;
};

const main = (): number => {
  try {
    const [, , repoRoot, rawRoot, phase4bRoot, selectionsPath] = process.argv;
    if (repoRoot === undefined || rawRoot === undefined || phase4bRoot === undefined || selectionsPath === undefined) {
      throw new Phase4eAssetPreparationError(
        "Usage: tsx scripts/preparePhase4eAssets.ts <repo-root> <raw-root> <phase4b-root> <selections.json>",
      );
    }
    preparePhase4eAssets({ repoRoot, rawRoot, phase4bRoot, selections: parseSelections(selectionsPath) });
    writeFileSync(1, "Phase 4E target-only asset preparation passed\n");
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
