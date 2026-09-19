import assert from "node:assert/strict";
import test from "node:test";
import { stoneWallTopology } from "../src/render/stoneWallTopology";
import { palisade, palisadeSegment } from "./stoneWallConversionFixtures";

const center = { x: 4, y: 4 };
const neighbors = [{ x: 5, y: 4 }, { x: 4, y: 5 }, { x: 3, y: 4 }, { x: 4, y: 3 }];
function graph(mask: number) {
  return palisade(neighbors.flatMap((point, index) => (mask & (1 << index)) === 0 ? [] :
    [palisadeSegment(index, { material: "stone", edgePath: [center, point] })]));
}
for (let mask = 1; mask < 16; mask += 1) {
  test(`stone node mask ${mask} has one deterministic owner through reversal`, () => {
    const state = graph(mask);
    const forward = stoneWallTopology(state);
    const reverse = stoneWallTopology({ ...state, segments: [...state.segments].reverse().map(segment => ({ ...segment, edgePath: [...segment.edgePath].reverse() })) });
    assert.deepEqual(forward, reverse);
    const nodes = forward.flatMap(edge => edge.nodes).filter(node => node.point.x === 4 && node.point.y === 4);
    const branches = neighbors.filter((_, index) => (mask & (1 << index)) !== 0).length;
    assert.equal(nodes.length, mask === 5 || mask === 10 ? 0 : 1);
    if (nodes[0]) assert.equal(nodes[0].neighbors.length, branches);
  });
}
test("duplicate edges do not double wall runs and incomplete replacements do not create joints", () => {
  const state = graph(1);
  const first = state.segments[0];
  assert.ok(first);
  const result = stoneWallTopology({ ...state, segments: [first, { ...first, id: "duplicate" }, palisadeSegment(3, { completed: false, material: "stone", edgePath: [center, neighbors[1] ?? center] })] });
  assert.equal(result.length, 1);
  assert.equal(result.flatMap(edge => edge.nodes).length, 2);
});
test("gate vertex owns one portal while both incident runs retain gate clearance", () => {
  const state = { ...graph(5), gate: center };
  const result = stoneWallTopology(state);
  assert.equal(result.flatMap(edge => edge.nodes).filter(node => node.kind === "gate").length, 1);
  assert.equal(result.filter(edge => edge.gate !== null).length, 2);
});
test("long fractional paths normalize before subdivision so reversal has identical node coordinates", () => {
  const segment = palisadeSegment(0, { material: "stone", edgePath: [{ x: -0.2, y: 0.3 }, { x: 3.8, y: 0.3 }] });
  assert.deepEqual(stoneWallTopology(palisade([segment])), stoneWallTopology(palisade([{ ...segment, edgePath: [...segment.edgePath].reverse() }])));
});
