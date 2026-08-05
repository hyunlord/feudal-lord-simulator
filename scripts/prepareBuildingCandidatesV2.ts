import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  DEFAULT_CHROMA_KEY,
  assertBuildingSpriteSet,
  assertMillHeight,
  assertVisibleWidthBand,
  enforceFamilyMaterials,
  processSpriteFile,
  rampProfile,
  readPng,
  writePng,
} from "./processBuildingSprite";

const CONTRACTS = {
  house: { width: 96, height: 112, baselineY: 96, contentWidth: 78 },
  mill: { width: 96, height: 160, baselineY: 144, contentWidth: 88, contentHeight: 70 },
  granary: { width: 160, height: 144, baselineY: 128, contentWidth: 126 },
} as const;

const main = (): void => {
  const [, , rawRoot, outputRoot, reportPath] = process.argv;
  if (rawRoot === undefined || outputRoot === undefined || reportPath === undefined) {
    throw new Error("Usage: tsx scripts/prepareBuildingCandidatesV2.ts <raw-root> <output-root> <profile.json>");
  }
  mkdirSync(outputRoot, { recursive: true });
  const candidates: Array<Record<string, unknown>> = [];
  for (const [subject, contract] of Object.entries(CONTRACTS)) {
    for (let index = 1; index <= 8; index += 1) {
      const fileName = `${subject}_${String(index).padStart(2, "0")}.png`;
      const input = path.join(rawRoot, subject, fileName);
      const output = path.join(outputRoot, fileName);
      processSpriteFile(input, output, {
        target: contract,
        baselineY: contract.baselineY,
        contentWidth: contract.contentWidth,
        ...("contentHeight" in contract ? { contentHeight: contract.contentHeight } : {}),
        chromaKey: DEFAULT_CHROMA_KEY,
        threshold: 24,
        softEdge: 96,
        outline: true,
      });
      const image = enforceFamilyMaterials(readPng(output), subject as keyof typeof CONTRACTS);
      writePng(output, image);
      candidates.push({
        fileName,
        subject,
        visibleWidthPx: assertVisibleWidthBand(image, subject as keyof typeof CONTRACTS),
        ...(subject === "mill" ? { visibleHeightPx: assertMillHeight(image) } : {}),
        ramps: rampProfile(image),
      });
    }
  }
  assertBuildingSpriteSet(outputRoot);
  writeFileSync(reportPath, `${JSON.stringify({ candidates }, null, 2)}\n`);
};

main();
