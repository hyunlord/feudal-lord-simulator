import assert from "node:assert/strict";
import test from "node:test";

import { TILE_H, TILE_W } from "../src/render/iso";
import {
  buildForestLookup,
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
