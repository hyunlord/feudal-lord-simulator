import assert from "node:assert/strict";
import test from "node:test";
import type { Tile } from "../src/world/world.types";
import { roadReadabilityTiles } from "../src/render/roadReadabilityOverlay";
import { palisadeSegmentRenderItems } from "../src/render/palisadeObjectRenderItems";
import { palisade, palisadeSegment } from "./stoneWallConversionFixtures";

const tiles: readonly Tile[] = Array.from({ length: 8 }, (_, tx) => ({ tx, ty: 2, terrain: "grass", buildingId: null, hasRoad: true }));
const range = { minTx: 0, minTy: 0, maxTx: 20, maxTy: 20 };
for (const material of ["timber", "stone"] as const) {
  test(`${material} gate retains distant road repaint and protects local depth-sorted walkers`, () => {
    const state = { ...palisade([palisadeSegment(0, { material, edgePath: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }] })]), gate: { x: 2, y: 2 } };
    const gates = palisadeSegmentRenderItems(state, range).flatMap(item => (item.stoneNodes ?? []).filter(node => node.kind === "gate").map(node => node.point));
    const painted = roadReadabilityTiles(tiles, gates);
    assert.deepEqual(painted.map(tile => tile.tx), [0, 4, 5, 6, 7]);
    const incomplete = { ...state, segments: state.segments.map(segment => ({ ...segment, completed: false })) };
    const noGates = palisadeSegmentRenderItems(incomplete, range).flatMap(item => (item.stoneNodes ?? []).filter(node => node.kind === "gate").map(node => node.point));
    assert.deepEqual(roadReadabilityTiles(tiles, noGates), tiles);
    assert.ok(tiles.every(tile => tile.hasRoad));
  });
}
