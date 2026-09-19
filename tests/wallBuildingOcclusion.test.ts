import assert from "node:assert/strict";
import test from "node:test";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
import { stoneWallNodeSolids } from "../src/render/stoneWallNodeGeometry";
import { sortRenderItems } from "../src/render/objectRenderSort";
import { building, palisade, palisadeSegment } from "./stoneWallConversionFixtures";

const range = { minTx: 0, minTy: 0, maxTx: 20, maxTy: 20 };
for (const home of [
  building("home", "house", 8, 8),
  building("home", "house", 8, 8, { houseLot: "horizontal" }),
  building("home", "house", 8, 8, { houseLot: "vertical" }),
  building("home", "storehouse", 8, 8),
]) {
  const { width, height } = buildingFootprint(home);
  for (const side of ["north", "west", "south", "east"] as const) {
    test(`${width}x${height} ${side} wall sorts on the physical side of its building`, () => {
      const horizontal = side === "north" || side === "south";
      const length = horizontal ? width : height;
      const start = { x: home.tx + (side === "east" ? width : 0), y: home.ty + (side === "south" ? height : 0) };
      const segments = Array.from({ length }, (_, index) => palisadeSegment(index, {
        material: "stone", edgePath: [
          { x: start.x + (horizontal ? index : 0), y: start.y + (horizontal ? 0 : index) },
          { x: start.x + (horizontal ? index + 1 : 0), y: start.y + (horizontal ? 0 : index + 1) },
        ],
      }));
      const getItems = (reverse: boolean) => buildObjectRenderItems({ tiles: [], buildings: [home],
        palisade: { ...palisade(reverse ? [...segments].reverse() : segments), gate: { x: 0, y: 0 } }, range,
      }).filter(item => item.kind === "building" || item.kind === "palisade_segment");
      const items = getItems(false);
      const homeIndex = items.findIndex(item => item.kind === "building");
      assert.equal(homeIndex, side === "north" || side === "west" ? length : 0);
      assert.deepEqual(items.map(item => item.id), getItems(true).map(item => item.id));
    });
  }
}

test("turning gates span their end piers with one supported lintel rather than an overhead elbow", () => {
  const solids = stoneWallNodeSolids({ kind: "gate", point: { x: 4, y: 4 },
    neighbors: [{ x: 3, y: 4 }, { x: 4, y: 5 }],
  });
  assert.equal(solids.length, 3);
  assert.equal(solids.filter(solid => solid.base === 0 && solid.height === 24).length, 2);
  const lintels = solids.filter(solid => solid.base > 0);
  assert.equal(lintels.length, 1);
  assert.equal(lintels[0]?.base, 20);
  assert.equal(lintels[0]?.height, 4);
});

test("neighboring turning gates do not invent a support in their shared opening", () => {
  const solids = stoneWallNodeSolids({ kind: "gate", point: { x: 4, y: 4 },
    neighbors: [{ x: 3, y: 4 }, { x: 4, y: 5 }], clearanceGates: [{ x: 3, y: 4 }, { x: 4, y: 4 }],
  });
  assert.equal(solids.length, 1);
  assert.equal(solids[0]?.base, 0);
});

test("simultaneous walls preserve complete object order under reversed input and repeated sorting", () => {
  const home = building("home", "storehouse", 8, 8);
  const state = { ...palisade([palisadeSegment(0, { material: "stone", edgePath: [
    { x: 8, y: 8 }, { x: 10, y: 8 }, { x: 10, y: 10 }, { x: 8, y: 10 }, { x: 8, y: 8 },
  ] })]), gate: { x: 0, y: 0 } };
  const items = buildObjectRenderItems({ tiles: [], buildings: [home], palisade: state, range });
  const houseIndex = items.findIndex(item => item.kind === "building");
  for (const [index, item] of items.entries()) {
    if (item.kind !== "palisade_segment") continue;
    const rear = item.segment.edgePath.every(point => point.x === 8)
      || item.segment.edgePath.every(point => point.y === 8);
    assert.equal(index < houseIndex, rear);
  }
  assert.deepEqual(sortRenderItems([...items].reverse()), items);
  assert.deepEqual(sortRenderItems(items), items);
});
