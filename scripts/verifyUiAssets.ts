import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CANONICAL_PALETTE } from "../src/content/palette";
import { decodePngToRgba } from "./quantisePalette";
import {
  alphaPresent,
  assertAlphaContract,
  assertExactManifestKeys,
  assertManifestContract,
  assertReportAlignment,
  assertScrollFrameFinalArt,
  assertScrollFrameTransparency,
  assertWoodConsoleFinalArt,
  parseManifest,
  type AssetContract,
  type AssetManifest,
} from "./uiAssetManifest";

type AssetReport = {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly alphaPresent: boolean;
  readonly opaquePaletteRgbCount: number;
  readonly alphaUnchanged: boolean;
  readonly candidateCount: number;
  readonly selectedIndex: number;
};

const hexToRgbKey = (hex: string): string => {
  const parsed = Number.parseInt(hex.slice(1), 16);
  return `${(parsed >> 16) & 255},${(parsed >> 8) & 255},${parsed & 255}`;
};

const paletteRgb = new Set(CANONICAL_PALETTE.map(hexToRgbKey));
const PHASE4F_REGENERATED_KEYS = new Set(["scroll_frame", "wood_console"]);

const readManifest = (manifestPath: string): AssetManifest => {
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  return parseManifest(parsed);
};

const assertDimensions = (key: string, label: string, actualWidth: number, actualHeight: number, width: number, height: number): void => {
  if (actualWidth !== width || actualHeight !== height) {
    throw new Error(`${key} ${label} dimensions were ${actualWidth}x${actualHeight}, expected ${width}x${height}`);
  }
};

const analyseAsset = (asset: AssetContract, candidateRoot: string, reportText: string): AssetReport => {
  const candidateDir = path.join(candidateRoot, asset.key);
  const activeCandidateNames = readdirSync(candidateDir).filter((name) => name.startsWith("candidate_") && name.endsWith(".png"));
  assertManifestContract({ assets: [asset] }, asset.key, activeCandidateNames);
  assertReportAlignment(asset, reportText);

  for (const candidate of asset.candidates) {
    const decoded = decodePngToRgba(path.join(candidateRoot, candidate.path));
    assertDimensions(asset.key, `candidate ${candidate.index}`, decoded.dimensions.width, decoded.dimensions.height, candidate.width, candidate.height);
  }

  const before = decodePngToRgba(asset.beforePath);
  const after = decodePngToRgba(asset.finalPath);
  assertDimensions(asset.key, "before", before.dimensions.width, before.dimensions.height, asset.width, asset.height);
  assertDimensions(asset.key, "final", after.dimensions.width, after.dimensions.height, asset.width, asset.height);
  assertAlphaContract(asset.key, asset.alpha, before.rgba, after.rgba);
  if (asset.key === "scroll_frame") {
    assertScrollFrameTransparency(
      after.rgba,
      after.dimensions.width,
      after.dimensions.height,
    );
    assertScrollFrameFinalArt(
      after.rgba,
      after.dimensions.width,
      after.dimensions.height,
    );
  }
  if (asset.key === "wood_console") {
    assertWoodConsoleFinalArt(
      after.rgba,
      after.dimensions.width,
      after.dimensions.height,
    );
  }

  let opaquePaletteRgbCount = 0;
  for (let index = 0; index < after.rgba.length; index += 4) {
    const alpha = after.rgba[index + 3];
    if (alpha === undefined) {
      throw new Error(`${asset.finalPath} ended with an incomplete alpha byte`);
    }
    if (alpha > 0) {
      const r = after.rgba[index];
      const g = after.rgba[index + 1];
      const b = after.rgba[index + 2];
      if (r === undefined || g === undefined || b === undefined) {
        throw new Error(`${asset.finalPath} ended with an incomplete RGB pixel`);
      }
      const rgbKey = `${r},${g},${b}`;
      if (PHASE4F_REGENERATED_KEYS.has(asset.key) && !paletteRgb.has(rgbKey)) {
        throw new Error(`${asset.finalPath} has non-palette RGB ${rgbKey} at byte ${index}`);
      }
      opaquePaletteRgbCount += 1;
    }
  }

  return {
    key: asset.key,
    width: asset.width,
    height: asset.height,
    alphaPresent: alphaPresent(after.rgba),
    opaquePaletteRgbCount,
    alphaUnchanged: true,
    candidateCount: asset.candidates.length,
    selectedIndex: asset.selectedIndex,
  };
};

export const analyse = (
  candidateRoot: string,
  manifestPath = path.join("docs", "asset-evidence", "uiAssetManifest.json"),
  reportPath = path.join("docs", "ASSET_REPORT.md"),
): readonly AssetReport[] => {
  const manifest = readManifest(manifestPath);
  assertExactManifestKeys(manifest);
  const reportText = readFileSync(reportPath, "utf8");
  return manifest.assets.map((asset) => analyseAsset(asset, candidateRoot, reportText));
};

const main = (): number => {
  const candidateRoot = process.argv[2];
  const manifestPath = process.argv[3] ?? path.join("docs", "asset-evidence", "uiAssetManifest.json");
  try {
    if (candidateRoot === undefined) {
      throw new Error("candidate root argument is required");
    }
    writeFileSync(1, `${JSON.stringify(analyse(candidateRoot, manifestPath), null, 2)}\n`);
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
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = main();
}
