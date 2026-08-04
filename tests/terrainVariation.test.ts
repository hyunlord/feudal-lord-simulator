import assert from "node:assert/strict";
import test from "node:test";

import { terrainVariation } from "../src/world/terrain";

test("terrain variation is deterministic, seed-aware, and limited to five percent", () => {
  const first = Array.from({ length: 64 * 64 }, (_, index) =>
    terrainVariation(index % 64, Math.floor(index / 64), 73),
  );
  const repeated = Array.from({ length: 64 * 64 }, (_, index) =>
    terrainVariation(index % 64, Math.floor(index / 64), 73),
  );
  const otherSeed = Array.from({ length: 64 * 64 }, (_, index) =>
    terrainVariation(index % 64, Math.floor(index / 64), 74),
  );

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, otherSeed);
  assert.ok(first.every((variation) => variation >= -0.05 && variation <= 0.05));
  assert.ok(Math.min(...first) < -0.02);
  assert.ok(Math.max(...first) > 0.02);
});

test("orthogonally adjacent terrain variation differs by at most a few percent", () => {
  for (const seed of [1, 73, 901]) {
    let maximumDifference = 0;

    for (let ty = 0; ty < 64; ty += 1) {
      for (let tx = 0; tx < 64; tx += 1) {
        const value = terrainVariation(tx, ty, seed);
        if (tx + 1 < 64) {
          maximumDifference = Math.max(
            maximumDifference,
            Math.abs(value - terrainVariation(tx + 1, ty, seed)),
          );
        }
        if (ty + 1 < 64) {
          maximumDifference = Math.max(
            maximumDifference,
            Math.abs(value - terrainVariation(tx, ty + 1, seed)),
          );
        }
      }
    }

    assert.ok(
      maximumDifference <= 0.025,
      `seed ${seed} adjacent variation reached ${maximumDifference}`,
    );
  }
});
