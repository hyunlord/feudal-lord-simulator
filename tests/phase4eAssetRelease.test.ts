import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  addPhase4eSawmillCues,
  Phase4eAssetPreparationError,
  assertUntouchedAssetHashes,
  snapshotUntouchedAssetHashes,
  sourceForPhase4eTarget,
} from "../scripts/preparePhase4eAssets";
import type { RgbaImage } from "../scripts/processBuildingSprite";

const fixture = (): string => {
  const root = mkdtempSync(path.join(tmpdir(), "phase4e-target-release-"));
  for (const category of ["buildings", "foliage", "terrain"] as const) {
    mkdirSync(path.join(root, "public", "assets", category), { recursive: true });
  }
  writeFileSync(path.join(root, "public/assets/buildings/storehouse.png"), "storehouse-stable");
  writeFileSync(path.join(root, "public/assets/buildings/sawmill.png"), "sawmill-target");
  writeFileSync(path.join(root, "public/assets/foliage/tree_conifer_a.png"), "tree-stable");
  writeFileSync(path.join(root, "public/assets/foliage/shrub_a.png"), "shrub-target");
  writeFileSync(path.join(root, "public/assets/terrain/grass.png"), "grass-stable");
  return root;
};

describe("Phase 4E target-only asset release", () => {
  it("adds a literal blade, plank stack, and sawdust without mutating the processed candidate", () => {
    const candidate: RgbaImage = {
      dimensions: { width: 112, height: 112 },
      rgba: new Uint8Array(112 * 112 * 4),
    };

    const released = addPhase4eSawmillCues(candidate);
    const pixel = (x: number, y: number): readonly number[] =>
      [...released.rgba.slice((y * 112 + x) * 4, (y * 112 + x) * 4 + 4)];

    assert.notEqual(released.rgba, candidate.rgba);
    assert.deepEqual(pixel(55, 24), [162, 173, 185, 255]);
    assert.deepEqual(pixel(57, 52), [42, 33, 24, 255]);
    assert.deepEqual(pixel(78, 80), [149, 121, 90, 255]);
    assert.deepEqual(pixel(64, 94), [180, 149, 115, 255]);
    assert.deepEqual([...candidate.rgba.slice((24 * 112 + 55) * 4, (24 * 112 + 55) * 4 + 4)], [0, 0, 0, 0]);
  });

  it("maps every selection back to its deterministic generator seed", () => {
    assert.deepEqual(sourceForPhase4eTarget("sawmill", 4), { seed: 64050804, candidate: 4 });
    assert.deepEqual(sourceForPhase4eTarget("shrub_a", 3), { seed: 64052503, candidate: 3 });
    assert.deepEqual(sourceForPhase4eTarget("shrub_b", 2), { seed: 64052602, candidate: 2 });
    assert.deepEqual(sourceForPhase4eTarget("grass_tuft", 1), { seed: 64052701, candidate: 1 });
    assert.deepEqual(sourceForPhase4eTarget("field_stone", 4), { seed: 64052804, candidate: 4 });
    assert.throws(() => sourceForPhase4eTarget("shrub_a", 5), Phase4eAssetPreparationError);
  });

  it("ignores five approved targets but rejects any non-target byte drift", () => {
    const root = fixture();
    try {
      const before = snapshotUntouchedAssetHashes(root);
      writeFileSync(path.join(root, "public/assets/buildings/sawmill.png"), "new-sawmill");
      writeFileSync(path.join(root, "public/assets/foliage/shrub_a.png"), "new-shrub");
      assert.doesNotThrow(() => assertUntouchedAssetHashes(root, before));
      writeFileSync(path.join(root, "public/assets/buildings/storehouse.png"), "changed-storehouse");
      assert.throws(() => assertUntouchedAssetHashes(root, before), /storehouse\.png/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
