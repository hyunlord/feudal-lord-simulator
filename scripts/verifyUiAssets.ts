import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { readPng } from "./processBuildingSprite";
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
  readonly opaqueVisiblePixelCount: number;
  readonly alphaUnchanged: boolean;
  readonly candidateCount: number;
  readonly selectedIndex: number;
};

const readManifest = (manifestPath: string): AssetManifest => {
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  return parseManifest(parsed);
};

const sha256File = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const assertDimensions = (key: string, label: string, actualWidth: number, actualHeight: number, width: number, height: number): void => {
  if (actualWidth !== width || actualHeight !== height) {
    throw new Error(`${key} ${label} dimensions were ${actualWidth}x${actualHeight}, expected ${width}x${height}`);
  }
};

const assertHash = (key: string, label: string, filePath: string, expected: string | undefined): void => {
  if (expected === undefined) return;
  const actual = sha256File(filePath);
  if (actual !== expected) {
    throw new Error(`${key} ${label} sha256 ${actual} did not match ${expected}`);
  }
};

const assertPhase13Hashes = (asset: AssetContract, candidateRoot: string): void => {
  assertHash(asset.key, "before", asset.beforePath, asset.beforeSha256);
  assertHash(asset.key, "final", asset.finalPath, asset.finalSha256);
  const selected = asset.candidates.find((candidate) => candidate.index === asset.selectedIndex);
  if (selected !== undefined) {
    assertHash(asset.key, `candidate ${selected.index}`, path.join(candidateRoot, selected.path), selected.sha256);
    if (asset.selectedCandidateSha256 !== undefined && selected.sha256 !== asset.selectedCandidateSha256) {
      throw new Error(`${asset.key} selected candidate sha256 did not match manifest candidate`);
    }
  }
  if (asset.phase13Status === "accepted-generated") {
    if (asset.preparedPath === undefined || asset.preparedSha256 === undefined || asset.finalSha256 === undefined) {
      throw new Error(`${asset.key} accepted Phase 13 asset must include prepared and final sha256`);
    }
    assertHash(asset.key, "prepared", asset.preparedPath, asset.preparedSha256);
    if (asset.preparedSha256 !== asset.finalSha256) {
      throw new Error(`${asset.key} prepared sha256 must match final sha256`);
    }
  }
  if (
    asset.phase13Status === "preserved-existing"
    && asset.beforeSha256 !== undefined
    && asset.finalSha256 !== undefined
    && asset.beforeSha256 !== asset.finalSha256
  ) {
    throw new Error(`${asset.key} preserved final sha256 must match before sha256`);
  }
};

const analyseAsset = (asset: AssetContract, candidateRoot: string, reportText: string): AssetReport => {
  const candidateDir = path.join(candidateRoot, asset.key);
  const activeCandidateNames = readdirSync(candidateDir).filter((name) => name.startsWith("candidate_") && name.endsWith(".png"));
  assertManifestContract({ assets: [asset] }, asset.key, activeCandidateNames);
  assertReportAlignment(asset, reportText);

  for (const candidate of asset.candidates) {
    const decoded = readPng(path.join(candidateRoot, candidate.path));
    assertDimensions(asset.key, `candidate ${candidate.index}`, decoded.dimensions.width, decoded.dimensions.height, candidate.width, candidate.height);
  }
  assertPhase13Hashes(asset, candidateRoot);

  const before = readPng(asset.beforePath);
  const after = readPng(asset.finalPath);
  assertDimensions(asset.key, "before", before.dimensions.width, before.dimensions.height, asset.width, asset.height);
  assertDimensions(asset.key, "final", after.dimensions.width, after.dimensions.height, asset.width, asset.height);
  assertAlphaContract(
    asset.key,
    asset.alpha,
    asset.phase13Status === "accepted-generated" ? after.rgba : before.rgba,
    after.rgba,
  );
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

  let opaqueVisiblePixelCount = 0;
  for (let index = 0; index < after.rgba.length; index += 4) {
    const alpha = after.rgba[index + 3];
    if (alpha === undefined) {
      throw new Error(`${asset.finalPath} ended with an incomplete alpha byte`);
    }
    if (alpha > 0) {
      opaqueVisiblePixelCount += 1;
    }
  }

  return {
    key: asset.key,
    width: asset.width,
    height: asset.height,
    alphaPresent: alphaPresent(after.rgba),
    opaqueVisiblePixelCount,
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
