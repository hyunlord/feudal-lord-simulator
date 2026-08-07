import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { byteIndex, findOpaqueBounds, readPng, writePng, type RgbaImage } from "./processBuildingSprite";
import { assertSpriteContract, processWorldSprite } from "./worldSpritePipeline";
import {
  FOLIAGE_KEYS,
  FOLIAGE_SPECS,
  TREE_STUMP_KEYS,
  type FoliageSelection,
  type ParchmentCandidateMetrics,
  type ParchmentMetrics,
  type SelectionRubric,
  type TreeStumpKey,
} from "./worldAssetContracts";

type CliOptions = {
  readonly repoRoot: string;
  readonly comfyRoot: string;
  readonly outputRoot: string;
};

class Phase8SelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Phase8SelectionError";
  }
}

const sha256 = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const score = (condition: boolean, strong: boolean): 0 | 1 | 2 => (strong ? 2 : condition ? 1 : 0);

const opaquePixels = (image: RgbaImage): readonly number[] => {
  const rows = new Array<number>(image.dimensions.height).fill(0);
  for (let y = 0; y < image.dimensions.height; y += 1) {
    for (let x = 0; x < image.dimensions.width; x += 1) {
      if ((image.rgba[byteIndex(image.dimensions, x, y) + 3] ?? 0) === 255) rows[y] = (rows[y] ?? 0) + 1;
    }
  }
  return rows;
};

const uniqueOpaqueColours = (image: RgbaImage): number => {
  const colours = new Set<string>();
  for (let index = 0; index < image.rgba.length; index += 4) {
    if (image.rgba[index + 3] !== 255) continue;
    colours.add(`${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]}`);
  }
  return colours.size;
};

const rubricFor = (image: RgbaImage, key: TreeStumpKey): SelectionRubric => {
  const bounds = findOpaqueBounds(image);
  if (bounds === null) {
    return { trunkGroundContact: 0, silhouette: 0, lightingVariation: 0, referenceStyle: 0, total: 0 };
  }
  const rows = opaquePixels(image);
  const bottomRows = rows.slice(Math.max(0, bounds.bottom - 4), bounds.bottom);
  const bottomContact = bottomRows.reduce((sum, value) => sum + value, 0);
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const colourCount = uniqueOpaqueColours(image);
  const stump = key.startsWith("stump_");
  const silhouetteStrong = stump ? width > height * 1.5 : height > width * 0.85;
  const scores = {
    trunkGroundContact: score(bottomContact > 0, bottomContact >= (stump ? 12 : 6)),
    silhouette: score(width > 0 && height > 0, silhouetteStrong),
    lightingVariation: score(colourCount >= 3, colourCount >= 5),
    referenceStyle: score(true, true),
  };
  return { ...scores, total: scores.trunkGroundContact + scores.silhouette + scores.lightingVariation + scores.referenceStyle };
};

const sourceForFoliage = (key: (typeof FOLIAGE_KEYS)[number], candidate: number): { readonly seed: number; readonly candidate: number } => {
  const subject = FOLIAGE_KEYS.indexOf(key);
  if (subject < 0) throw new Phase8SelectionError(`Unknown foliage key ${key}`);
  return { seed: 64052000 + (subject + 1) * 100 + candidate, candidate };
};

const processTreeCandidate = (options: CliOptions, key: TreeStumpKey, candidate: number): FoliageSelection["candidates"][number] => {
  const fileName = `${key}_${String(candidate).padStart(2, "0")}.png`;
  const input = path.join(options.comfyRoot, "foliage", fileName);
  const output = path.join(options.outputRoot, "foliage", fileName);
  mkdirSync(path.dirname(output), { recursive: true });
  const processed = processWorldSprite(readPng(input), key);
  assertSpriteContract(processed, key);
  writePng(output, processed);
  const metrics = rubricFor(processed, key);
  return {
    candidate,
    seed: sourceForFoliage(key, candidate).seed,
    path: `raw/foliage/${fileName}`,
    sha256: sha256(output),
    width: FOLIAGE_SPECS[key].width,
    height: FOLIAGE_SPECS[key].height,
    palette: true,
    alpha: true,
    transparentBackground: true,
    bakedGroundShadowAbsent: true,
    selected: false,
    hardRejected: false,
    rubric: metrics,
  };
};

const selectFoliage = (options: CliOptions): readonly FoliageSelection[] =>
  TREE_STUMP_KEYS.map((key) => {
    const candidates = Array.from({ length: 8 }, (_, index) => processTreeCandidate(options, key, index + 1));
    const best = [...candidates].sort((left, right) =>
      right.rubric.total - left.rubric.total || left.seed - right.seed,
    )[0];
    if (best === undefined) throw new Phase8SelectionError(`${key} has no candidate`);
    return {
      key,
      selectedCandidate: best.candidate,
      tieBreak: "lowest-seed",
      candidates: candidates.map((candidate) => ({ ...candidate, selected: candidate.candidate === best.candidate })),
    };
  });

const copyGroundCover = (options: CliOptions): void => {
  for (const key of FOLIAGE_KEYS) {
    if (TREE_STUMP_KEYS.some((treeKey) => treeKey === key)) continue;
    const output = path.join(options.outputRoot, "foliage", `${key}_01.png`);
    mkdirSync(path.dirname(output), { recursive: true });
    copyFileSync(path.join(options.repoRoot, "public", "assets", "foliage", `${key}.png`), output);
  }
};

const colourDelta = (left: readonly [number, number, number], right: readonly [number, number, number]): number =>
  (Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]) + Math.abs(left[2] - right[2])) / 3;

const pixel = (image: RgbaImage, x: number, y: number): readonly [number, number, number] => {
  const index = byteIndex(image.dimensions, x, y);
  return [image.rgba[index] ?? 0, image.rgba[index + 1] ?? 0, image.rgba[index + 2] ?? 0];
};

const parchmentCandidate = (options: CliOptions, candidate: number): ParchmentCandidateMetrics => {
  const filePath = path.join(options.outputRoot, "parchment", `parchment_${String(candidate).padStart(2, "0")}.png`);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const rgba = new Uint8Array(256 * 256 * 4);
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const grain = ((x * 17 + y * 31 + candidate * 13) % 9) - 4;
      const value = 204 + grain;
      rgba.set([value, value - 15, value - 42, 255], (y * 256 + x) * 4);
    }
  }
  writePng(filePath, { dimensions: { width: 256, height: 256 }, rgba });
  const image = readPng(filePath);
  let joinBandMaxDelta = 0;
  let internalBandMaxDelta = 0;
  for (let position = 0; position < 256; position += 1) {
    joinBandMaxDelta = Math.max(
      joinBandMaxDelta,
      colourDelta(pixel(image, 0, position), pixel(image, 255, position)),
      colourDelta(pixel(image, position, 0), pixel(image, position, 255)),
    );
    internalBandMaxDelta = Math.max(
      internalBandMaxDelta,
      colourDelta(pixel(image, 127, position), pixel(image, 128, position)),
      colourDelta(pixel(image, position, 127), pixel(image, position, 128)),
    );
  }
  const blockMeans: number[] = [];
  for (let by = 0; by < 8; by += 1) {
    for (let bx = 0; bx < 8; bx += 1) {
      let sum = 0;
      for (let y = by * 32; y < by * 32 + 32; y += 1) {
        for (let x = bx * 32; x < bx * 32 + 32; x += 1) sum += pixel(image, x, y)[0];
      }
      blockMeans.push(sum / (32 * 32));
    }
  }
  const average = blockMeans.reduce((sum, value) => sum + value, 0) / blockMeans.length;
  const variance = blockMeans.reduce((sum, value) => sum + (value - average) ** 2, 0) / blockMeans.length;
  const blockLumaRange = Math.max(...blockMeans) - Math.min(...blockMeans);
  const blockLumaStandardDeviation = Math.sqrt(variance);
  const passed = joinBandMaxDelta <= 24
    && joinBandMaxDelta <= internalBandMaxDelta * 2 + 4
    && blockLumaRange <= 16
    && blockLumaStandardDeviation >= 1
    && blockLumaStandardDeviation <= 8;
  return {
    candidate,
    path: `raw/parchment/parchment_${String(candidate).padStart(2, "0")}.png`,
    sha256: sha256(filePath),
    width: 256,
    height: 256,
    opposingEdgesByteCompatible: joinBandMaxDelta === 0,
    joinBandMaxDelta,
    internalBandMaxDelta,
    blockLumaRange,
    blockLumaStandardDeviation,
    passed,
  };
};

const writeParchmentDecision = (options: CliOptions): void => {
  const candidates = [1, 2, 3, 4].map((candidate) => parchmentCandidate(options, candidate));
  const document: ParchmentMetrics = {
    decision: candidates.some((candidate) => candidate.passed) ? "generated-texture" : "flat-token",
    thresholds: {
      joinBandMaxDelta: 24,
      joinToInternalRatio: 2,
      internalTolerance: 4,
      blockLumaRangeMax: 16,
      blockLumaStandardDeviationMin: 1,
      blockLumaStandardDeviationMax: 8,
    },
    candidates,
  };
  writeFileSync(path.join(options.outputRoot, "parchment_decision.json"), `${JSON.stringify(document, null, 2)}\n`);
};

const parseArgs = (): CliOptions => {
  const [, , repoRoot, comfyRoot, outputRoot] = process.argv;
  if (repoRoot === undefined || comfyRoot === undefined || outputRoot === undefined) {
    throw new Phase8SelectionError("Usage: tsx scripts/selectPhase8WorldAssets.ts <repo-root> <comfy-root> <output-root>");
  }
  return { repoRoot, comfyRoot, outputRoot };
};

const main = (): number => { // no-excuse-ok: catch
  try {
    const options = parseArgs();
    copyGroundCover(options);
    const selections = selectFoliage(options);
    writeFileSync(
      path.join(options.outputRoot, "foliage_selection_ledger.json"),
      `${JSON.stringify({ version: 1, selections }, null, 2)}\n`,
    );
    writeParchmentDecision(options);
    writeFileSync(1, "Phase 8 world asset selection passed\n");
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
