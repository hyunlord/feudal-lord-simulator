import assert from "node:assert/strict";
import test from "node:test";

import { recordingCanvas } from "../scripts/recordingCanvas";
import { palisade, palisadeSegment } from "./stoneWallConversionFixtures";
import { drawWallModules } from "../src/render/drawWallFaces";
import { gateArtAxis, gateOffAxisPiers } from "../src/render/gateArtGeometry";
import { cornerGateModules } from "../src/render/gateCornerModules";
import { stoneWallPieces } from "../src/render/stoneWallGeometry";
import { setShoreAssetsForTest } from "../src/render/terrainVariantAssets";
import { TERRAIN_VARIANT_ASSETS, WALL_FACE_KEYS } from "../src/render/terrainVariantManifest";
import { unitEdgeKey, wallBaselines } from "../src/world/boundary/wallBaseline";
import { canTraverseWallBoundary, GATE_HALF_CLEARANCE } from "../src/world/wallTraversal";
import type { TileEdgePoint } from "../src/world/palisadeGeometry";

// NAT-2 QA-003: the engine sets gates on wall corners (the 1380 town's gate is the tip of a spike: a straight arm along
// the edge row meeting a diagonal arm). A corner gate draws the art of its axis arm centred on the gate point, and the
// other arm keeps its traversal clearance and ends in a pier.
setShoreAssetsForTest(Object.fromEntries(WALL_FACE_KEYS.map(key => {
  const asset = TERRAIN_VARIANT_ASSETS.find(candidate => candidate.key === key)!;
  return [key, { label: key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height } as unknown as HTMLImageElement];
})));

const P = { x: 5, y: 2 };
const gate = (neighbors: readonly TileEdgePoint[]) => ({ point: P, neighbors, kind: "gate" as const });
const at = (dx: number, dy: number) => ({ x: P.x + dx, y: P.y + dy });

test("Given a corner gate with one axis arm When its art axis is picked Then the axis arm's, in all eight turns", () => {
  for (const [axisArm, axis] of [[at(-1, 0), "descending"], [at(1, 0), "descending"], [at(0, -1), "ascending"], [at(0, 1), "ascending"]] as const) {
    const diagonals = axis === "descending" ? [at(axisArm.x - P.x, 1), at(axisArm.x - P.x, -1)] : [at(1, axisArm.y - P.y), at(-1, axisArm.y - P.y)];
    for (const diagonal of diagonals) assert.equal(gateArtAxis(gate([axisArm, diagonal])), axis, `${JSON.stringify(axisArm)} + ${JSON.stringify(diagonal)}`);
  }
  // The 1380 town's gate (47, 42): the edge row arm (46, 42) and the diagonal (46, 43).
  assert.equal(gateArtAxis({ point: { x: 47, y: 42 }, neighbors: [{ x: 46, y: 42 }, { x: 46, y: 43 }], kind: "gate" }), "descending");
});

test("Given a 90 degree corner gate When its art axis is picked Then the arm whose partner runs back (a tie: descending)", () => {
  assert.equal(gateArtAxis(gate([at(1, 0), at(0, -1)])), "descending", "the y arm runs back");
  assert.equal(gateArtAxis(gate([at(-1, 0), at(0, 1)])), "ascending", "the x arm runs back");
  assert.equal(gateArtAxis(gate([at(-1, 0), at(0, -1)])), "descending", "both run back");
  assert.equal(gateArtAxis(gate([at(1, 0), at(0, 1)])), "descending", "both run forward");
});

test("Given gates no art fits When the axis is picked Then none (a straight diagonal, two diagonal arms, a junction)", () => {
  assert.equal(gateArtAxis(gate([at(-1, -1), at(1, 1)])), null);
  assert.equal(gateArtAxis(gate([at(-1, -1), at(1, -1)])), null);
  assert.equal(gateArtAxis(gate([at(-1, 0), at(1, 0), at(0, 1)])), null);
});

test("Given corner gates When the off-axis piers are placed Then one past the clearance on the other arm, split about the gate's depth", () => {
  const spike = gateOffAxisPiers(gate([at(-1, 0), at(-1, 1)]));
  const offset = GATE_HALF_CLEARANCE + 0.15;
  assert.deepEqual(spike, { behind: [], front: [at(-offset, offset)] });
  assert.deepEqual(gateOffAxisPiers(gate([at(-1, 0), at(0, -1)])), { behind: [at(0, -offset)], front: [] });
  assert.deepEqual(gateOffAxisPiers(gate([at(-1, 0), at(1, 0)])), { behind: [], front: [] }, "a straight gate has none");
});

// The spike: an arm along the edge row y = 2 from the gate (5, 2) west, and a diagonal arm from the gate south-west.
const spikeWall = { ...palisade([
  palisadeSegment(0, { material: "stone", edgePath: [P, at(-3, 0)] }),
  palisadeSegment(1, { material: "stone", edgePath: [at(-3, 3), P] }),
]), gate: P };
const grid = { width: 10, height: 10, palisade: spikeWall };
const closed = { width: 10, height: 10, palisade: { ...spikeWall, gate: { x: -5, y: -5 } } };

test("Given the spike's corner gate When walkers cross the wall Then every crossing the gate opens lies in the drawn passage or the off arm's clearance", () => {
  let axisCrossings = 0; let offCrossings = 0;
  for (let ty = 0; ty < 9; ty += 1) for (let tx = 0; tx < 9; tx += 1) for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    const from = { tx, ty }; const to = { tx: tx + dx, ty: ty + dy };
    if (!canTraverseWallBoundary(grid, from, to) || canTraverseWallBoundary(closed, from, to)) continue;
    const a = { x: tx + 0.5, y: ty + 0.5 }; const b = { x: to.tx + 0.5, y: to.ty + 0.5 };
    if (dy === 1 && a.y < P.y && b.y > P.y) {
      // Across the edge row: inside the gate art's passage (the axis arm's clearance, centred on the gate).
      assert.ok(Math.abs(a.x - P.x) <= GATE_HALF_CLEARANCE, `row crossing at x ${a.x}`);
      axisCrossings += 1;
      continue;
    }
    // Onto the diagonal x + y = 7: the touching tile centre lies within the off arm's clearance.
    const touch = [a, b].find(point => Math.abs(point.x + point.y - (P.x + P.y)) < 1e-9);
    assert.ok(touch !== undefined, `move ${JSON.stringify(from)} -> ${JSON.stringify(to)} crosses an arm`);
    assert.ok(P.x - touch.x <= GATE_HALF_CLEARANCE, `diagonal crossing ${JSON.stringify(touch)}`);
    offCrossings += 1;
  }
  assert.ok(axisCrossings > 0 && offCrossings > 0, `the gate opens both arms (${axisCrossings} row, ${offCrossings} diagonal)`);
  // The pieces keep both arms' clearance, and the off-axis pier stands just past it.
  const cut = [...stoneWallPieces([P, at(-3, 0)], P), ...stoneWallPieces([at(-3, 3), P], P)].filter(piece => piece.from > 0 || piece.to < 1);
  assert.equal(cut.length, 2);
  for (const piece of cut) assert.ok(Math.abs((piece.from > 0 ? piece.from : 1 - piece.to) - GATE_HALF_CLEARANCE) < 1e-9);
});

test("Given the spike in wall strips When the items draw their modules Then the axis arm draws the art, the diagonal arm its end pier", () => {
  const tiles = Array.from({ length: 100 }, (_, index) => ({ tx: index % 10, ty: Math.floor(index / 10), terrain: "grass", buildingId: null, hasRoad: false }));
  const walls = wallBaselines(spikeWall, { width: 10, height: 10, tiles } as never);
  const node = walls.nodes.find(candidate => candidate.kind === "gate");
  assert.ok(node !== undefined);
  const axisKey = unitEdgeKey(P, at(-1, 0)); const offKey = unitEdgeKey(P, at(-1, 1));
  assert.deepEqual(cornerGateModules(node, axisKey), [node]);
  const [pier, ...rest] = cornerGateModules(node, offKey) ?? [];
  assert.equal(rest.length, 0);
  assert.deepEqual({ kind: pier?.kind, point: pier?.point, gateEnd: pier !== undefined && "gateEnd" in pier }, { kind: "terminal", point: at(-0.95, 0.95), gateEnd: true });
  assert.deepEqual(cornerGateModules(node, unitEdgeKey(at(-2, 0), at(-1, 0))), [], "a farther edge draws neither");
  // The stone end cap is the painted pillar; a plain terminal keeps its masonry pier.
  const capped = recordingCanvas(1024, 1024);
  drawWallModules(capped.context, [pier!], [], "stone", 1);
  assert.match(capped.canvas.ops.join("\n"), /drawImage\(stone_pillar_135[^_]/);
  const plain = recordingCanvas(1024, 1024);
  drawWallModules(plain.context, [{ ...node, kind: "terminal", point: at(-0.95, 0.95), neighbors: [] }], [], "stone", 1);
  assert.doesNotMatch(plain.canvas.ops.join("\n"), /stone_pillar_135/);
});

test("Given a 90 degree gate whose off arm runs back When the items draw Then the art is drawn by the arm the queue draws last, after the pier", () => {
  const wall = { ...palisade([
    palisadeSegment(0, { material: "stone", edgePath: [P, at(-3, 0)] }),
    palisadeSegment(1, { material: "stone", edgePath: [at(0, -2), P] }),
  ]), gate: P };
  const tiles = Array.from({ length: 100 }, (_, index) => ({ tx: index % 10, ty: Math.floor(index / 10), terrain: "grass", buildingId: null, hasRoad: false }));
  const node = wallBaselines(wall, { width: 10, height: 10, tiles } as never).nodes.find(candidate => candidate.kind === "gate");
  assert.ok(node !== undefined);
  const axisKey = unitEdgeKey(P, at(-1, 0)); const offKey = unitEdgeKey(P, at(0, -1));
  // Both unit edges reach depth 7 at the gate with anchor x 5; the ids break the tie ("stone:4,2:5,2" < "stone:5,1:5,2").
  assert.deepEqual(cornerGateModules(node, axisKey), []);
  const modules = cornerGateModules(node, offKey) ?? [];
  assert.deepEqual(modules.map(module => module.kind), ["terminal", "gate"]);
});
