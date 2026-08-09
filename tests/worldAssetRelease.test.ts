import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { RAMPS } from "../src/content/palette";
import {
  prepareWorldAssets,
  rawFoliageFileName,
  type BuildingSelections,
  type StoneTownSelections,
} from "../scripts/prepareWorldAssets";
import { readPng, writePng, type RgbaImage } from "../scripts/processBuildingSprite";
import { verifyWorldAssets } from "../scripts/verifyWorldAssets";
import {
  assertPhase13ReleaseEvidence,
  categoryForWorldAssetKey,
  phase13SourceForWorldAsset,
  readPhase13AcceptedRelease,
  releasePathForWorldAsset,
} from "../scripts/phase13AcceptedRelease";
import {
  FOLIAGE_KEYS,
  FOLIAGE_SPECS,
  BUILDING_KEYS,
  BUILDING_SPECS,
  STONE_TOWN_ASSET_KEYS,
  STONE_TOWN_ASSET_SPECS,
  TREE_STUMP_KEYS,
  TERRAIN_KEYS,
  WORLD_ASSET_KEYS,
} from "../scripts/worldAssetContracts";
import { parseWorldAssetManifest } from "../scripts/worldAssetManifest";

const selections = {
  house_l1: 1,
  house_l2: 2,
  house_l3: 3,
  well: 4,
  storehouse: 5,
  wheat_farm: 6,
  logging_camp: 1,
  sawmill: 2,
} as const satisfies BuildingSelections;
const stoneTownSelections = {
  quarry: 2,
  masonry: 3,
  market: 4,
  church: 1,
  keep: 3,
  house_l4: 4,
  stone_wall_segment: 3,
} as const satisfies StoneTownSelections;

const rgb = (hex: string): readonly [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const fileSha256 = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const image = (width: number, height: number, background: readonly [number, number, number, number]): RgbaImage => {
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < rgba.length; index += 4) rgba.set(background, index);
  return { dimensions: { width, height }, rgba };
};

const fill = (
  target: RgbaImage,
  left: number,
  top: number,
  right: number,
  bottom: number,
  colour: readonly [number, number, number, number],
): void => {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) target.rgba.set(colour, (y * target.dimensions.width + x) * 4);
  }
};

const setPixel = (
  target: RgbaImage,
  x: number,
  y: number,
  colour: readonly [number, number, number, number],
): void => {
  target.rgba.set(colour, (y * target.dimensions.width + x) * 4);
};

const writeRawSprite = (filePath: string, width: number, height: number, colour: string): void => {
  const source = image(width + 16, height + 16, [0, 255, 255, 255]);
  fill(source, 8, 8, width + 8, height + 8, [...rgb(colour), 255]);
  writePng(filePath, source);
};

const writeRichRawSprite = (filePath: string, width: number, height: number): void => {
  const source = image(width + 16, height + 16, [0, 255, 255, 255]);
  for (let y = 8; y < height + 8; y += 1) {
    for (let x = 8; x < width + 8; x += 1) {
      setPixel(source, x, y, [70 + ((x * 5 + y * 3) % 120), 55 + ((x * 7 + y * 11) % 130), 45 + ((x * 13 + y) % 110), 255]);
    }
  }
  writePng(filePath, source);
};

const writeRichTerrain = (filePath: string): void => {
  const terrain = image(512, 512, [0, 0, 0, 255]);
  for (let y = 0; y < 512; y += 1) {
    for (let x = 0; x < 512; x += 1) {
      const value = ((x % 32) * 3 + (y % 32) * 5) % 128;
      setPixel(terrain, x, y, [72 + value, 94 + Math.floor(value / 2), 62 + Math.floor(value / 3), 255]);
    }
  }
  writePng(filePath, terrain);
};

const writePromoted = (filePath: string, width: number, height: number, visibleWidth: number, visibleHeight: number): void => {
  const promoted = image(width, height, [0, 0, 0, 0]);
  const left = Math.floor((width - visibleWidth) / 2);
  fill(promoted, left, height - 16 - visibleHeight, left + visibleWidth, height - 16, [...rgb(RAMPS.thatch[2]), 255]);
  writePng(filePath, promoted);
};

type Fixture = {
  readonly root: string;
  readonly rawRoot: string;
  readonly phase4bRoot: string;
};

const fixture = (): Fixture => {
  const root = mkdtempSync(path.join(tmpdir(), "phase4c-release-"));
  const rawRoot = path.join(root, "raw");
  const phase4bRoot = path.join(root, "phase4b");
  mkdirSync(path.join(rawRoot, "building"), { recursive: true });
  mkdirSync(path.join(rawRoot, "foliage"), { recursive: true });
  mkdirSync(path.join(rawRoot, "terrain"), { recursive: true });
  mkdirSync(phase4bRoot, { recursive: true });

  const buildingShapes = [
    ["house_l1", 64, 28, selections.house_l1], ["house_l2", 64, 46, selections.house_l2],
    ["house_l3", 128, 92, selections.house_l3], ["well", 64, 40, selections.well],
    ["storehouse", 128, 70, selections.storehouse], ["wheat_farm", 128, 48, selections.wheat_farm],
    ["logging_camp", 64, 45, selections.logging_camp], ["sawmill", 80, 55, selections.sawmill],
  ] as const;
  for (const [key, width, height, candidate] of buildingShapes) {
    writeRawSprite(
      path.join(rawRoot, "building", `${key}_${String(candidate).padStart(2, "0")}.png`),
      width,
      height,
      key === "wheat_farm" ? RAMPS.earth[2] : RAMPS.plaster[2],
    );
  }
  for (const key of STONE_TOWN_ASSET_KEYS) {
    const spec = STONE_TOWN_ASSET_SPECS[key];
    writeRawSprite(
      path.join(rawRoot, "building", `${key}_${String(stoneTownSelections[key]).padStart(2, "0")}.png`),
      spec.footprint.width === 1 ? 72 : 128,
      Math.max(32, spec.baselineY - 24),
      RAMPS.stone[2],
    );
  }
  for (const [key, [width, height]] of Object.entries({
    tree_oak_large: [56, 86], tree_oak_small: [42, 60], tree_pine_tall: [38, 94],
    tree_pine_short: [36, 64], tree_birch: [34, 74], tree_dead: [34, 58],
    stump_fresh: [30, 14], stump_old: [28, 12], shrub_a: [30, 20], shrub_b: [24, 16],
    grass_tuft: [22, 12], field_stone: [18, 10],
  } as const)) {
    const candidates = TREE_STUMP_KEYS.some((candidateKey) => candidateKey === key) ? 8 : 1;
    for (let candidate = 1; candidate <= candidates; candidate += 1) {
      writeRawSprite(
        path.join(rawRoot, "foliage", `${key}_${String(candidate).padStart(2, "0")}.png`),
        width,
        height,
        key === "field_stone" ? RAMPS.stone[2] : RAMPS.foliage[2],
      );
    }
  }
  for (const key of ["grass", "forest_floor", "water", "rock", "packed_earth_road"] as const) {
    writeRichTerrain(path.join(rawRoot, "terrain", `${key}.png`));
  }
  writePromoted(path.join(phase4bRoot, "house_03.png"), 96, 112, 78, 20);
  writePromoted(path.join(phase4bRoot, "mill_02.png"), 96, 160, 90, 71);
  writePromoted(path.join(phase4bRoot, "granary_08.png"), 160, 144, 128, 70);
  return { root, rawRoot, phase4bRoot };
};

const writePhase13RawCandidates = (test: Fixture): void => {
  for (const key of BUILDING_KEYS) {
    const spec = BUILDING_SPECS[key];
    const sourceHeight = key === "mill" ? 54 : Math.max(18, spec.baselineY - 18);
    writeRichRawSprite(
      path.join(test.rawRoot, "building", `${key}_01.png`),
      spec.footprint.width === 1 ? Math.min(88, spec.width - 8) : Math.min(132, spec.width - 8),
      sourceHeight,
    );
  }
  for (const key of TERRAIN_KEYS) writeRichTerrain(path.join(test.rawRoot, "terrain", `${key}.png`));
};

const acceptedReleaseRecord = {
  version: 1,
  mode: "phase13-partial-accepted-release",
  accepted: [
    { category: "terrain", key: "forest_floor" },
    { category: "terrain", key: "rock" },
    { category: "building", key: "church" },
    { category: "building", key: "house_l1" },
    { category: "building", key: "logging_camp" },
    { category: "building", key: "mill" },
  ],
} as const;

const writeAcceptedReleaseRecord = (filePath: string, record: unknown = acceptedReleaseRecord): string => {
  writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
};

const releaseFilePath = (root: string): string =>
  path.join(root, "docs", "asset-evidence", "phase13WorldRelease.json");

describe("Phase 4C world asset release", () => {
  it("maps every Phase 8 release foliage key to its selected raw candidate filename", () => {
    for (const key of FOLIAGE_KEYS) assert.equal(rawFoliageFileName(key), `${key}_01.png`);
  });

  it("uses the Phase 8 foliage selection ledger when preparing tree and stump releases", () => {
    // Given: a complete raw fixture and a ledger selecting non-default tree/stump candidates.
    const test = fixture();
    try {
      const candidate = 3;
      const ledger = {
        version: 1,
        selections: TREE_STUMP_KEYS.map((key) => ({
          key,
          selectedCandidate: candidate,
          tieBreak: "lowest-seed",
          candidates: Array.from({ length: 8 }, (_, index) => ({
            candidate: index + 1,
            seed: 64052000 + (TREE_STUMP_KEYS.indexOf(key) + 1) * 100 + index + 1,
            path: `raw/foliage/${key}_${String(index + 1).padStart(2, "0")}.png`,
            sha256: `${(index + 1).toString(16).repeat(64).slice(0, 64)}`,
            width: FOLIAGE_SPECS[key].width,
            height: FOLIAGE_SPECS[key].height,
            alpha: true,
            transparentBackground: true,
            bakedGroundShadowAbsent: true,
            selected: index + 1 === candidate,
            hardRejected: false,
            rubric: {
              trunkGroundContact: index + 1 === candidate ? 2 : 1,
              silhouette: 2,
              lightingVariation: 2,
              referenceStyle: 2,
              total: index + 1 === candidate ? 8 : 7,
            },
          })),
        })),
      };
      writeFileSync(path.join(test.rawRoot, "foliage_selection_ledger.json"), `${JSON.stringify(ledger, null, 2)}\n`);

      // When: the release preparation boundary builds the manifest.
      const manifest = prepareWorldAssets({
        repoRoot: test.root,
        rawRoot: test.rawRoot,
        phase4bRoot: test.phase4bRoot,
        selections,
        stoneTownSelections,
      });

      // Then: tree/stump release sources and selection metadata use the ledger pick.
      for (const key of TREE_STUMP_KEYS) {
        const asset = manifest.assets.find((entry) => entry.key === key);
        assert.deepEqual(asset?.source, {
          seed: 64052000 + (TREE_STUMP_KEYS.indexOf(key) + 1) * 100 + candidate,
          candidate,
        });
        assert.equal(manifest.foliageSelections.find((entry) => entry.key === key)?.selectedCandidate, candidate);
      }
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("prepares the exact release, preserves Phase 4B bytes, and writes a complete manifest", () => {
    // Given: explicit building selections, raw category inputs, and the three accepted Phase 4B files.
    const test = fixture();
    try {
      const originals = new Map([
        ["house_l0", readFileSync(path.join(test.phase4bRoot, "house_03.png"))],
        ["mill", readFileSync(path.join(test.phase4bRoot, "mill_02.png"))],
        ["barn", readFileSync(path.join(test.phase4bRoot, "granary_08.png"))],
      ]);

      // When: the real preparation boundary builds the release.
      const manifest = prepareWorldAssets({
        repoRoot: test.root,
        rawRoot: test.rawRoot,
        phase4bRoot: test.phase4bRoot,
        selections,
        stoneTownSelections,
      });

      // Then: all exact keys validate and promoted assets remain byte-identical.
      assert.deepEqual(manifest.assets.map((asset) => asset.key), [...WORLD_ASSET_KEYS]);
      assert.deepEqual(
        Object.fromEntries(
          manifest.assets
            .filter((asset) => asset.category === "building" && asset.key in selections)
            .map((asset) => [asset.key, asset.source]),
        ),
        {
          house_l1: { seed: 64050101, candidate: 1 },
          house_l2: { seed: 64050202, candidate: 2 },
          house_l3: { seed: 64050303, candidate: 3 },
          well: { seed: 64050404, candidate: 4 },
          storehouse: { seed: 64050505, candidate: 5 },
          wheat_farm: { seed: 64050606, candidate: 6 },
          logging_camp: { seed: 64050701, candidate: 1 },
          sawmill: { seed: 64050802, candidate: 2 },
        },
      );
      assert.deepEqual(
        Object.fromEntries(
          manifest.assets
            .filter((asset) => asset.category === "building" && STONE_TOWN_ASSET_KEYS.some((key) => key === asset.key))
            .map((asset) => [asset.key, asset.source]),
        ),
        {
          quarry: { seed: 64054102, candidate: 2 },
          masonry: { seed: 64054203, candidate: 3 },
          market: { seed: 64054304, candidate: 4 },
          church: { seed: 64054401, candidate: 1 },
          keep: { seed: 64054503, candidate: 3 },
          house_l4: { seed: 64054604, candidate: 4 },
          stone_wall_segment: { seed: 64054703, candidate: 3 },
        },
      );
      assert.deepEqual(
        Object.fromEntries(
          manifest.assets
            .filter((asset) => asset.category === "foliage")
            .map((asset) => [asset.key, asset.source]),
        ),
        {
          tree_oak_large: { seed: 64052101, candidate: 1 },
          tree_oak_small: { seed: 64052201, candidate: 1 },
          tree_pine_tall: { seed: 64052301, candidate: 1 },
          tree_pine_short: { seed: 64052401, candidate: 1 },
          tree_birch: { seed: 64052501, candidate: 1 },
          tree_dead: { seed: 64052601, candidate: 1 },
          stump_fresh: { seed: 64052701, candidate: 1 },
          stump_old: { seed: 64052801, candidate: 1 },
          shrub_a: { seed: 64052901, candidate: 1 },
          shrub_b: { seed: 64053001, candidate: 1 },
          grass_tuft: { seed: 64053101, candidate: 1 },
          field_stone: { seed: 64053201, candidate: 1 },
        },
      );
      assert.doesNotThrow(() => verifyWorldAssets(test.root, test.phase4bRoot));
      for (const [key, bytes] of originals) {
        assert.deepEqual(readFileSync(path.join(test.root, "public", "assets", "buildings", `${key}.png`)), bytes);
      }
      assert.equal(readPng(path.join(test.root, "public", "assets", "terrain", "grass.png")).dimensions.width, 512);
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("prepares Phase 13 full-colour releases from raw candidate one for every building key", () => {
    // Given: Phase 13 raw candidate-one files exist for all release buildings and terrains.
    const test = fixture();
    try {
      writePhase13RawCandidates(test);

      // When: the explicit Phase 13 preparation mode builds the release.
      const manifest = prepareWorldAssets({
        repoRoot: test.root,
        rawRoot: test.rawRoot,
        phase4bRoot: test.phase4bRoot,
        selections,
        stoneTownSelections,
        mode: "phase13-full-colour",
      });

      // Then: every building is sourced from Phase 13 raw truth rather than Phase 4B promotion copies.
      assert.deepEqual(manifest.assets.map((asset) => asset.key), [...WORLD_ASSET_KEYS]);
      assert.deepEqual(
        Object.fromEntries(
          manifest.assets
            .filter((asset) => asset.category === "building")
            .map((asset) => [asset.key, asset.source]),
        ),
        Object.fromEntries(BUILDING_KEYS.map((key, index) => [key, { seed: 71300001 + index, candidate: 1 }])),
      );
      for (const key of ["house_l0", "mill", "barn"] as const) {
        assert.notDeepEqual(
          readFileSync(path.join(test.root, "public", "assets", "buildings", `${key}.png`)),
          readFileSync(path.join(test.phase4bRoot, key === "house_l0" ? "house_03.png" : key === "mill" ? "mill_02.png" : "granary_08.png")),
        );
      }
      assert.doesNotThrow(() => verifyWorldAssets(test.root, test.phase4bRoot, { mode: "phase13-full-colour" }));
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("rejects a Phase 13 building release with too few visible colours", () => {
    // Given: one Phase 13 building raw is a flat colour while the rest of the raw set is colour-rich.
    const test = fixture();
    try {
      writePhase13RawCandidates(test);
      writeRawSprite(path.join(test.rawRoot, "building", "house_l0_01.png"), 72, 62, RAMPS.plaster[2]);

      // When / Then: preparation fails at the release verifier colour-richness gate.
      assert.throws(
        () => prepareWorldAssets({
          repoRoot: test.root,
          rawRoot: test.rawRoot,
          phase4bRoot: test.phase4bRoot,
          selections,
          stoneTownSelections,
          mode: "phase13-full-colour",
        }),
        /house_l0.*visible colours/,
      );
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("normalizes exact-size foliage raw input instead of copying it directly", () => {
    // Given: an exact-size foliage raw PNG with unsupported alpha that would leak through a direct copy.
    const test = fixture();
    try {
      writePhase13RawCandidates(test);
      const rawShrub = image(FOLIAGE_SPECS.shrub_a.width, FOLIAGE_SPECS.shrub_a.height, [0, 255, 255, 255]);
      fill(rawShrub, 6, 3, FOLIAGE_SPECS.shrub_a.width - 6, FOLIAGE_SPECS.shrub_a.height - 4, [91, 133, 78, 200]);
      writePng(path.join(test.rawRoot, "foliage", "shrub_a_01.png"), rawShrub);

      // When: Phase 13 preparation processes foliage.
      prepareWorldAssets({
        repoRoot: test.root,
        rawRoot: test.rawRoot,
        phase4bRoot: test.phase4bRoot,
        selections,
        stoneTownSelections,
        mode: "phase13-full-colour",
      });
      const processed = readPng(path.join(test.root, "public", "assets", "foliage", "shrub_a.png"));
      const alphas = new Set<number>();
      for (let index = 3; index < processed.rgba.length; index += 4) alphas.add(processed.rgba[index] ?? 0);

      // Then: the final release has normalized alpha and a generated outline instead of alpha-200 copied bytes.
      assert.equal(alphas.has(200), false);
      assert.equal(alphas.has(179), true);
      assert.equal(alphas.has(255), true);
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("publishes only accepted Phase 13 keys while preserving every other public asset byte-for-byte", () => {
    // Given: an existing complete release and a Round 1 accepted subset with no accepted foliage.
    const test = fixture();
    try {
      prepareWorldAssets({ repoRoot: test.root, rawRoot: test.rawRoot, phase4bRoot: test.phase4bRoot, selections, stoneTownSelections });
      const beforeBytes = new Map(WORLD_ASSET_KEYS.map((key) => {
        const category = BUILDING_KEYS.some((candidate) => candidate === key)
          ? "buildings"
          : FOLIAGE_KEYS.some((candidate) => candidate === key)
            ? "foliage"
            : "terrain";
        return [key, readFileSync(path.join(test.root, "public", "assets", category, `${key}.png`))] as const;
      }));
      const beforeManifest = parseWorldAssetManifest(JSON.parse(readFileSync(path.join(test.root, "public", "assets", "world_asset_manifest.json"), "utf8")));
      writePhase13RawCandidates(test);
      rmSync(path.join(test.rawRoot, "foliage"), { recursive: true, force: true });
      const acceptedPath = writeAcceptedReleaseRecord(path.join(test.root, "phase13-accepted.json"));

      // When: the explicit partial accepted-release mode runs.
      const manifest = prepareWorldAssets({
        repoRoot: test.root,
        rawRoot: test.rawRoot,
        phase4bRoot: test.phase4bRoot,
        selections,
        stoneTownSelections,
        mode: "phase13-partial-accepted-release",
        acceptedRelease: readPhase13AcceptedRelease(acceptedPath),
      });

      // Then: only accepted keys change, every preserved key keeps its previous bytes and source truth.
      const acceptedKeys: ReadonlySet<string> = new Set(acceptedReleaseRecord.accepted.map((entry) => entry.key));
      for (const key of WORLD_ASSET_KEYS) {
        const category = BUILDING_KEYS.some((candidate) => candidate === key)
          ? "buildings"
          : FOLIAGE_KEYS.some((candidate) => candidate === key)
            ? "foliage"
            : "terrain";
        const current = readFileSync(path.join(test.root, "public", "assets", category, `${key}.png`));
        if (!acceptedKeys.has(key)) assert.deepEqual(current, beforeBytes.get(key));
      }
      assert.deepEqual(
        Object.fromEntries(manifest.assets.filter((asset) => acceptedKeys.has(asset.key)).map((asset) => [asset.key, asset.source])),
        {
          house_l1: { seed: 71300002, candidate: 1 },
          mill: { seed: 71300005, candidate: 1 },
          logging_camp: { seed: 71300010, candidate: 1 },
          church: { seed: 71300015, candidate: 1 },
          forest_floor: { seed: 71300032, candidate: 1 },
          rock: { seed: 71300034, candidate: 1 },
        },
      );
      for (const asset of manifest.assets.filter((asset) => !acceptedKeys.has(asset.key))) {
        assert.deepEqual(asset.source, beforeManifest.assets.find((before) => before.key === asset.key)?.source);
      }
      assert.doesNotThrow(() => verifyWorldAssets(test.root, test.phase4bRoot, {
        mode: "phase13-partial-accepted-release",
        acceptedRelease: readPhase13AcceptedRelease(acceptedPath),
      }));
      const evidence = JSON.parse(readFileSync(releaseFilePath(test.root), "utf8"));
      assert.equal(evidence.statuses.length, WORLD_ASSET_KEYS.length);
      assert.equal(evidence.statuses.filter((entry: { readonly status: string }) => entry.status === "accepted-generated").length, 6);
      assert.equal(evidence.statuses.find((entry: { readonly key: string }) => entry.key === "tree_oak_large")?.status, "preserved-existing");
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("rejects Phase 13 release evidence with duplicate, missing, or contract-drifted status entries", () => {
    // Given: a valid partial release whose evidence is then tampered at the contract boundary.
    const test = fixture();
    try {
      prepareWorldAssets({ repoRoot: test.root, rawRoot: test.rawRoot, phase4bRoot: test.phase4bRoot, selections, stoneTownSelections });
      const beforeManifest = parseWorldAssetManifest(JSON.parse(readFileSync(path.join(test.root, "public", "assets", "world_asset_manifest.json"), "utf8")));
      writePhase13RawCandidates(test);
      rmSync(path.join(test.rawRoot, "foliage"), { recursive: true, force: true });
      const acceptedPath = writeAcceptedReleaseRecord(path.join(test.root, "phase13-accepted.json"));
      const release = readPhase13AcceptedRelease(acceptedPath);
      prepareWorldAssets({
        repoRoot: test.root,
        rawRoot: test.rawRoot,
        phase4bRoot: test.phase4bRoot,
        selections,
        stoneTownSelections,
        mode: "phase13-partial-accepted-release",
        acceptedRelease: release,
      });
      const validEvidence = JSON.parse(readFileSync(releaseFilePath(test.root), "utf8"));

      // When / Then: duplicate and missing keys cannot hide behind the correct total status count.
      const duplicateEvidence = {
        ...validEvidence,
        statuses: validEvidence.statuses.map((entry: { readonly key: string }, index: number) =>
          index === validEvidence.statuses.length - 1 ? { ...entry, key: validEvidence.statuses[0].key } : entry
        ),
      };
      writeFileSync(releaseFilePath(test.root), `${JSON.stringify(duplicateEvidence, null, 2)}\n`);
      assert.throws(() => assertPhase13ReleaseEvidence(test.root, release), /duplicate.*house_l0/);

      const missingEvidence = {
        ...validEvidence,
        statuses: validEvidence.statuses.slice(1),
      };
      writeFileSync(releaseFilePath(test.root), `${JSON.stringify(missingEvidence, null, 2)}\n`);
      assert.throws(() => assertPhase13ReleaseEvidence(test.root, release), /every world asset key/);

      // When / Then: category, path, and accepted source are bound to the generated Phase 13 contract.
      const acceptedKey = "house_l1";
      const acceptedEntry = validEvidence.statuses.find((entry: { readonly key: string }) => entry.key === acceptedKey);
      const categoryDriftEvidence = {
        ...validEvidence,
        statuses: validEvidence.statuses.map((entry: { readonly key: string }) =>
          entry.key === acceptedKey
            ? {
                ...entry,
                category: "terrain",
              }
            : entry
        ),
      };
      const pathDriftEvidence = {
        ...validEvidence,
        statuses: validEvidence.statuses.map((entry: { readonly key: string }) =>
          entry.key === acceptedKey
            ? {
                ...entry,
                path: "public/assets/terrain/house_l1.png",
              }
            : entry
        ),
      };
      const acceptedSourceDriftEvidence = {
        ...validEvidence,
        statuses: validEvidence.statuses.map((entry: { readonly key: string }) =>
          entry.key === acceptedKey
            ? {
                ...entry,
                source: { seed: phase13SourceForWorldAsset(acceptedKey).seed + 1, candidate: 1 },
              }
            : entry
        ),
      };
      assert.equal(acceptedEntry.category, categoryForWorldAssetKey(acceptedKey));
      assert.equal(acceptedEntry.path, releasePathForWorldAsset(acceptedKey).split(path.sep).join("/"));
      writeFileSync(releaseFilePath(test.root), `${JSON.stringify(categoryDriftEvidence, null, 2)}\n`);
      assert.throws(() => assertPhase13ReleaseEvidence(test.root, release), /house_l1.*category/);
      writeFileSync(releaseFilePath(test.root), `${JSON.stringify(pathDriftEvidence, null, 2)}\n`);
      assert.throws(() => assertPhase13ReleaseEvidence(test.root, release), /house_l1.*path/);
      writeFileSync(releaseFilePath(test.root), `${JSON.stringify(acceptedSourceDriftEvidence, null, 2)}\n`);
      assert.throws(() => assertPhase13ReleaseEvidence(test.root, release), /house_l1.*source/);

      // When / Then: preserved sources stay tied to the public manifest that supplied the preserved bytes.
      const preservedKey = "tree_oak_large";
      const preservedSource = beforeManifest.assets.find((asset) => asset.key === preservedKey)?.source;
      const preservedDriftEvidence = {
        ...validEvidence,
        statuses: validEvidence.statuses.map((entry: { readonly key: string }) =>
          entry.key === preservedKey ? { ...entry, source: { seed: 1, candidate: 99 } } : entry
        ),
      };
      assert.deepEqual(validEvidence.statuses.find((entry: { readonly key: string }) => entry.key === preservedKey)?.source, preservedSource);
      writeFileSync(releaseFilePath(test.root), `${JSON.stringify(preservedDriftEvidence, null, 2)}\n`);
      assert.throws(() => assertPhase13ReleaseEvidence(test.root, release), /tree_oak_large.*source/);
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("rejects invalid Phase 13 accepted-release records at the typed boundary", () => {
    const test = fixture();
    try {
      const cases = [
        [{ version: 1, mode: "phase13-partial-accepted-release", accepted: [] }, /at least one accepted asset/],
        [{ version: 1, mode: "phase13-partial-accepted-release", accepted: [{ category: "building", key: "house_l1" }, { category: "building", key: "house_l1" }] }, /duplicate/],
        [{ version: 1, mode: "phase13-partial-accepted-release", accepted: [{ category: "building", key: "not_real" }] }, /unknown/],
        [{ version: 1, mode: "phase13-partial-accepted-release", accepted: [{ category: "terrain", key: "house_l1" }] }, /category mismatch/],
      ] as const;
      for (const [record, message] of cases) {
        const filePath = writeAcceptedReleaseRecord(path.join(test.root, "bad-phase13.json"), record);
        assert.throws(() => readPhase13AcceptedRelease(filePath), message);
      }
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("rejects attempts to accept a Phase 13 key whose raw candidate is missing", () => {
    const test = fixture();
    try {
      prepareWorldAssets({ repoRoot: test.root, rawRoot: test.rawRoot, phase4bRoot: test.phase4bRoot, selections, stoneTownSelections });
      writePhase13RawCandidates(test);
      unlinkSync(path.join(test.rawRoot, "terrain", "rock.png"));
      const acceptedPath = writeAcceptedReleaseRecord(path.join(test.root, "phase13-accepted.json"));

      assert.throws(
        () => prepareWorldAssets({
          repoRoot: test.root,
          rawRoot: test.rawRoot,
          phase4bRoot: test.phase4bRoot,
          selections,
          stoneTownSelections,
          mode: "phase13-partial-accepted-release",
          acceptedRelease: readPhase13AcceptedRelease(acceptedPath),
        }),
        /missing raw.*rock/,
      );
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("rejects an unexpected top-level PNG without treating historical candidate folders as release files", () => {
    // Given: a complete prepared release plus a preserved nested Phase 4B candidate and one stray release PNG.
    const test = fixture();
    try {
      prepareWorldAssets({ repoRoot: test.root, rawRoot: test.rawRoot, phase4bRoot: test.phase4bRoot, selections, stoneTownSelections });
      const historical = path.join(test.root, "public", "assets", "buildings", "candidates_v2");
      mkdirSync(historical, { recursive: true });
      writePromoted(path.join(historical, "house_01.png"), 96, 112, 78, 20);
      writePromoted(path.join(test.root, "public", "assets", "buildings", "unexpected.png"), 96, 112, 78, 20);

      // When / Then: exact top-level release membership rejects only the stray release file.
      assert.throws(() => verifyWorldAssets(test.root, test.phase4bRoot), /unexpected PNG.*unexpected\.png/);
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("rejects an incomplete release even though runtime foliage fallbacks are visible", () => {
    // Given: a complete prepared release with one required stump PNG removed.
    const test = fixture();
    try {
      prepareWorldAssets({ repoRoot: test.root, rawRoot: test.rawRoot, phase4bRoot: test.phase4bRoot, selections, stoneTownSelections });
      unlinkSync(path.join(test.root, "public", "assets", "foliage", "stump_old.png"));

      // When / Then: the strict verifier still requires every manifest sprite file.
      assert.throws(() => verifyWorldAssets(test.root, test.phase4bRoot), /missing .*stump_old\.png/);
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("rejects a category-invalid asset even when its filename and dimensions are correct", () => {
    // Given: a complete release whose terrain alpha contract has been corrupted.
    const test = fixture();
    try {
      prepareWorldAssets({ repoRoot: test.root, rawRoot: test.rawRoot, phase4bRoot: test.phase4bRoot, selections, stoneTownSelections });
      const terrainPath = path.join(test.root, "public", "assets", "terrain", "water.png");
      const terrain = readPng(terrainPath);
      terrain.rgba[3] = 0;
      writePng(terrainPath, terrain);
      const manifestPath = path.join(test.root, "public", "assets", "world_asset_manifest.json");
      const manifest = parseWorldAssetManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
      const updatedManifest = {
        ...manifest,
        assets: manifest.assets.map((asset) =>
          asset.key === "water" ? { ...asset, sha256: fileSha256(terrainPath) } : asset
        ),
      };
      writeFileSync(manifestPath, `${JSON.stringify(updatedManifest, null, 2)}\n`);

      // When / Then: the terrain validator rejects non-opaque release pixels.
      assert.throws(() => verifyWorldAssets(test.root, test.phase4bRoot), /water.*opaque/);
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });

  it("rejects a release when the generated runtime manifest is stale", () => {
    // Given: a complete release whose runtime manifest was manually drifted after preparation.
    const test = fixture();
    try {
      prepareWorldAssets({ repoRoot: test.root, rawRoot: test.rawRoot, phase4bRoot: test.phase4bRoot, selections, stoneTownSelections });
      const runtimePath = path.join(test.root, "src", "render", "worldAssetManifest.generated.ts");
      mkdirSync(path.dirname(runtimePath), { recursive: true });
      writeFileSync(runtimePath, "export const runtimeWorldAssetManifest = { \"assets\": [] } as const;\n");

      // When / Then: verification catches the runtime/public manifest mismatch.
      assert.throws(() => verifyWorldAssets(test.root, test.phase4bRoot), /runtime manifest/);
    } finally {
      rmSync(test.root, { recursive: true, force: true });
    }
  });
});
