import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { PalisadePath, TileEdgePoint } from "../src/world/palisadeGeometry";
import type { Building } from "../src/content/buildingConfig";
import type { Grid } from "../src/world/grid";
import { gatesForExteriorAccess } from "../src/engine/palisadeExteriorGate";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { existingRoadComponent } from "../src/world/roadGraph";

const source: Building = { id: "store", kind: "storehouse", tx: 5, ty: 5, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
const path = [{ x: 2, y: 2 }, { x: 9, y: 2 }, { x: 9, y: 9 }, { x: 2, y: 9 }, { x: 2, y: 2 }];

test("a primary gate facing water gains a land exit without creating roads or crossing water", () => {
  const grid: Grid & { buildings: readonly Building[] } = { width: 12, height: 12, buildings: [source], tiles: Array.from({ length: 144 }, (_, i) => {
    const tx = i % 12; const ty = Math.floor(i / 12);
    return { tx, ty, terrain: ty === 1 && (tx === 4 || tx === 5) ? "water" : "grass", buildingId: tx >= 5 && tx < 7 && ty >= 5 && ty < 7 ? source.id : null, hasRoad: tx === 4 && ty === 5 };
  }) };
  const snapshot = JSON.stringify(grid);
  const primary = { x: 5, y: 2 };
  const gates = gatesForExteriorAccess(grid, path, primary, []);
  assert.equal(gates.length, 1);
  assert.equal(JSON.stringify(grid), snapshot);
  const potential = { ...grid, tiles: grid.tiles.map(tile => ({ ...tile, hasRoad: tile.terrain !== "water" && tile.buildingId === null })), palisade: { gate: primary, additionalGates: gates, segments: [{ completed: true, edgePath: path }] } };
  const connected = existingRoadComponent(potential, buildingRoadAccessTiles(potential, source));
  assert.ok(connected.some(tile => tile.tx === 0 && tile.ty === 0));
  assert.equal(connected.some(tile => tile.ty === 1 && (tile.tx === 4 || tile.tx === 5)), false);
  assert.deepEqual(gatesForExteriorAccess(grid, path, primary, gates), gates);
});

test('candidate gates reuse the unchanged potential road neighbors within one plan', () => {
  const grid: Grid & { buildings: readonly Building[] } = { width: 12, height: 12, buildings: [source], tiles: Array.from({ length: 144 }, (_, i) => {
    const tx = i % 12; const ty = Math.floor(i / 12);
    return { tx, ty, terrain: ty === 1 && (tx === 4 || tx === 5) ? 'water' : 'grass', buildingId: tx >= 5 && tx < 7 && ty >= 5 && ty < 7 ? source.id : null, hasRoad: tx === 4 && ty === 5 };
  }) };
  const original = Array.prototype.filter;
  let neighborLists = 0;
  Array.prototype.filter = function<T>(this: T[], callback: (value: T, index: number, array: T[]) => unknown, thisArg?: unknown): T[] {
    if (this.length === 4 && this.every(value => typeof value === 'object' && value !== null && 'tx' in value && 'ty' in value)) neighborLists++;
    return original.call(this, callback, thisArg) as T[];
  } as typeof original;
  let gates;
  try { gates = gatesForExteriorAccess(grid, path, { x: 5, y: 2 }, []); }
  finally { Array.prototype.filter = original; }
  assert.equal(gates.length, 1);
  assert.ok(neighborLists <= grid.tiles.length * 4, `neighbor lists ${neighborLists} should be bounded by the grid, not gate candidates`);
});


test('gate choices match prior BFS for rotations, reversed paths, diagonal bridges and a natural town', () => {
  const cases: readonly { name: string; grid: Grid & { buildings: readonly Building[] }; path: PalisadePath; primary: TileEdgePoint; selected: readonly TileEdgePoint[]; expected: readonly TileEdgePoint[] }[] = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/exterior-gate-plans.json.gz', import.meta.url))).toString());
  for (const input of cases) {
    assert.deepEqual(gatesForExteriorAccess(input.grid, input.path, input.primary, input.selected), input.expected, input.name);
    assert.deepEqual(gatesForExteriorAccess(input.grid, input.path, input.primary, input.expected), input.expected, `${input.name}: already selected gates`);
  }
});
