import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { readPng, writePng, type RgbaImage } from "../scripts/processBuildingSprite";

type CandidateReportRow = {
  readonly fileName: string;
  readonly subject: "house" | "mill" | "granary";
  readonly visibleWidthPx: number;
  readonly visibleColourCount: number;
};

type CandidateReport = {
  readonly candidates: readonly CandidateReportRow[];
};

const CANDIDATE_CONTRACTS = {
  house: { width: 96, height: 112, baselineY: 96, contentWidth: 78, contentHeight: 72 },
  mill: { width: 96, height: 160, baselineY: 144, contentWidth: 88, contentHeight: 70 },
  granary: { width: 160, height: 144, baselineY: 128, contentWidth: 126, contentHeight: 72 },
} as const;

const SCRIPT_PATH = path.join(process.cwd(), "scripts/prepareBuildingCandidatesV2.ts");

const setPixel = (
  image: RgbaImage,
  x: number,
  y: number,
  rgba: readonly [number, number, number, number],
): void => {
  const index = (y * image.dimensions.width + x) * 4;
  image.rgba[index] = rgba[0];
  image.rgba[index + 1] = rgba[1];
  image.rgba[index + 2] = rgba[2];
  image.rgba[index + 3] = rgba[3];
};

const fullColourFixture = (
  contract: (typeof CANDIDATE_CONTRACTS)[keyof typeof CANDIDATE_CONTRACTS],
  rgb: readonly [number, number, number],
): RgbaImage => {
  const image: RgbaImage = {
    dimensions: { width: contract.width, height: contract.height },
    rgba: new Uint8Array(contract.width * contract.height * 4),
  };
  for (let y = 0; y < contract.height; y += 1) {
    for (let x = 0; x < contract.width; x += 1) setPixel(image, x, y, [0, 255, 255, 255]);
  }
  const left = Math.floor((contract.width - contract.contentWidth) / 2);
  const top = contract.baselineY - contract.contentHeight;
  for (let y = top; y < contract.baselineY; y += 1) {
    for (let x = left; x < left + contract.contentWidth; x += 1) setPixel(image, x, y, [...rgb, 255]);
  }
  return image;
};

const visibleRgbKeys = (image: RgbaImage): ReadonlySet<string> => {
  const keys = new Set<string>();
  for (let index = 0; index < image.rgba.length; index += 4) {
    if (image.rgba[index + 3] === 255) {
      keys.add(`${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]}`);
    }
  }
  return keys;
};

const isCandidateReportRow = (value: unknown): value is CandidateReportRow => {
  if (typeof value !== "object" || value === null) return false;
  if (!("fileName" in value) || typeof value.fileName !== "string") return false;
  if (!("subject" in value) || !["house", "mill", "granary"].includes(String(value.subject))) return false;
  return "visibleWidthPx" in value
    && typeof value.visibleWidthPx === "number"
    && "visibleColourCount" in value
    && typeof value.visibleColourCount === "number"
    && !("ramps" in value);
};

const parseCandidateReport = (raw: string): CandidateReport => {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || !("candidates" in parsed)) {
    throw new Error("candidate report root is invalid");
  }
  const candidates = parsed.candidates;
  if (!Array.isArray(candidates) || !candidates.every(isCandidateReportRow)) {
    throw new Error("candidate report rows are invalid");
  }
  return { candidates };
};

describe("prepareBuildingCandidatesV2", () => {
  it("preserves generated non-palette RGB and reports full-colour candidate counts", () => {
    // Given: 24 candidate PNGs whose visible interiors use RGB outside the old canonical ramps.
    const root = mkdtempSync(path.join(tmpdir(), "prepare-building-candidates-v2-"));
    const rawRoot = path.join(root, "raw");
    const outputRoot = path.join(root, "out");
    const reportPath = path.join(root, "report.json");
    const fullColourRgb = [91, 63, 47] as const;
    for (const [subject, contract] of Object.entries(CANDIDATE_CONTRACTS)) {
      const subjectRoot = path.join(rawRoot, subject);
      mkdirSync(subjectRoot, { recursive: true });
      for (let index = 1; index <= 8; index += 1) {
        writePng(
          path.join(subjectRoot, `${subject}_${String(index).padStart(2, "0")}.png`),
          fullColourFixture(contract, fullColourRgb),
        );
      }
    }

    // When: the candidate preparation CLI post-processes the generated set.
    const result = spawnSync(process.execPath, ["--import", "tsx", SCRIPT_PATH, rawRoot, outputRoot, reportPath], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    // Then: interior colour survives unchanged and the report has full-colour counts rather than ramp profiles.
    assert.equal(result.status, 0, result.stderr);
    const preparedHouse = readPng(path.join(outputRoot, "house_01.png"));
    assert.equal(visibleRgbKeys(preparedHouse).has(fullColourRgb.join(",")), true);
    const report = parseCandidateReport(readFileSync(reportPath, "utf8"));
    assert.equal(report.candidates.length, 24);
    assert.equal(report.candidates[0]?.visibleColourCount, 1);
  });
});
