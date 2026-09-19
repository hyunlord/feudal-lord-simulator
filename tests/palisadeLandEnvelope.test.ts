import assert from "node:assert/strict";
import test from "node:test";
import { additionalRoadGates } from "../src/engine/palisadeGates";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import type { Building } from "../src/content/buildingConfig";
import { canTraverseWallBoundary } from "../src/world/wallTraversal";
import { existingRoadComponent } from "../src/world/roadGraph";
import { buildWorldGrid } from "../src/world/terrain";
import { getTile, type Grid } from "../src/world/grid";
import { computePalisadeProposal, footprintCorners, isPointInsidePalisade, validatePalisadeCandidate, type PalisadeFootprint, type PalisadePath, palisadePathHasBuildingClearance } from "../src/world/palisadeGeometry";

function assertWorkfronts(world: Grid, path: PalisadePath, footprints: readonly PalisadeFootprint[]) {
  const dryRoads = { ...world, tiles: world.tiles.map(tile => ({ ...tile, hasRoad: tile.terrain !== "water" && tile.buildingId === null })) };
  const center = footprints.reduce((sum, f) => ({ tx: sum.tx + f.tx / footprints.length, ty: sum.ty + f.ty / footprints.length }), { tx: 0, ty: 0 });
  const start = dryRoads.tiles.filter(tile => tile.hasRoad).sort((a, b) => Math.hypot(a.tx - center.tx, a.ty - center.ty) - Math.hypot(b.tx - center.tx, b.ty - center.ty))[0];
  assert.ok(start);
  const reachable = new Set(existingRoadComponent(dryRoads, [start]).map(tile => `${tile.tx},${tile.ty}`));
  for (let index = 1; index < path.length; index += 1) {
    const first = path[index - 1]; const end = path[index];
    assert.ok(first && end);
    let a: { readonly x: number; readonly y: number } = first;
    while (a.x !== end.x || a.y !== end.y) {
      const b: { readonly x: number; readonly y: number } = { x: a.x + Math.sign(end.x - a.x), y: a.y + Math.sign(end.y - a.y) };
      const x = Math.min(a.x, b.x); const y = Math.min(a.y, b.y);
      const adjacent = a.y === b.y ? [{ tx: x, ty: y - 1 }, { tx: x, ty: y }] : [{ tx: x - 1, ty: y }, { tx: x, ty: y }];
      assert.ok(adjacent.some(point => { const tile = getTile(world, point); return tile !== null && tile.terrain !== "water" && tile.buildingId === null; }), JSON.stringify([a, b]));
      assert.ok(adjacent.some(point => reachable.has(`${point.tx},${point.ty}`)), `unreachable workfront ${JSON.stringify([a,b])}`);
      for (const f of footprints) {
        const mx: number = (a.x + b.x) / 2; const my: number = (a.y + b.y) / 2;
        assert.equal(mx > f.tx && mx < f.tx + f.width && my > f.ty && my < f.ty + f.height, false);
      }
      a = b;
    }
  }
}

test("setback river settlement proposal keeps a legal workfront on every wall step", () => {
  const positions = [[44,40,1],[46,40,1],[44,42,1],[46,42,1],[45,41,1],[42,37,2],[50,40,1],[41,40,2],[44,38,1],[45,37,2],[47,38,1],[48,38,2],[51,40,2],[42,39,1],[43,42,1],[45,40,1],[47,42,2],[50,42,2],[48,44,1],[50,44,2],[48,45,1],[48,46,1],[48,47,1],[50,46,2],[47,48,2]];
  const unsafeFootprints = positions.map(([tx = 0, ty = 0, size = 1], index) => ({ id: `b${index}`, tx, ty, width: size, height: size }));
  const footprints = unsafeFootprints.map(f => ({ ...f, tx: f.tx - 5 }));
  const roads = new Set(["38,34", "39,34", "40,34", "41,34", "42,34", "43,34", "44,34", "45,34", "46,34", "38,35", "56,35", "38,36", "56,36", "38,37", "38,38", "38,39", "43,39", "44,39", "45,39", "46,39", "47,39", "38,40", "43,40", "47,40", "38,41", "43,41", "44,41", "46,41", "47,41", "48,41", "49,41", "50,41", "56,41", "38,42", "49,42", "55,42", "56,42", "38,43", "49,43", "54,43", "55,43", "38,44", "49,44", "54,44", "38,45", "49,45", "54,45", "38,46", "39,46", "40,46", "41,46", "42,46", "49,46", "54,46", "42,47", "49,47", "54,47", "42,48", "49,48", "54,48", "42,49", "49,49", "54,49", "42,50", "49,50", "54,50", "42,51", "43,51", "44,51", "45,51", "49,51", "54,51", "45,52", "46,52", "47,52", "48,52", "49,52", "50,52", "51,52", "52,52", "53,52", "54,52"]);
  const shiftedRoads = new Set([...roads].map(key => { const [x = 0, y = 0] = key.split(",").map(Number); return `${x - 5},${y}`; }));
  const terrain = buildWorldGrid({ width: 64, height: 64, seed: 1 });
  const world = { ...terrain, tiles: terrain.tiles.map(tile => ({ ...tile, hasRoad: shiftedRoads.has(`${tile.tx},${tile.ty}`), buildingId: footprints.find(f => tile.tx >= f.tx && tile.tx < f.tx + f.width && tile.ty >= f.ty && tile.ty < f.ty + f.height)?.id ?? null })) };
  assert.deepEqual(computePalisadeProposal(terrain, unsafeFootprints), { ok: false, reason: "building_clearance" });
  const result = computePalisadeProposal(world, footprints);
  assert.ok(result.ok, result.ok ? undefined : result.reason);
  assert.ok(palisadePathHasBuildingClearance(result.path, footprints));
  assertWorkfronts(world, result.path, footprints);
  const walled = { ...world, palisade: { gate: { x: -1, y: -1 }, segments: [{ completed: true, edgePath: result.path }] } };
  for (const f of footprints) {
    const ports = world.tiles.filter(tile => tile.hasRoad && tile.buildingId === null && (
      ((tile.tx === f.tx - 1 || tile.tx === f.tx + f.width) && tile.ty >= f.ty && tile.ty < f.ty + f.height) ||
      ((tile.ty === f.ty - 1 || tile.ty === f.ty + f.height) && tile.tx >= f.tx && tile.tx < f.tx + f.width)
    ));
    if (ports.length === 0) continue;
    assert.ok(ports.some(port => canTraverseWallBoundary(walled, { tx: Math.max(f.tx, Math.min(port.tx, f.tx + f.width - 1)), ty: Math.max(f.ty, Math.min(port.ty, f.ty + f.height - 1)) }, port)), `sealed frontage ${f.id}`);
  }
  const buildings: readonly Building[] = footprints.map(f => ({ id: f.id, kind: f.width === 2 ? "storehouse" : "house", tx: f.tx, ty: f.ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 }));
  const primary = result.path[0];
  assert.ok(primary);
  const additionalGates = additionalRoadGates({ ...world, buildings }, result.path, primary);
  const connected = { ...world, palisade: { gate: primary, additionalGates, segments: [{ completed: true, edgePath: result.path }] } };
  const first = buildings[0];
  assert.ok(first);
  const before = new Set(existingRoadComponent(world, buildingRoadAccessTiles(world, first)).map(p => `${p.tx},${p.ty}`));
  const after = new Set(existingRoadComponent(connected, buildingRoadAccessTiles(connected, first)).map(p => `${p.tx},${p.ty}`));
  for (const building of buildings) {
    if (buildingRoadAccessTiles(world, building).some(p => before.has(`${p.tx},${p.ty}`))) {
      assert.ok(buildingRoadAccessTiles(connected, building).some(p => after.has(`${p.tx},${p.ty}`)), `disconnected ${building.id}`);
    }
  }
  assert.ok(additionalGates.length <= 6);
  const potential = { ...connected, tiles: connected.tiles.map(tile => ({ ...tile, hasRoad: tile.terrain !== "water" && tile.buildingId === null })) };
  const accessible = existingRoadComponent(potential, buildingRoadAccessTiles(potential, first));
  assert.ok(accessible.length > 1000, "full walls must not trap the town in its small inner road pocket");
  assert.ok(accessible.some(tile => getTile(world, tile)?.terrain === "rock"), "external stone terrain must remain reachable by legal roads");
  assert.equal(validatePalisadeCandidate(world, result.path, footprints).ok, true);
  assert.ok(footprints.filter(f => footprintCorners(f).every(p => isPointInsidePalisade(p, result.path))).length >= Math.ceil(footprints.length * 0.6));
  assert.deepEqual(computePalisadeProposal(world, [...footprints].reverse()), result);
});

test("manual axial water channels are rejected while a dry shore remains legal", () => {
  const world: Grid = { width: 8, height: 8, tiles: Array.from({ length: 64 }, (_, i) => ({ tx: i % 8, ty: Math.floor(i / 8), terrain: Math.floor(i / 8) === 1 || Math.floor(i / 8) === 2 ? "water" : "grass", buildingId: null, hasRoad: false })) };
  const footprints = [{ id: "home", tx: 3, ty: 4, width: 1, height: 1 }];
  const wet = [{ x: 1, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 6 }, { x: 1, y: 6 }, { x: 1, y: 2 }];
  assert.deepEqual(validatePalisadeCandidate(world, wet, footprints), { ok: false, reason: "water_crossing" });
  const shore = wet.map(p => ({ ...p, y: p.y === 2 ? 3 : p.y }));
  assert.equal(validatePalisadeCandidate(world, shore, footprints).ok, true);
});

test("manual wall candidates reject both interior and exterior footprint contact", () => {
  const world: Grid = { width: 20, height: 20, tiles: Array.from({ length: 400 }, (_, i) => ({ tx: i % 20, ty: Math.floor(i / 20), terrain: "grass", buildingId: null, hasRoad: false })) };
  const path = [{ x: 3, y: 3 }, { x: 12, y: 3 }, { x: 12, y: 12 }, { x: 3, y: 12 }, { x: 3, y: 3 }];
  const inside = [{ id: "a", tx: 5, ty: 5, width: 1, height: 1 }, { id: "b", tx: 8, ty: 8, width: 1, height: 1 }];
  for (const tx of [3, 12]) {
    assert.deepEqual(validatePalisadeCandidate(world, path, [...inside, { id: "touching", tx, ty: 6, width: 1, height: 1 }]), { ok: false, reason: "building_clearance" });
  }
  assert.equal(validatePalisadeCandidate(world, path, [...inside, { id: "setback", tx: 4, ty: 6, width: 1, height: 1 }]).ok, true);
});

test("diagonal wall clearance checks between integer endpoints", () => {
  const footprint = { id: "home", tx: 4, ty: 4, width: 1, height: 1 };
  assert.equal(palisadePathHasBuildingClearance([{ x: 3, y: 4 }, { x: 4, y: 3 }], [footprint]), false);
  assert.equal(palisadePathHasBuildingClearance([{ x: 2, y: 4 }, { x: 4, y: 2 }], [footprint]), true);
});

test("river fallback encloses buffered plots without carving inward around buildings", () => {
  const world: Grid = { width: 24, height: 24, tiles: Array.from({ length: 576 }, (_, i) => ({ tx: i % 24, ty: Math.floor(i / 24), terrain: i % 24 >= 16 && i % 24 <= 18 ? "water" : "grass", buildingId: null, hasRoad: false })) };
  const footprints = [{ id: "a", tx: 10, ty: 8, width: 1, height: 1 }, { id: "b", tx: 13, ty: 11, width: 1, height: 1 }, { id: "c", tx: 10, ty: 14, width: 1, height: 1 }];
  const result = computePalisadeProposal(world, footprints);
  assert.ok(result.ok, result.ok ? undefined : result.reason);
  assert.ok(palisadePathHasBuildingClearance(result.path, footprints));
  assert.ok(result.path.every(point => point.x <= 16));
  assert.ok(footprints.every(f => footprintCorners(f).every(p => isPointInsidePalisade(p, result.path))));
  assert.ok(isPointInsidePalisade({ x: 12, y: 11 }, result.path), "space between plots belongs to the town, not a wall notch");
  assertWorkfronts(world, result.path, footprints);
  assert.deepEqual(computePalisadeProposal(world, [...footprints].reverse()), result);
});
