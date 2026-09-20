import assert from "node:assert/strict";
import test from "node:test";
import { existingRoadComponent, labelRoadComponents } from "../src/world/roadGraph";
import { marketRoadService } from "../src/engine/marketService";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import type { WallGrid } from "../src/world/wallTraversal";
import type { Building } from "../src/content/buildingConfig";

function randomGrid(seed: number): WallGrid {
  let value = seed;
  const next = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  return {
    width: 12, height: 10,
    tiles: Array.from({ length: 120 }, (_, index) => ({ tx: index % 12, ty: Math.floor(index / 12), terrain: next() < 0.12 ? "water" as const : "grass" as const, hasRoad: next() < 0.7, buildingId: null })),
    palisade: { gate: { x: 6, y: seed % 10 }, segments: [{ completed: seed % 3 !== 0, edgePath: seed % 2 === 0 ? [{ x: 6, y: 0 }, { x: 6, y: 10 }] : [{ x: 0, y: 0 }, { x: 10, y: 10 }] }] },
  };
}
function home(id: string, tx: number, ty: number): Building {
  return { id, kind: "house", tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

test("200 seeded road cities have exactly the legacy BFS component membership", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const grid = randomGrid(seed);
    const labels = labelRoadComponents(grid);
    for (const tile of grid.tiles) {
      const expected = existingRoadComponent(grid, [tile]).map(point => `${point.tx},${point.ty}`).sort();
      const label = labels.get(`${tile.tx},${tile.ty}`);
      const actual = label === undefined ? [] : [...labels].filter(([, component]) => component === label).map(([key]) => key).sort();
      assert.deepEqual(actual, expected, `seed ${seed}, tile ${tile.tx},${tile.ty}`);
    }
    const service = marketRoadService(grid);
    const homes = [home("a", 2, 2), { ...home("b", 6, 5), houseLot: "horizontal" as const }, home("c", 9, 8)];
    for (const from of homes) for (const to of homes) {
      const reachable = new Set(existingRoadComponent(grid, buildingRoadAccessTiles(grid, from)).map(point => `${point.tx},${point.ty}`));
      assert.equal(service(from, to), buildingRoadAccessTiles(grid, to).some(point => reachable.has(`${point.tx},${point.ty}`)));
    }
  }
});

test("labels reuse immutable topology but isolate changed tiles, dimensions and alternate gates", () => {
  const base = randomGrid(2);
  assert.equal(labelRoadComponents(base), labelRoadComponents({ ...base }));
  assert.notEqual(labelRoadComponents(base), labelRoadComponents({ ...base, tiles: [...base.tiles] }));
  assert.notEqual(labelRoadComponents(base), labelRoadComponents({ ...base, width: 10, height: 12 }));
  assert.ok(base.palisade);
  const alternative = { ...base, palisade: { ...base.palisade, gate: { x: 6, y: 8 } } };
  assert.notEqual(labelRoadComponents(base), labelRoadComponents(alternative));
  assert.deepEqual(labelRoadComponents(base), labelRoadComponents({ ...base, tiles: [...base.tiles] }));
});

test("bridge completion and bank removal change labels without revisions", () => {
  const tiles = Array.from({ length: 5 }, (_, tx) => ({ tx, ty: 0, terrain: tx === 0 || tx === 4 ? "grass" as const : "water" as const, hasRoad: true, buildingId: null }));
  const complete = { width: 5, height: 1, tiles };
  assert.equal(new Set(labelRoadComponents(complete).values()).size, 1);
  const cut = { ...complete, tiles: tiles.map(tile => tile.tx === 4 ? { ...tile, hasRoad: false } : tile) };
  assert.deepEqual([...labelRoadComponents(cut).keys()], ["0,0"]);
  assert.equal(labelRoadComponents(complete).size, 5);
});

test("wall through a road center excludes even the BFS seed; moving gate opens it", () => {
  const tiles = Array.from({ length: 9 }, (_, index) => ({ tx: index % 3, ty: Math.floor(index / 3), terrain: "grass" as const, hasRoad: true, buildingId: null }));
  const wall = { gate: { x: 20, y: 20 }, segments: [{ completed: true, edgePath: [{ x: 0, y: 0 }, { x: 3, y: 3 }] }] };
  const blocked = { width: 3, height: 3, tiles, palisade: wall };
  assert.equal(labelRoadComponents(blocked).has("1,1"), false);
  const gate = { ...blocked, palisade: { ...wall, gate: { x: 1.5, y: 1.5 } } };
  assert.equal(labelRoadComponents(gate).has("1,1"), true);
  assert.equal(labelRoadComponents(blocked).has("1,1"), false);
});

test("building ports may touch several disconnected components without joining them", () => {
  const roads = new Set(["1,0", "1,2", "2,2", "3,2"]);
  const grid = { width: 5, height: 4, tiles: Array.from({ length: 20 }, (_, index) => ({ tx: index % 5, ty: Math.floor(index / 5), terrain: "grass" as const, hasRoad: roads.has(`${index % 5},${Math.floor(index / 5)}`), buildingId: null })) };
  const service = marketRoadService(grid);
  assert.equal(service(home("multi", 1, 1), home("south", 3, 3)), true);
  assert.equal(service(home("north", 0, 0), home("south", 3, 3)), false);
  assert.equal(service({ ...home("merged", 2, 3), houseLot: "horizontal" }, home("multi", 1, 1)), true);
});


test("dimension changes use grid addresses rather than obsolete tile metadata", () => {
  const tiles = Array.from({ length: 12 }, (_, index) => ({ tx: index % 4, ty: Math.floor(index / 4), terrain: "grass" as const, hasRoad: index === 11, buildingId: null }));
  const original = { width: 4, height: 3, tiles };
  assert.deepEqual([...labelRoadComponents(original).keys()], ["3,2"]);
  const reshaped = { ...original, width: 3, height: 4 };
  assert.deepEqual([...labelRoadComponents(reshaped).keys()], existingRoadComponent(reshaped, [{ tx: 2, ty: 3 }]).map(tile => `${tile.tx},${tile.ty}`));
  assert.deepEqual([...labelRoadComponents(original).keys()], ["3,2"]);
});
