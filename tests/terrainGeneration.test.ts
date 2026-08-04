import assert from "node:assert/strict";
import test from "node:test";

import type { TerrainType } from "../src/content/terrainConfig";
import type { Grid } from "../src/world/grid";
import { getTile } from "../src/world/grid";
import {
  buildWorldGrid,
  cleanupTerrainRegions,
  generateTerrainTile,
} from "../src/world/terrain";

const ORTHOGONAL_OFFSETS = [
  { tx: 0, ty: -1 },
  { tx: 1, ty: 0 },
  { tx: 0, ty: 1 },
  { tx: -1, ty: 0 },
] as const;

function componentSizes(grid: Grid, terrain: TerrainType): number[] {
  const visited = new Set<number>();
  const sizes: number[] = [];

  for (let startIndex = 0; startIndex < grid.tiles.length; startIndex += 1) {
    const start = grid.tiles[startIndex];
    if (!start || start.terrain !== terrain || visited.has(startIndex)) continue;

    let size = 0;
    const queue = [startIndex];
    visited.add(startIndex);

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const index = queue[queueIndex];
      if (index === undefined) continue;
      const tile = grid.tiles[index];
      if (!tile) continue;
      size += 1;

      for (const offset of ORTHOGONAL_OFFSETS) {
        const tx = tile.tx + offset.tx;
        const ty = tile.ty + offset.ty;
        if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) continue;
        const neighbourIndex = ty * grid.width + tx;
        const neighbour = grid.tiles[neighbourIndex];
        if (
          neighbour?.terrain === terrain &&
          !visited.has(neighbourIndex)
        ) {
          visited.add(neighbourIndex);
          queue.push(neighbourIndex);
        }
      }
    }

    sizes.push(size);
  }

  return sizes.sort((left, right) => right - left);
}

test("seeded world generation is reproducible and different seeds diverge", () => {
  const first = buildWorldGrid({ width: 64, height: 64, seed: 73 });
  const repeated = buildWorldGrid({ width: 64, height: 64, seed: 73 });
  const otherSeed = buildWorldGrid({ width: 64, height: 64, seed: 74 });

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(
    first.tiles.map((tile) => tile.terrain),
    otherSeed.tiles.map((tile) => tile.terrain),
  );
});

test("raw terrain classification is deterministic and seed-aware", () => {
  const coordinates = Array.from({ length: 64 }, (_, index) => ({
    tx: index % 8,
    ty: Math.floor(index / 8),
  }));
  const first = coordinates.map(({ tx, ty }) => generateTerrainTile(tx, ty, 11));
  const repeated = coordinates.map(({ tx, ty }) => generateTerrainTile(tx, ty, 11));
  const otherSeed = coordinates.map(({ tx, ty }) => generateTerrainTile(tx, ty, 12));

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, otherSeed);
});

test("cleanupTerrainRegions replaces deliberately undersized material islands", () => {
  const width = 8;
  const height = 8;
  const terrains = Array<TerrainType>(width * height).fill("grass");
  const at = (tx: number, ty: number) => ty * width + tx;

  terrains[at(1, 1)] = "water";
  terrains[at(4, 1)] = "forest";
  terrains[at(5, 1)] = "forest";
  terrains[at(1, 5)] = "rock";
  terrains[at(2, 5)] = "rock";
  terrains[at(3, 5)] = "rock";

  const cleaned = cleanupTerrainRegions(terrains, width, height);

  assert.ok(cleaned.every((terrain) => terrain === "grass"));
  assert.notStrictEqual(cleaned, terrains);
  assert.equal(terrains[at(1, 1)], "water");
});

test("terrain cleanup removes undersized water, forest, and rock regions", () => {
  for (const seed of [1, 7, 73, 901]) {
    const grid = buildWorldGrid({ width: 64, height: 64, seed });

    for (const size of componentSizes(grid, "water")) {
      assert.ok(size >= 6, `seed ${seed} retained a ${size}-tile water region`);
    }
    for (const terrain of ["forest", "rock"] as const) {
      for (const size of componentSizes(grid, terrain)) {
        assert.ok(
          size >= 4,
          `seed ${seed} retained a ${size}-tile ${terrain} region`,
        );
      }
    }
  }
});

test("terrain cleanup fills grass cells enclosed by orthogonal water", () => {
  for (const seed of [1, 7, 73, 901]) {
    const grid = buildWorldGrid({ width: 64, height: 64, seed });

    for (const tile of grid.tiles) {
      if (
        tile.terrain !== "grass" ||
        tile.tx === 0 ||
        tile.ty === 0 ||
        tile.tx === grid.width - 1 ||
        tile.ty === grid.height - 1
      ) {
        continue;
      }

      const neighbours = ORTHOGONAL_OFFSETS.map((offset) =>
        getTile(grid, { tx: tile.tx + offset.tx, ty: tile.ty + offset.ty }),
      );
      assert.equal(
        neighbours.every((neighbour) => neighbour?.terrain === "water"),
        false,
        `seed ${seed} retained enclosed grass at ${tile.tx},${tile.ty}`,
      );
    }
  }
});

test("representative 64x64 seeds contain readable proportions and major regions", () => {
  for (const seed of [1, 73]) {
    const grid = buildWorldGrid({ width: 64, height: 64, seed });
    const counts = new Map<TerrainType, number>();

    for (const tile of grid.tiles) {
      counts.set(tile.terrain, (counts.get(tile.terrain) ?? 0) + 1);
    }

    const ratio = (terrain: TerrainType) =>
      (counts.get(terrain) ?? 0) / grid.tiles.length;

    assert.ok(ratio("water") >= 0.08 && ratio("water") <= 0.35);
    assert.ok(ratio("forest") >= 0.08 && ratio("forest") <= 0.45);
    assert.ok(ratio("rock") >= 0.02 && ratio("rock") <= 0.2);
    assert.ok(ratio("grass") >= 0.2 && ratio("grass") <= 0.75);

    assert.ok((componentSizes(grid, "water")[0] ?? 0) >= 80);
    assert.ok((componentSizes(grid, "forest")[0] ?? 0) >= 80);
    assert.ok((componentSizes(grid, "rock")[0] ?? 0) >= 20);
  }
});
