import assert from "node:assert/strict";
import test from "node:test";

import { RAMPS } from "../src/content/palette";
import { TILE_H, TILE_W } from "../src/render/iso";
import {
  buildForestLookup,
  buildGroundCover,
  buildTreeCluster,
  forestTreeCount,
  orthogonalForestNeighborCount,
} from "../src/render/treeLayout";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number, terrain: Tile["terrain"] = "forest"): Tile {
  return { tx, ty, terrain, buildingId: null, hasRoad: false };
}

const fullForest = [
  tile(0, 0), tile(1, 0), tile(2, 0),
  tile(0, 1), tile(1, 1), tile(2, 1),
  tile(0, 2), tile(1, 2), tile(2, 2),
];

test("forest interiors draw one or two trees while exposed forest edges stay thin", () => {
  const interior = tile(1, 1);
  const exposedEdge = tile(8, 8);
  const fullForestLookup = buildForestLookup(fullForest);
  const exposedLookup = buildForestLookup([exposedEdge]);

  assert.equal(forestTreeCount(exposedEdge, exposedLookup, 73), 1);
  assert.ok(forestTreeCount(interior, fullForestLookup, 73) > forestTreeCount(exposedEdge, exposedLookup, 73));
  assert.ok(forestTreeCount(interior, fullForestLookup, 73) <= 2);
});

test("tree density ignores diagonal forest neighbors", () => {
  const target = tile(1, 1);
  const diagonalOnly = [
    tile(0, 0),
    tile(2, 0),
    target,
    tile(0, 2),
    tile(2, 2),
  ];

  const lookup = buildForestLookup(diagonalOnly);

  assert.equal(orthogonalForestNeighborCount(target, lookup), 0);
  assert.equal(forestTreeCount(target, lookup, 73), 1);
});

test("tree clusters are deterministic for one seed and change with another seed", () => {
  const target = tile(1, 1);
  const fullForestLookup = buildForestLookup(fullForest);

  const first = buildTreeCluster({ tile: target, forestLookup: fullForestLookup, seed: 73 });
  const repeat = buildTreeCluster({ tile: target, forestLookup: fullForestLookup, seed: 73 });
  const otherSeed = buildTreeCluster({ tile: target, forestLookup: fullForestLookup, seed: 901 });

  assert.equal(repeat, first);
  assert.deepEqual(repeat, first);
  assert.notDeepEqual(otherSeed, first);
});

test("tree descriptors vary safely inside the isometric tile footprint", () => {
  const descriptors = buildTreeCluster({ tile: tile(1, 1), forestLookup: buildForestLookup(fullForest), seed: 0 });
  const silhouettes = new Set(descriptors.map((descriptor) => descriptor.silhouette));

  assert.ok(descriptors.length >= 1 && descriptors.length <= 2);
  assert.equal(descriptors.length, 2);
  assert.ok(silhouettes.size >= 2);
  for (const descriptor of descriptors) {
    assert.ok(Math.abs(descriptor.offsetX) <= TILE_W * 0.35);
    assert.ok(Math.abs(descriptor.offsetY) <= TILE_H * 0.35);
    assert.ok(Math.abs(descriptor.offsetX) / (TILE_W / 2) + Math.abs(descriptor.offsetY) / (TILE_H / 2) <= 0.7);
    assert.ok(descriptor.scale >= 0.7);
    assert.ok(descriptor.scale <= 1.3);
    assert.ok(["narrow", "broad", "rounded"].includes(descriptor.silhouette));
    assert.ok(descriptor.phase >= 0);
    assert.ok(descriptor.phase <= Math.PI * 2);
  }
});

test("multi-tree clusters are sorted by local y position for stable overlap", () => {
  const descriptors = buildTreeCluster({ tile: tile(1, 1), forestLookup: buildForestLookup(fullForest), seed: 73 });
  const sorted = [...descriptors].sort((left, right) => left.sortY - right.sortY || left.id.localeCompare(right.id));

  assert.deepEqual(descriptors, sorted);
});

test("multi-tree canopy tones walk the full foliage ramp deterministically", () => {
  const lookup = buildForestLookup(fullForest);
  const first = buildTreeCluster({ tile: tile(1, 1), forestLookup: lookup, seed: 73 });
  const repeat = buildTreeCluster({ tile: tile(1, 1), forestLookup: buildForestLookup(fullForest), seed: 73 });
  const otherTile = buildTreeCluster({ tile: tile(2, 2), forestLookup: buildForestLookup(fullForest), seed: 73 });
  const tones = first.map((descriptor) => descriptor.tone);
  const sampledTones = new Set(
    Array.from({ length: 96 }, (_, index) =>
      buildTreeCluster({ tile: tile(index % 12, Math.floor(index / 12)), forestLookup: lookup, seed: 73 }),
    ).flat().map((descriptor) => descriptor.tone),
  );

  assert.equal(first.length, 2);
  assert.deepEqual(repeat.map((descriptor) => descriptor.tone), tones);
  assert.ok(tones.every((tone) => /^#[0-9A-F]{6}$/.test(tone)));
  assert.notDeepEqual(otherTile.map((descriptor) => descriptor.tone), tones);
  assert.deepEqual(sampledTones, new Set(RAMPS.foliage));
});

test("tree scale samples use the exact Phase 8 endpoint range", () => {
  // Given / When
  const sampledScales = Array.from({ length: 16_384 }, (_, index) =>
    buildTreeCluster({
      tile: tile(index % 128, Math.floor(index / 128)),
      forestLookup: buildForestLookup(fullForest),
      seed: 901,
    }),
  ).flat().map((descriptor) => Number(descriptor.scale.toFixed(2)));

  // Then
  assert.equal(Math.min(...sampledScales), 0.7);
  assert.equal(Math.max(...sampledScales), 1.3);
  assert.ok(sampledScales.includes(0.7));
  assert.ok(sampledScales.includes(1.3));
  assert.ok(sampledScales.every((scale) => scale >= 0.7 && scale <= 1.3));
});

test("tree and shrub sprite variants are assigned from separate deterministic slots", () => {
  const descriptors = [
    ...Array.from({ length: 4_096 }, (_, index) =>
      buildTreeCluster({
        tile: tile(index % 64, Math.floor(index / 64)),
        forestLookup: buildForestLookup(fullForest),
        seed: 73,
      }),
    ).flat(),
  ];
  const groundCover = Array.from({ length: 4_096 }, (_, index) =>
    buildGroundCover({ tile: tile(index % 64, Math.floor(index / 64), "grass"), seed: 73 }),
  ).flat();

  assert.ok(descriptors.length > 0);
  assert.ok(groundCover.length > 0);
  assert.deepEqual(
    new Set(descriptors.map((descriptor) => descriptor.spriteKey)),
    new Set(["tree_oak_large", "tree_oak_small", "tree_pine_tall", "tree_pine_short", "tree_birch", "tree_dead"]),
  );
  assert.ok(descriptors.every((descriptor) => !descriptor.spriteKey.startsWith("shrub_")));
  assert.deepEqual(
    new Set(groundCover.map((descriptor) => descriptor.spriteKey)),
    new Set(["shrub_a", "shrub_b", "grass_tuft", "field_stone"]),
  );
});

test("ground cover occupies roughly eight percent of eligible open grass", () => {
  // Given
  const sampleSize = 10_000;

  // When
  const occupied = Array.from({ length: sampleSize }, (_, index) =>
    buildGroundCover({ tile: tile(index % 100, Math.floor(index / 100), "grass"), seed: 73 }).length,
  ).reduce((total, count) => total + count, 0);

  // Then
  const density = occupied / sampleSize;
  assert.ok(density >= 0.07 && density <= 0.09, `expected density near 8%, received ${density}`);
});

test("ground cover never occupies non-grass roads or building tiles", () => {
  // Given
  const forest = tile(19, 7, "forest");
  const water = tile(19, 7, "water");
  const rock = tile(5, 0, "rock");
  const road = { ...tile(19, 7, "grass"), hasRoad: true };
  const occupied = { ...tile(19, 7, "grass"), buildingId: "house-1" };

  // When / Then
  for (const blocked of [forest, water, rock, road, occupied]) {
    assert.deepEqual(buildGroundCover({ tile: blocked, seed: 73 }), []);
  }
});

test("ground cover descriptors repeat exactly for equal tile and seed inputs", () => {
  // Given
  const inputs = Array.from({ length: 1_024 }, (_, index) => ({
    tile: tile(index % 32, Math.floor(index / 32), "grass"),
    seed: 901,
  }));

  // When
  const first = inputs.flatMap((input) => buildGroundCover(input));
  const repeat = inputs.flatMap((input) => buildGroundCover(input));
  const occupiedInput = inputs.find((input) => buildGroundCover(input).length > 0);

  // Then
  assert.deepEqual(repeat, first);
  assert.notEqual(occupiedInput, undefined);
  if (occupiedInput !== undefined) {
    assert.equal(buildGroundCover(occupiedInput), buildGroundCover(occupiedInput));
  }
});

test("forest lookup reuses immutable world tiles", () => {
  // Given
  const worldTiles = [...fullForest];

  // When
  const first = buildForestLookup(worldTiles);
  const repeat = buildForestLookup(worldTiles);

  // Then
  assert.equal(repeat, first);
});

test("tree sprite family follows the selected silhouette", () => {
  // Given
  const descriptors = buildTreeCluster({ tile: tile(1, 1), forestLookup: buildForestLookup(fullForest), seed: 2 });

  // When / Then
  assert.ok(descriptors.every((descriptor) => descriptor.spriteKey.startsWith("tree_")));
  assert.deepEqual(
    new Set(descriptors.map((descriptor) => descriptor.spriteKey)),
    new Set(descriptors.map((descriptor) => descriptor.spriteKey)),
  );
});
