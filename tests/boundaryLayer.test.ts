import assert from "node:assert/strict";
import test from "node:test";

import { buildGroundBoundaryScene } from "../src/render/groundBoundaryScene";
import { boundaryEdgeKey } from "../src/world/boundary/boundaryGeometry";
import { cellContourLoops, cellOutlineLoops } from "../src/world/boundary/cellContours";
import { outlineTolerance, roadCentrelineTolerance } from "../src/world/boundary/boundaryTolerance";
import { roadCenterlineGraph } from "../src/world/boundary/roadCenterline";
import { fieldClusters } from "../src/world/boundary/terrainBoundaries";
import { BOUNDARY_FIXTURES, fixedSceneState } from "../scripts/boundaryFixtureStates";

// D1a gate 1 (tolerance): road ribbon centreline within 0.25 tile of the road cells it runs through; forest and
// field outlines within 0.35 tile of the tile edges that separate inside from outside. Every fixture.
for (const fixture of BOUNDARY_FIXTURES) {
  test(`Given ${fixture.name} When the boundary layer is derived Then curves stay within the grid tolerances`, () => {
    // Given
    const state = fixture.state();

    // When
    const scene = buildGroundBoundaryScene(state);
    const road = roadCentrelineTolerance(scene.roads, 0.25);
    const forest = outlineTolerance(scene.forest.loops, 0.35);
    const fields = outlineTolerance(scene.fields.flatMap(field => field.loops), 0.35);

    // Then
    assert.ok(road.samples > 0 && forest.samples > 0 && fields.samples > 0, JSON.stringify({ road, forest, fields }));
    assert.equal(road.over, 0, `road samples beyond 0.25: ${JSON.stringify(road)}`);
    assert.equal(forest.over, 0, `forest samples beyond 0.35: ${JSON.stringify(forest)}`);
    assert.equal(fields.over, 0, `field samples beyond 0.35: ${JSON.stringify(fields)}`);
  });
}

test("Given the same state enumerated in reverse When the boundary layer is derived Then every loop, chain and chunk key is identical", () => {
  for (const fixture of BOUNDARY_FIXTURES) {
    // Given
    const state = fixture.state();

    // When
    const forward = buildGroundBoundaryScene(state, false);
    const reversed = buildGroundBoundaryScene(state, true);

    // Then
    const strip = (scene: typeof forward) => JSON.stringify({ ...scene, buildMs: 0 });
    assert.equal(strip(reversed), strip(forward), fixture.name);
  }
});

test("Given an edge seen from either tile When its key is computed Then both sides own the same key", () => {
  for (const [tx, ty, dx, dy] of [[0, 0, 1, 0], [5, 7, 0, 1], [3, 3, -1, 0], [0, 0, 0, -1], [63, 63, 1, 0]] as const) {
    assert.equal(boundaryEdgeKey(64, tx, ty, dx, dy), boundaryEdgeKey(64, tx + dx, ty + dy, -dx, -dy));
  }
  const keys = new Set<number>();
  for (let ty = -1; ty <= 64; ty += 1) for (let tx = -1; tx <= 64; tx += 1) {
    keys.add(boundaryEdgeKey(64, tx, ty, 1, 0)); keys.add(boundaryEdgeKey(64, tx, ty, 0, 1));
  }
  assert.equal(keys.size, 66 * 66 * 2);
});

test("Given one forest region beside grass When contours are traced Then the grass side and the forest side read one shared loop", () => {
  // Given: a 3x2 forest block; tracing the forest mask and the grass mask must give the same line.
  const forest = (tx: number, ty: number) => tx >= 2 && tx <= 4 && ty >= 2 && ty <= 3;
  const grass = (tx: number, ty: number) => !forest(tx, ty);

  // When
  const fromForest = cellContourLoops({ width: 8, height: 8, inside: forest, outside: false });
  const fromGrass = cellContourLoops({ width: 8, height: 8, inside: grass, outside: true });

  // Then
  const pointSet = (loops: typeof fromForest) => loops.flatMap(loop => loop.points.map(point => `${point.x},${point.y}`)).sort();
  assert.deepEqual(pointSet(fromGrass), pointSet(fromForest));
  assert.equal(fromForest.length, 1);
  assert.ok((fromForest[0]?.signedArea ?? 0) * (fromGrass[0]?.signedArea ?? 0) < 0, "opposite orientation");
});

test("Given diagonal-only contact When outlines are traced Then the two cells stay separate regions", () => {
  const inside = (tx: number, ty: number) => (tx === 1 && ty === 1) || (tx === 2 && ty === 2);
  assert.equal(cellContourLoops({ width: 4, height: 4, inside, outside: false }).length, 2);
  assert.equal(cellOutlineLoops({ width: 4, height: 4, inside, outside: false }).length, 2);
});

test("Given crops at every growth stage When field clusters are derived Then the outlines do not move", () => {
  // Given
  const state = fixedSceneState();
  const farms = state.buildings.filter(building => building.kind === "wheat_farm");
  const hashes = [0, 10, 20, 30, 39].map(progress => fieldClusters(state, farms.map(farm => ({ ...farm, width: 2, height: 2, productionProgress: progress })))
    .map(field => field.hash).join(","));

  // Then
  assert.equal(new Set(hashes).size, 1);
  assert.equal(fieldClusters(state, farms.map(farm => ({ ...farm, width: 2, height: 2 }))).length, 2, "two separate field clusters");
});

test("Given the fixed scene When the road graph is derived Then junction, dead ends and bridge banks are fixed points and chains end on them (or on the deck start past a single-road bank)", () => {
  // Given
  const state = fixedSceneState();

  // When
  const graph = roadCenterlineGraph(state);

  // Then
  const kinds = graph.fixedPoints.flatMap(point => point.kinds);
  for (const kind of ["junction", "dead_end", "bridge_bank"] as const) assert.ok(kinds.includes(kind), kind);
  const deckStart = (cell: { tx: number; ty: number } | undefined) => {
    const bank = graph.fixedPoints.find(point => point.tx === cell?.tx && point.ty === cell?.ty && point.degree === 1);
    const direction = bank?.bridgeDirections[0];
    return direction === undefined ? null : { x: (cell?.tx ?? 0) + direction.x / 2, y: (cell?.ty ?? 0) + direction.y / 2 };
  };
  let extended = 0;
  for (const chain of graph.chains.filter(candidate => !candidate.closed)) {
    const first = chain.cells[0]; const last = chain.cells[chain.cells.length - 1];
    for (const [cell, point, next] of [[first, chain.centreline[0], chain.centreline[1]], [last, chain.centreline[chain.centreline.length - 1], chain.centreline[chain.centreline.length - 2]]] as const) {
      const deck = deckStart(cell);
      if (deck === null) { assert.deepEqual(point, { x: cell?.tx, y: cell?.ty }); continue; }
      extended += 1;
      assert.deepEqual(point, deck);
      assert.deepEqual(next, { x: cell?.tx, y: cell?.ty });
    }
  }
  assert.equal(extended, 1, "the west bank's road runs on to the deck");
});
