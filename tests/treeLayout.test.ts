import assert from "node:assert/strict";
import test from "node:test";

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

test("forest interiors draw denser tree clusters than exposed forest edges", () => {
  const interior = tile(1, 1);
  const exposedEdge = tile(8, 8);
  const fullForestLookup = buildForestLookup(fullForest);
  const exposedLookup = buildForestLookup([exposedEdge]);

  assert.equal(forestTreeCount(exposedEdge, exposedLookup, 73), 1);
  assert.ok(forestTreeCount(interior, fullForestLookup, 73) > forestTreeCount(exposedEdge, exposedLookup, 73));
  assert.ok(forestTreeCount(interior, fullForestLookup, 73) <= 3);
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

  assert.deepEqual(repeat, first);
  assert.notDeepEqual(otherSeed, first);
});

test("tree descriptors vary safely inside the isometric tile footprint", () => {
  const descriptors = buildTreeCluster({ tile: tile(1, 1), forestLookup: buildForestLookup(fullForest), seed: 2 });
  const silhouettes = new Set(descriptors.map((descriptor) => descriptor.silhouette));

  assert.ok(descriptors.length >= 2 && descriptors.length <= 3);
  assert.equal(descriptors.length, 3);
  assert.ok(silhouettes.size >= 2);
  for (const descriptor of descriptors) {
    assert.ok(Math.abs(descriptor.offsetX) <= TILE_W * 0.35);
    assert.ok(Math.abs(descriptor.offsetY) <= TILE_H * 0.35);
    assert.ok(Math.abs(descriptor.offsetX) / (TILE_W / 2) + Math.abs(descriptor.offsetY) / (TILE_H / 2) <= 0.7);
    assert.ok(descriptor.scale >= 0.75);
    assert.ok(descriptor.scale <= 1.25);
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

test("multi-tree canopy tones alternate between forest and sage dark", () => {
  const descriptors = buildTreeCluster({ tile: tile(1, 1), forestLookup: buildForestLookup(fullForest), seed: 73 });
  const tones = new Set(descriptors.map((descriptor) => descriptor.tone));

  assert.equal(descriptors.length, 3);
  assert.deepEqual(tones, new Set(["forest", "sageDark"]));
  for (let index = 1; index < descriptors.length; index += 1) {
    assert.notEqual(descriptors[index]?.tone, descriptors[index - 1]?.tone);
  }
});

test("tree and shrub sprite variants are assigned from separate deterministic slots", () => {
  const descriptors = [
    ...buildTreeCluster({ tile: tile(0, 0), forestLookup: buildForestLookup([tile(0, 0)]), seed: 1 }),
    ...buildTreeCluster({ tile: tile(1, 1), forestLookup: buildForestLookup(fullForest), seed: 73 }),
    ...buildTreeCluster({ tile: tile(4, 4), forestLookup: buildForestLookup([tile(4, 4)]), seed: 74 }),
    ...buildTreeCluster({ tile: tile(5, 4), forestLookup: buildForestLookup([tile(5, 4)]), seed: 75 }),
  ];
  const groundCover = Array.from({ length: 4_096 }, (_, index) =>
    buildGroundCover({ tile: tile(index % 64, Math.floor(index / 64), "grass"), seed: 73 }),
  ).flat();

  assert.ok(descriptors.length > 0);
  assert.ok(groundCover.length > 0);
  assert.deepEqual(
    new Set(descriptors.map((descriptor) => descriptor.spriteKey)),
    new Set(["tree_conifer_a", "tree_conifer_b", "tree_broadleaf_a", "tree_broadleaf_b"]),
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

test("ground cover never occupies forest water roads or building tiles", () => {
  // Given
  const forest = tile(19, 7, "forest");
  const water = tile(19, 7, "water");
  const road = { ...tile(19, 7, "grass"), hasRoad: true };
  const occupied = { ...tile(19, 7, "grass"), buildingId: "house-1" };

  // When / Then
  for (const blocked of [forest, water, road, occupied]) {
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

  // Then
  assert.deepEqual(repeat, first);
});

test("tree sprite family follows the selected silhouette", () => {
  // Given
  const descriptors = buildTreeCluster({ tile: tile(1, 1), forestLookup: buildForestLookup(fullForest), seed: 2 });

  // When / Then
  for (const descriptor of descriptors) {
    if (descriptor.silhouette === "narrow") {
      assert.match(descriptor.spriteKey, /^tree_conifer_[ab]$/);
    } else {
      assert.match(descriptor.spriteKey, /^tree_broadleaf_[ab]$/);
    }
  }
});
