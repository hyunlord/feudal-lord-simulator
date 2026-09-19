import assert from "node:assert/strict";
import test from "node:test";
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
