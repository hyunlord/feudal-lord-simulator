import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { PALETTE, RAMPS } from "../src/content/palette";
import { OUTLINE_ALPHA, byteIndex, processSpriteRgba, writePng, type RgbaImage } from "../scripts/processBuildingSprite";
import { processTerrainRgba } from "../scripts/terrainTexturePipeline";
import { analyse } from "../scripts/verifyUiAssets";
import { processWorldSprite } from "../scripts/worldSpritePipeline";
import {
  ACCEPTED_REFERENCE_KEYS,
  BUILDING_KEYS,
  BUILDING_SPECS,
  FOLIAGE_CANDIDATE_COUNT,
  FOLIAGE_KEYS,
  FOLIAGE_SPECS,
  TREE_STUMP_KEYS,
  TERRAIN_KEYS,
  TERRAIN_SPECS,
  type AcceptedReference,
  type FoliageSelection,
  type ParchmentMetrics,
  type WorldAssetManifest,
} from "../scripts/worldAssetContracts";
import { parseWorldAssetManifest } from "../scripts/worldAssetManifest";

const customRgb = [123, 77, 68] as const;
const sha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const source = { seed: 713001, candidate: 1 } as const;

const hexToRgb = (hex: string): readonly [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const image = (width: number, height: number): RgbaImage => ({
  dimensions: { width, height },
  rgba: new Uint8Array(width * height * 4),
});

const setPixel = (
  target: RgbaImage,
  x: number,
  y: number,
  colour: readonly [number, number, number, number],
): void => {
  target.rgba.set(colour, byteIndex(target.dimensions, x, y));
};

const fillRect = (
  target: RgbaImage,
  left: number,
  top: number,
  right: number,
  bottom: number,
  colour: readonly [number, number, number, number],
): void => {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) setPixel(target, x, y, colour);
  }
};

const pixel = (target: RgbaImage, x: number, y: number): readonly [number, number, number, number] => {
  const index = byteIndex(target.dimensions, x, y);
  const r = target.rgba[index];
  const g = target.rgba[index + 1];
  const b = target.rgba[index + 2];
  const a = target.rgba[index + 3];
  if (r === undefined || g === undefined || b === undefined || a === undefined) {
    throw new Error(`Missing pixel at ${x},${y}`);
  }
  return [r, g, b, a];
};

const foliageSelection = (key: (typeof TREE_STUMP_KEYS)[number]): FoliageSelection => ({
  key,
  selectedCandidate: 1,
  tieBreak: "lowest-seed",
  candidates: Array.from({ length: FOLIAGE_CANDIDATE_COUNT }, (_, index) => ({
    candidate: index + 1,
    seed: 713100 + index,
    path: `raw/foliage/${key}_${String(index + 1).padStart(2, "0")}.png`,
    sha256,
    width: FOLIAGE_SPECS[key].width,
    height: FOLIAGE_SPECS[key].height,
    alpha: true,
    transparentBackground: true,
    bakedGroundShadowAbsent: true,
    selected: index === 0,
    hardRejected: false,
    rubric: { trunkGroundContact: 2, silhouette: 2, lightingVariation: 2, referenceStyle: 2, total: 8 },
  })),
});

const acceptedReferences: readonly AcceptedReference[] = ACCEPTED_REFERENCE_KEYS.map((key, index) => ({
  key,
  path: `public/assets/buildings/candidates_v2/${key}.png`,
  sha256,
  width: index === 2 ? 160 : 96,
  height: index === 1 ? 160 : index === 2 ? 144 : 112,
}));

const parchmentMetrics: ParchmentMetrics = {
  decision: "flat-token",
  thresholds: {
    joinBandMaxDelta: 24,
    joinToInternalRatio: 2,
    internalTolerance: 4,
    blockLumaRangeMax: 16,
    blockLumaStandardDeviationMin: 1,
    blockLumaStandardDeviationMax: 8,
  },
  candidates: [],
};

const fullColourManifest = (): WorldAssetManifest => ({
  version: 1,
  acceptedReferences,
  foliageSelections: TREE_STUMP_KEYS.map(foliageSelection),
  parchmentMetrics,
  assets: [
    ...BUILDING_KEYS.map((key) => {
      const spec = BUILDING_SPECS[key];
      return {
        key,
        category: "building" as const,
        path: `public/assets/buildings/${key}.png`,
        sha256,
        width: spec.width,
        height: spec.height,
        anchor: { x: spec.width / 2, y: spec.baselineY },
        footprint: spec.footprint,
        source,
        palettePolicy: "full-colour-generated" as const,
        alphaPolicy: "transparent-outline-179" as const,
      };
    }),
    ...FOLIAGE_KEYS.map((key) => {
      const spec = FOLIAGE_SPECS[key];
      return {
        key,
        category: "foliage" as const,
        path: `public/assets/foliage/${key}.png`,
        sha256,
        width: spec.width,
        height: spec.height,
        anchor: { x: spec.width / 2, y: spec.baselineY },
        footprint: spec.footprint,
        source,
        palettePolicy: "full-colour-generated" as const,
        alphaPolicy: "transparent-outline-179" as const,
        variation: { selection: "hash" as const, scale: { min: 0.7 as const, max: 1.3 as const }, offset: "in-tile" as const, sway: "sine" as const },
      };
    }),
    ...TERRAIN_KEYS.map((key, index) => {
      const spec = TERRAIN_SPECS[key];
      return {
        key,
        category: "terrain" as const,
        path: `public/assets/terrain/${key}.png`,
        sha256,
        width: spec.width,
        height: spec.height,
        anchor: { x: 0, y: 0 },
        footprint: spec.footprint,
        source: { seed: 713200 + index, candidate: 1 },
        palettePolicy: "full-colour-generated" as const,
        alphaPolicy: "opaque" as const,
        seamMetrics: {
          horizontalJoinDelta: 0,
          verticalJoinDelta: 0,
          horizontalInternalDelta: 1,
          verticalInternalDelta: 1,
          threshold: 24,
          passed: true as const,
        },
      };
    }),
  ],
});

const writeUiAsset = (root: string, key: string, rgba: RgbaImage, alpha: "transparent" | "opaque"): string => {
  const finalPath = `public/assets/ui/${key}.png`;
  const beforePath = `docs/asset-evidence/before/${key}.png`;
  const candidatePath = `${key}/candidate_1_seed_713001.png`;
  writePng(path.join(root, finalPath), rgba);
  writePng(path.join(root, beforePath), rgba);
  writePng(path.join(root, "candidates", candidatePath), rgba);
  return `| \`${key}\` | 1 seed \`713001\` | 1 | \`${beforePath}\` | \`${finalPath}\` | ${rgba.dimensions.width}x${rgba.dimensions.height} | ${alpha === "transparent" ? "present, preserved" : "all-opaque, preserved"} | generated fixture |`;
};

const fileSha256 = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const makeScrollFrame = (): RgbaImage => {
  const target = image(100, 100);
  fillRect(target, 20, 8, 80, 20, [...hexToRgb(RAMPS.plaster[2]), 255]);
  fillRect(target, 20, 80, 80, 92, [...hexToRgb(RAMPS.plaster[2]), 255]);
  fillRect(target, 8, 20, 20, 80, [...hexToRgb(RAMPS.plaster[2]), 255]);
  fillRect(target, 80, 20, 92, 80, [...hexToRgb(RAMPS.plaster[2]), 255]);
  fillRect(target, 14, 14, 22, 22, [...hexToRgb(PALETTE.gold), 255]);
  fillRect(target, 78, 14, 86, 22, [...hexToRgb(PALETTE.ultramarine), 255]);
  fillRect(target, 14, 78, 22, 86, [...hexToRgb(PALETTE.vermilion), 255]);
  fillRect(target, 78, 78, 86, 86, [...hexToRgb(PALETTE.ink), 255]);
  fillRect(target, 32, 10, 36, 14, [...customRgb, 255]);
  return target;
};

const makeWoodConsole = (): RgbaImage => {
  const target = image(120, 20);
  fillRect(target, 0, 0, 120, 20, [...hexToRgb(RAMPS.timber[2]), 255]);
  fillRect(target, 0, 1, 120, 3, [...hexToRgb(RAMPS.timber[5]), 255]);
  for (let x = 0; x < 120; x += 1) {
    setPixel(target, x, 6, x % 3 === 0 ? [...customRgb, 255] : [...hexToRgb(RAMPS.timber[1]), 255]);
    setPixel(target, x, 14, [...hexToRgb(RAMPS.timber[3]), 255]);
  }
  fillRect(target, 8, 5, 32, 16, [...hexToRgb(PALETTE.ink), 255]);
  fillRect(target, 48, 5, 72, 16, [...hexToRgb(PALETTE.ink), 255]);
  fillRect(target, 88, 5, 112, 16, [...hexToRgb(PALETTE.ink), 255]);
  return target;
};

const uiAssets = [
  { key: "scroll_frame", dimensions: { width: 100, height: 100 }, alpha: "transparent" as const },
  { key: "wood_console", dimensions: { width: 120, height: 20 }, alpha: "opaque" as const },
  { key: "seal_slot", dimensions: { width: 8, height: 8 }, alpha: "transparent" as const },
  { key: "parchment_texture", dimensions: { width: 8, height: 8 }, alpha: "transparent" as const },
  { key: "illumination_corner", dimensions: { width: 8, height: 8 }, alpha: "transparent" as const },
] as const;

describe("Phase 13 full-colour generated assets", () => {
  it("preserves generated building RGB while retaining alpha-179 exterior ink outline", () => {
    // Given: non-palette generated interior colour on a transparent sprite source.
    const sourceImage = image(4, 4);
    fillRect(sourceImage, 1, 1, 3, 3, [...customRgb, 200]);

    // When: the building sprite pipeline crops, scales, clears the baseline, and outlines it.
    const processed = processSpriteRgba(sourceImage, {
      target: { width: 10, height: 10 },
      baselineY: 8,
      chromaKey: { r: 0, g: 255, b: 255 },
      threshold: 24,
      softEdge: 96,
      outline: true,
      contentWidth: 4,
      contentHeight: 4,
    });

    // Then: interior RGB is not snapped to the canonical palette, visible alpha normalizes to 255, and the exterior outline contract remains.
    assert.deepEqual(pixel(processed, 4, 5), [...customRgb, 255]);
    assert.equal(pixel(processed, 4, 3)[3], OUTLINE_ALPHA);
    assert.deepEqual(pixel(processed, 4, 9), [0, 0, 0, 0]);
  });

  it("preserves generated RGB through the world sprite pipeline", () => {
    // Given: a non-palette generated source colour for a release building sprite.
    const sourceImage = image(4, 4);
    fillRect(sourceImage, 1, 1, 3, 3, [...customRgb, 255]);

    // When: the higher-level world sprite path applies exact geometry, alpha normalization, and outline.
    const processed = processWorldSprite(sourceImage, "house_l1", (_source, target) => {
      const resized = image(target.width, target.height);
      fillRect(resized, 0, 0, target.width, target.height, [...customRgb, 255]);
      return resized;
    });

    // Then: the generated RGB survives the release pipeline.
    assert.deepEqual(pixel(processed, 48, 96), [...customRgb, 255]);
    assert.deepEqual(processed.dimensions, { width: 96, height: 120 });
  });

  it("keeps terrain source RGB instead of quantising pixels to terrain ramps", () => {
    // Given: a seamless full-colour source with a non-palette RGB away from join bands.
    const sourceImage = image(512, 512);
    for (let y = 0; y < 512; y += 1) {
      for (let x = 0; x < 512; x += 1) {
        setPixel(sourceImage, x, y, [40 + (x % 73), 90 + (y % 59), 70 + ((x + y) % 67), 255]);
      }
    }
    setPixel(sourceImage, 328, 328, [...customRgb, 255]);

    // When: terrain is periodicised for release.
    const result = processTerrainRgba(sourceImage, "grass");

    // Then: offset-preserved interior pixels keep their generated colour and remain opaque.
    assert.deepEqual(pixel(result.texture, 72, 72), [...customRgb, 255]);
    assert.deepEqual(result.texture.dimensions, { width: 512, height: 512 });
    assert.equal(result.texture.rgba.every((channel, index) => index % 4 !== 3 || channel === 255), true);
  });

  it("parses generated world assets with the full-colour manifest policy", () => {
    // Given: a complete manifest using the Phase 13 generated-art policy.
    const manifest = fullColourManifest();

    // When: untrusted manifest JSON crosses the parser boundary.
    const parsed = parseWorldAssetManifest(manifest);

    // Then: generated buildings, foliage, and terrain carry the same full-colour policy.
    assert.equal(parsed.assets.find((asset) => asset.key === "house_l1")?.palettePolicy, "full-colour-generated");
    assert.equal(parsed.assets.find((asset) => asset.key === "tree_oak_large")?.palettePolicy, "full-colour-generated");
    assert.equal(parsed.assets.find((asset) => asset.key === "grass")?.palettePolicy, "full-colour-generated");
  });

  it("accepts non-palette RGB in generated UI assets while keeping final-art guards", () => {
    // Given: a temporary UI asset release with valid geometry, alpha, report rows, and non-palette generated colour.
    const root = mkdtempSync(path.join(tmpdir(), "phase13-ui-assets-"));
    const previousCwd = process.cwd();
    try {
      const rows = uiAssets.map((asset) => {
        const generated = asset.key === "scroll_frame"
          ? makeScrollFrame()
          : asset.key === "wood_console"
            ? makeWoodConsole()
            : image(asset.dimensions.width, asset.dimensions.height);
        return writeUiAsset(root, asset.key, generated, asset.alpha);
      });
      const assets = uiAssets.map((asset) => ({
        key: asset.key,
        ...asset.dimensions,
        alpha: asset.alpha,
        beforePath: `docs/asset-evidence/before/${asset.key}.png`,
        finalPath: `public/assets/ui/${asset.key}.png`,
        selectedIndex: 1,
        candidates: [{
          index: 1,
          seed: 713001,
          path: `${asset.key}/candidate_1_seed_713001.png`,
          ...asset.dimensions,
        }],
      }));
      writeFileSync(path.join(root, "docs", "asset-evidence", "uiAssetManifest.json"), `${JSON.stringify({ assets }, null, 2)}\n`);
      writeFileSync(
        path.join(root, "docs", "ASSET_REPORT.md"),
        `${rows.join("\n")}\n${uiAssets.map((asset) => `- Candidate \`${asset.key}/candidate_1_seed_713001.png\``).join("\n")}\n`,
      );
      process.chdir(root);

      // When / Then: analysis accepts generated RGB values and still exercises asset-specific final-art checks.
      assert.doesNotThrow(() => analyse(path.join(root, "candidates")));
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects Phase 13 UI evidence when before snapshots or prepared finals drift", () => {
    // Given: a Phase 13 accepted UI manifest with hashes binding before, prepared, selected candidate, and final files.
    const root = mkdtempSync(path.join(tmpdir(), "phase13-ui-drift-"));
    const previousCwd = process.cwd();
    try {
      const scroll = makeScrollFrame();
      const rows = uiAssets.map((asset) => {
        const generated = asset.key === "scroll_frame"
          ? scroll
          : asset.key === "wood_console"
            ? makeWoodConsole()
            : image(asset.dimensions.width, asset.dimensions.height);
        return writeUiAsset(root, asset.key, generated, asset.alpha);
      });
      writePng(path.join(root, "docs", "asset-evidence", "phase13", "prepared-ui", "scroll_frame.png"), scroll);
      const assets = uiAssets.map((asset) => {
        const beforePath = `docs/asset-evidence/before/${asset.key}.png`;
        const finalPath = `public/assets/ui/${asset.key}.png`;
        const candidatePath = `candidates/${asset.key}/candidate_1_seed_713001.png`;
        const common = {
          key: asset.key,
          ...asset.dimensions,
          alpha: asset.alpha,
          beforePath,
          finalPath,
          selectedIndex: 1,
          candidates: [{
            index: 1,
            seed: 713001,
            path: `${asset.key}/candidate_1_seed_713001.png`,
            ...asset.dimensions,
            sha256: fileSha256(path.join(root, candidatePath)),
          }],
          beforeSha256: fileSha256(path.join(root, beforePath)),
          finalSha256: fileSha256(path.join(root, finalPath)),
        };
        return asset.key === "scroll_frame"
          ? {
            ...common,
            phase13Status: "accepted-generated",
            phase13Source: "phase13-candidate",
            selectedCandidateSha256: fileSha256(path.join(root, candidatePath)),
            preparedPath: "docs/asset-evidence/phase13/prepared-ui/scroll_frame.png",
            preparedSha256: fileSha256(path.join(root, "docs", "asset-evidence", "phase13", "prepared-ui", "scroll_frame.png")),
          }
          : { ...common, phase13Status: "preserved-existing", phase13Source: "public/assets/ui" };
      });
      writeFileSync(path.join(root, "docs", "asset-evidence", "uiAssetManifest.json"), `${JSON.stringify({ assets }, null, 2)}\n`);
      writeFileSync(
        path.join(root, "docs", "ASSET_REPORT.md"),
        `${rows.join("\n")}\n${uiAssets.map((asset) => `- Candidate \`${asset.key}/candidate_1_seed_713001.png\``).join("\n")}\n`,
      );
      process.chdir(root);

      // When / Then: accepted generated assets may have true pre-release alpha
      // snapshots while preserved assets still require before/final identity.
      assert.doesNotThrow(() => analyse(path.join(root, "candidates")));
      const acceptedBefore = makeScrollFrame();
      acceptedBefore.rgba[3] = acceptedBefore.rgba[3] === 0 ? 255 : 0;
      writePng(path.join(root, "docs", "asset-evidence", "before", "scroll_frame.png"), acceptedBefore);
      const scrollAsset = assets.find((asset) => asset.key === "scroll_frame");
      if (scrollAsset === undefined) {
        throw new Error("scroll_frame fixture asset was missing");
      }
      scrollAsset.beforeSha256 = fileSha256(path.join(root, "docs", "asset-evidence", "before", "scroll_frame.png"));
      writeFileSync(path.join(root, "docs", "asset-evidence", "uiAssetManifest.json"), `${JSON.stringify({ assets }, null, 2)}\n`);
      assert.doesNotThrow(() => analyse(path.join(root, "candidates")));

      // Mutating before or final/prepared bytes without updating the manifest still fails the verifier.
      const mutatedBefore = image(100, 100);
      writePng(path.join(root, "docs", "asset-evidence", "before", "scroll_frame.png"), mutatedBefore);
      assert.throws(() => analyse(path.join(root, "candidates")), /before sha256/i);
      writePng(path.join(root, "docs", "asset-evidence", "before", "scroll_frame.png"), scroll);
      scrollAsset.beforeSha256 = fileSha256(path.join(root, "docs", "asset-evidence", "before", "scroll_frame.png"));
      writeFileSync(path.join(root, "docs", "asset-evidence", "uiAssetManifest.json"), `${JSON.stringify({ assets }, null, 2)}\n`);
      writePng(path.join(root, "public", "assets", "ui", "scroll_frame.png"), mutatedBefore);
      assert.throws(() => analyse(path.join(root, "candidates")), /prepared sha256|final sha256/i);
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
