import assert from "node:assert/strict";
import test from "node:test";
import { palisadeSegmentRenderItems } from "../src/render/palisadeObjectRenderItems";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
import { palisade, palisadeSegment, building } from "./stoneWallConversionFixtures";

const range = { minTx: 0, minTy: 0, maxTx: 20, maxTy: 20 };
const edgePath = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 }];

test("completed stone unit edges sort around intermediate building depth without mutating gameplay segment", () => {
  const segment = palisadeSegment(0, { material: "stone", edgePath, tileCount: 4 });
  const state = palisade([segment]);
  const items = buildObjectRenderItems({ tiles: [], buildings: [building("middle-house", "house", 4, 2)], palisade: state, range });
  const relevant = items.filter(item => item.kind === "palisade_segment" || item.kind === "building");
  assert.equal(relevant.length, 5);
  assert.equal(relevant[0]?.depth, 5);
  assert.equal(relevant[4]?.depth, 8);
  const houseIndex = relevant.findIndex(item => item.kind === "building");
  assert.ok(houseIndex > 0 && houseIndex < 4);
  assert.equal(segment.edgePath, edgePath);
  assert.equal(segment.tileCount, 4);
  const walls = palisadeSegmentRenderItems(state, range);
  assert.equal(new Set(walls.map(item => item.id)).size, 4);
  assert.deepEqual(walls.map(item => item.id), palisadeSegmentRenderItems(state, range).map(item => item.id));
  for (const item of walls) {
    assert.equal(item.segment.id, segment.id);
    assert.equal(item.segment.tileCount, 4);
    assert.equal(item.segment.edgePath.length, 2);
  }
});

test("gate at a split vertex reaches both adjacent render items only", () => {
  const state = { ...palisade([palisadeSegment(0, { material: "stone", edgePath })]), gate: { x: 4, y: 2 } };
  const items = palisadeSegmentRenderItems(state, range);
  assert.deepEqual(items.map(item => item.gate), [null, state.gate, state.gate, null]);
});

test("timber uses stable unit edges for gate depth and incomplete stone produces none", () => {
  const timber = palisadeSegment(0, { edgePath });
  const stone = palisadeSegment(1, { edgePath, material: "stone", completed: false });
  const items = palisadeSegmentRenderItems(palisade([timber, stone]), range);
  assert.equal(items.length, 4);
  assert.equal(new Set(items.map(item => item.id)).size, 4);
  assert.ok(items.every(item => item.segment.id === timber.id && item.segment.material === 'timber'));
  assert.equal(timber.edgePath, edgePath);
});

test('timber shared gate node draws once independent of installation and path order', () => {
  const a = palisadeSegment(0, {edgePath: [{x:2,y:2},{x:4,y:2}]});
  const b = palisadeSegment(1, {edgePath: [{x:4,y:2},{x:6,y:2}]});
  const state = {...palisade([a,b]), gate:{x:4,y:2}};
  const items = palisadeSegmentRenderItems(state, range);
  const gates = items.flatMap(item => item.stoneNodes ?? []);
  assert.equal(gates.length, 1);
  assert.equal(gates[0]?.neighbors.length, 2);
  const reversed = {...state, segments: [...state.segments].reverse().map(segment => ({...segment,edgePath:[...segment.edgePath].reverse()}))};
  assert.deepEqual(items, palisadeSegmentRenderItems(reversed,range));
});
