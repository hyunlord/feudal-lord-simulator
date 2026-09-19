import assert from "node:assert/strict";
import test from "node:test";
import { houseFrontage } from "../src/render/houseFrontage";
import { getTile, type Grid } from "../src/world/grid";
import type { Tile } from "../src/world/world.types";

const home: Tile = { tx: 1, ty: 1, terrain: "grass", buildingId: "house", hasRoad: false };
function gridWithRoad(tx: number, ty: number, changes: Partial<Tile> = {}): Grid {
  return { width: 3, height: 3, tiles: Array.from({ length: 9 }, (_, index) => {
    const x = index % 3;
    const y = Math.floor(index / 3);
    return x === 1 && y === 1 ? home : {
      tx: x, ty: y, terrain: "grass", buildingId: null,
      hasRoad: x === tx && y === ty,
      ...(x === tx && y === ty ? changes : {}),
    };
  }) };
}

test("frontage stays inside its house and one adjacent road for all four sides", () => {
  for (const [tx, ty] of [[1, 2], [2, 1], [0, 1], [1, 0]]) {
    assert.ok(tx !== undefined && ty !== undefined);
    const grid = gridWithRoad(tx, ty);
    const before = JSON.stringify(grid);
    const frontage = houseFrontage(grid, home, 1);
    assert.ok(frontage);
    assert.deepEqual(frontage.road, { tx, ty });
    for (const point of frontage.pad) {
      assert.ok(Math.abs(point.tx - 1) <= 0.42 && Math.abs(point.ty - 1) <= 0.42);
    }
    for (const point of frontage.path) {
      const tile = getTile(grid, { tx: Math.round(point.tx), ty: Math.round(point.ty) });
      assert.ok(tile && (tile.buildingId === "house" || tile.hasRoad));
    }
    assert.equal(JSON.stringify(grid), before);
    assert.deepEqual(houseFrontage(grid, home, 1), frontage);
  }
});

test("diagonal roads, occupied neighbors and impassable terrain do not get visual paths", () => {
  for (const grid of [gridWithRoad(2, 2), gridWithRoad(1, 2, { buildingId: "other" }),
    gridWithRoad(1, 2, { terrain: "water" }), gridWithRoad(1, 2, { terrain: "rock" })]) {
    const frontage = houseFrontage(grid, home, 1);
    assert.ok(frontage);
    assert.equal(frontage.road, null);
    assert.deepEqual(frontage.path, []);
  }
});

test("road removal and house demolition do not leave cached frontage", () => {
  const grid = gridWithRoad(1, 2);
  assert.ok(houseFrontage(grid, home, 1)?.path.length);
  assert.deepEqual(houseFrontage(gridWithRoad(1, 2, { hasRoad: false }), home, 1)?.path, []);
  assert.equal(houseFrontage(grid, { ...home, buildingId: null }, 1), null);
});

test("seeded wear favors the connected road and stays bounded across variations", () => {
  const grid = gridWithRoad(1, 2);
  for (let seed = 0; seed < 80; seed += 1) {
    const frontage = houseFrontage(grid, home, seed);
    assert.ok(frontage);
    const forwardMean = frontage.pad.reduce((sum, point) => sum + point.ty - home.ty, 0) / frontage.pad.length;
    assert.ok(forwardMean > 0.05);
    for (const point of [...frontage.pad, ...frontage.path]) {
      const owner = getTile(grid, { tx: Math.round(point.tx), ty: Math.round(point.ty) });
      assert.ok(owner && (owner.buildingId === "house" || (owner.tx === 1 && owner.ty === 2)));
    }
  }
  assert.notDeepEqual(houseFrontage(grid, home, 0)?.pad, houseFrontage(grid, home, 1)?.pad);
});
