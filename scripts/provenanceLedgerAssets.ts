/**
 * Runtime asset enumeration for the AI-generated asset provenance ledger
 * (docs/provenance/ASSET_PROVENANCE.md, work order section 5).
 *
 * "Runtime" means: every file the shipped game can actually load. This module
 * enumerates that set from the same manifests/modules the renderer reads at
 * runtime (src/render/*Manifest*.ts, *.generated.ts, *Assets.ts; CSS url();
 * index.html; public/assets/world_asset_manifest.json), NOT from a raw
 * directory walk of public/. A separate export lists every public/ file that
 * this enumeration did NOT find referenced, so that gap is auditable rather
 * than silently dropped.
 *
 * Where a source file uses a template literal built from a small, closed set
 * of constants (e.g. `assets/runtime-icons-v1/${kind}.png`), the constant set
 * is reproduced here with a comment pointing at the exact source line, so the
 * list stays traceable to the code that actually builds the URL at runtime.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);

function abs(relative: string): string {
  return path.join(REPO_ROOT, relative);
}

function readText(relative: string): string {
  return readFileSync(abs(relative), "utf8");
}

function readJson<T>(relative: string): T {
  return JSON.parse(readText(relative)) as T;
}

/** A single runtime-loadable asset file, before assetId/version derivation. */
export interface RuntimeAssetRef {
  /** Path relative to repo root, always "public/assets/...". */
  readonly runtimePath: string;
  /** Which enumeration rule found this path, for traceability/debugging. */
  readonly foundVia: string;
}

function toPublicPath(urlOrPath: string): string {
  // Normalise the various forms seen in the codebase:
  //   "assets/x.png" | "/assets/x.png" | "public/assets/x.png"
  let p = urlOrPath.trim();
  if (p.startsWith("public/")) return p;
  p = p.replace(/^\/+/, "");
  if (!p.startsWith("assets/")) throw new Error(`Not an asset path: ${urlOrPath}`);
  return `public/${p}`;
}

/** Extracts every `"url": "assets/..."`-style JSON string value from a generated manifest file. */
function extractUrlLiterals(source: string): string[] {
  const found: string[] = [];
  const re = /"url"\s*:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const value = m[1];
    if (value !== undefined) found.push(value);
  }
  return found;
}

interface WorldAssetManifestAsset {
  key: string;
  path: string;
}
interface WorldAssetManifest {
  assets: WorldAssetManifestAsset[];
}

/**
 * Enumerates every runtime-loadable asset the shipped game can request,
 * following the same manifests/modules the renderer reads.
 */
export function enumerateRuntimeAssets(): RuntimeAssetRef[] {
  const refs: RuntimeAssetRef[] = [];
  const seen = new Set<string>();
  function add(urlOrPath: string, foundVia: string): void {
    const p = toPublicPath(urlOrPath);
    if (seen.has(p)) return;
    seen.add(p);
    refs.push({ runtimePath: p, foundVia });
  }

  // 1) public/assets/world_asset_manifest.json — top-level buildings/foliage/terrain sprites.
  const worldManifest = readJson<WorldAssetManifest>("public/assets/world_asset_manifest.json");
  for (const asset of worldManifest.assets) add(asset.path, "public/assets/world_asset_manifest.json");

  // 2) Static "url" literals inside src/render/*Manifest*.ts and *.generated.ts files.
  const manifestFiles = [
    "src/render/historicalFacilityManifest.ts",
    "src/render/historicalHouseAssetManifest.generated.ts",
    "src/render/houseCompoundAssetManifest.generated.ts",
    "src/render/houseConditionArt.generated.ts",
    "src/render/townLandscapeManifest.generated.ts",
    "src/render/runtimeActorManifest.generated.ts",
  ];
  for (const file of manifestFiles) {
    for (const url of extractUrlLiterals(readText(file))) add(url, file);
  }

  // 3) animatedMill.ts — single-quoted static url literals for the mill body/sails.
  add("assets/buildings/runtime-mill-v1/mill_body-v1.png", "src/render/animatedMill.ts");
  add("assets/buildings/runtime-mill-v1/mill_sails-v3.png", "src/render/animatedMill.ts");

  // 4) timberWallAssets.ts — static single-quoted literal for the palisade gate flank.
  add("assets/buildings/historical-gate/palisade_straight_nw_se.png", "src/render/timberWallAssets.ts");

  // 5) farmSoilTexture.ts — static soil texture literal.
  add("assets/buildings/historical-farm/layers/soil_loam-v1.png", "src/render/farmSoilTexture.ts");

  // 6) farmAssets.ts — two template-literal families built from closed constant sets.
  //    farmFiles: src/render/farmAssets.ts:12-17
  for (const file of [
    "wheat_farm_worked-v3.png",
    "wheat_farm_seedling-v3.png",
    "wheat_farm_growing-v3.png",
    "wheat_farm_ripe-v4.png",
  ]) {
    add(`assets/buildings/historical-farm/${file}`, "src/render/farmAssets.ts (farmFiles)");
  }
  //    cropStages: src/render/farmAssets.ts:33-35 -> assets/buildings/historical-farm/layers/crop_${stage}-v1.png
  for (const stage of ["seedling", "growing", "ripe"]) {
    add(`assets/buildings/historical-farm/layers/crop_${stage}-v1.png`, "src/render/farmAssets.ts (cropStages)");
  }

  // 7) stoneWallAssets.ts + stoneWallGeometry.ts STONE_WALL_SOURCES.
  for (const filename of ["stone_wall_straight_nw_se-v3.png", "stone_wall_straight_ne_sw-v3.png"]) {
    add(`assets/buildings/historical-wall/${filename}`, "src/render/stoneWallAssets.ts (STONE_WALL_SOURCES)");
  }

  // 8) gateArtAssets.ts GATE_PARTS x axis.
  const gateParts = ["stone_arch", "timber_frame", "doors_open", "doors_closed"];
  for (const part of gateParts) {
    for (const axisSuffix of ["nw_se", "ne_sw"]) {
      add(`assets/buildings/historical-gate/gate_part_${part}_${axisSuffix}-v1.png`, "src/render/gateArtAssets.ts (GATE_PARTS)");
    }
  }

  // 9) bridgeWaterAssets.ts bridgeWaterManifest (file field per id).
  const bridgeFiles = [
    "bridge_wood_nw_se-v2.png",
    "bridge_wood_ne_sw-v2.png",
    "bridge_stone_nw_se-v2.png",
    "bridge_stone_ne_sw-v2.png",
    "riverbank_mud-v2.png",
    "riverbank_stone-v2.png",
    "ford_gravel-v1.png",
    "ford_stepping_stones-v1.png",
    "water_surface-v1.png",
    "water_shallow-v1.png",
  ];
  for (const file of bridgeFiles) add(`assets/complete-art-v1/water-bridges/${file}`, "src/render/bridgeWaterAssets.ts (bridgeWaterManifest)");

  // 10) constructionArtAssets.ts FILES.
  const constructionFiles = [
    "construction_foundation-v1",
    "construction_timber_frame-v2",
    "construction_roof_frame-v1",
    "construction_scaffold-v2",
    "condition_decals-v3",
    "effect_dust-v1",
    "construction_wall-v2",
    "construction_salvage-v3",
    "effect_smoke-v1",
  ];
  for (const file of constructionFiles) add(`assets/runtime-construction-v1/${file}.png`, "src/render/constructionArtAssets.ts (FILES)");

  // 11) ResourceArtwork.tsx — assets/runtime-icons-v1/${kind}.png for each resource kind.
  const resourceKinds = ["wheat", "bread", "logs", "timber", "stone_raw", "stone", "coin", "population"];
  for (const kind of resourceKinds) add(`assets/runtime-icons-v1/${kind}.png`, "src/ui/ResourceArtwork.tsx (kind)");

  // 12) global.css background-image url().
  add("assets/ui/seal_slot.png", "src/styles/global.css");

  return refs.sort((a, b) => a.runtimePath.localeCompare(b.runtimePath));
}

/** Every file under public/ that no runtime enumeration rule above found referenced. */
export function listUnreferencedPublicFiles(allPublicFiles: readonly string[]): string[] {
  const referenced = new Set(enumerateRuntimeAssets().map(r => r.runtimePath));
  return allPublicFiles.filter(f => !referenced.has(f)).sort();
}
