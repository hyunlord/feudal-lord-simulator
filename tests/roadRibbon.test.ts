import assert from "node:assert/strict";
import test from "node:test";

import { ROAD_STRIP_CHOICE, ROAD_STRIP_SETS } from "../src/render/boundaryAssetManifest";
import { buildGroundBoundaryScene } from "../src/render/groundBoundaryScene";
import { ROAD_RIBBON_WIDTH, resolveRoadRibbonWidth, roadStripSet, setRoadRibbonWidth, setRoadStripOverride } from "../src/render/roadRibbonStyle";
import { alignedRoadPosition, alignmentIndex } from "../src/render/walkerRoadAlignment";
import { roadCentrelineTolerance } from "../src/world/boundary/boundaryTolerance";
import { SHOULDER_SPACING_MAX, SHOULDER_SPACING_MIN } from "../src/world/boundary/roadRibbonLayout";
import { BOUNDARY_FIXTURES, fixedSceneState } from "../scripts/boundaryFixtureStates";
import { junctionOverlap, portalAlignment, shoulderStats, walkerDeviation } from "../scripts/roadRibbonGates";

// D1a-2 road ribbon gates 1-4 (junctions, portals, walkers, shoulders) on the 12x12 scene and the seed 1-5 towns.

for (const fixture of BOUNDARY_FIXTURES) {
  test(`Given ${fixture.name} When junctions are drawn Then no two chain ribbons overlap at any degree 3 or 4 node and every arm's ruts reach the node centre`, () => {
    // Given
    const scene = buildGroundBoundaryScene(fixture.state());

    // When
    const overlap = junctionOverlap(scene);

    // Then
    assert.ok(overlap.junctions > 0, "fixture has junctions");
    assert.equal(overlap.overlapPx, 0, JSON.stringify(overlap));
    assert.ok(overlap.beforeOverlapPx > 0, "control: chains drawn to the node centre (D1a) do overlap");
    assert.equal(overlap.armsReachCentre, true);
  });

  test(`Given ${fixture.name} When portals are measured Then the centreline stays within 0.15 tile of every bridge and gate axis and its tangent within 5 degrees`, () => {
    // Given
    const scene = buildGroundBoundaryScene(fixture.state());

    // When
    const rows = portalAlignment(scene);

    // Then
    for (const row of rows) {
      if (row.drawn === "plaza") { assert.equal(row.plazaCovered, true, JSON.stringify(row)); continue; }
      assert.ok(row.samples > 0, JSON.stringify(row));
      assert.ok(row.span >= 0.5, JSON.stringify(row));
      assert.ok(row.maxLateral <= 0.15, JSON.stringify(row));
      assert.ok(row.maxAngleDeg <= 5, JSON.stringify(row));
    }
  });

  test(`Given ${fixture.name} When walkers move along every road Then the drawn walker stays within 0.35 tile of the ribbon centreline`, () => {
    // Given
    const state = fixture.state();
    const scene = buildGroundBoundaryScene(state);

    // When
    const deviation = walkerDeviation(scene, state);

    // Then
    assert.ok(deviation.samples > 0);
    assert.ok(deviation.after <= 0.35, JSON.stringify(deviation));
    assert.ok(deviation.before > 0.35, "control: the cell-centre path leaves the ribbon at bends");
  });

  test(`Given ${fixture.name} When shoulder tufts are scattered Then no variant repeats within 4 tiles, spacing is 1 to 1.5 tiles and the two edges are out of phase`, () => {
    // Given / When
    const stats = shoulderStats(buildGroundBoundaryScene(fixture.state()));

    // Then
    assert.ok(stats.tufts > 0);
    assert.equal(stats.sameVariantWithin4, 0);
    assert.ok(stats.minSpacing >= SHOULDER_SPACING_MIN - 1e-9 && stats.maxSpacing <= SHOULDER_SPACING_MAX + 1e-9, JSON.stringify(stats));
    assert.ok(stats.sidesInPhase <= 0.3, JSON.stringify(stats));
  });
}

test("Given the fixed scene's bridge When the west bank's road is derived Then it runs straight on the deck axis into the deck start", () => {
  // Given
  const scene = buildGroundBoundaryScene(fixedSceneState());

  // When
  const bridges = portalAlignment(scene).filter(row => row.kind === "bridge");

  // Then
  assert.equal(bridges.length, 2);
  assert.ok(bridges.some(row => row.drawn === "chain" && row.span === 0.7 && row.maxLateral === 0 && row.maxAngleDeg === 0), JSON.stringify(bridges));
});

test("Given ribbon widths 0.55, 0.65 and 0.75 When the scene is rebuilt Then the centreline is unchanged, tufts move out with the edge and the road keys change", () => {
  // Given
  const state = fixedSceneState();
  const scenes = [0.55, 0.65, 0.75].map(width => { setRoadRibbonWidth(width); return buildGroundBoundaryScene(state); });
  setRoadRibbonWidth(ROAD_RIBBON_WIDTH);

  // Then
  const [narrow, middle, wide] = scenes as [ReturnType<typeof buildGroundBoundaryScene>, ReturnType<typeof buildGroundBoundaryScene>, ReturnType<typeof buildGroundBoundaryScene>];
  assert.deepEqual(middle.roads, narrow.roads);
  assert.deepEqual(wide.roads, narrow.roads);
  assert.deepEqual([narrow.ribbons.width, middle.ribbons.width, wide.ribbons.width], [0.55, 0.65, 0.75]);
  assert.notDeepEqual(wide.chunks.map(chunk => chunk.roadKey), narrow.chunks.map(chunk => chunk.roadKey));
  assert.equal(resolveRoadRibbonWidth("?road-ribbon-width=0.65"), 0.65);
  assert.equal(resolveRoadRibbonWidth("?road-ribbon-width=3"), 0.85);
  assert.equal(resolveRoadRibbonWidth(""), 0.65, "default width is 0.65 (owner decision, C1b)");
});

test("Given the earth strip sets When the choice changes Then one manifest line decides v3 or the alternating v2 pair and the road chunks re-key", () => {
  // Given
  const state = fixedSceneState();
  const v3 = buildGroundBoundaryScene(state);

  // When
  setRoadStripOverride("v2");
  const set = roadStripSet("earth");
  const v2 = buildGroundBoundaryScene(state);
  setRoadStripOverride(null);

  // Then
  assert.equal(ROAD_STRIP_CHOICE.earth, "v3", "owner decision RS1 (D3a): earth v3 by default");
  assert.deepEqual(set, ROAD_STRIP_SETS.earth.v2);
  assert.deepEqual(set.images, ["earth_strip_a_v2", "earth_strip_b_v2"]);
  assert.equal(set.rutContrast, 1, "v2 was painted with quiet ruts");
  assert.deepEqual(roadStripSet("earth"), ROAD_STRIP_SETS.earth.v3);
  assert.notDeepEqual(v2.chunks.map(chunk => chunk.roadKey), v3.chunks.map(chunk => chunk.roadKey));
  assert.deepEqual(v2.roads, v3.roads);
});

test("Given every fixture When the portal lock reshapes chain ends Then the D1a tolerance (0.25 tile outside the road cells) still holds", () => {
  for (const fixture of BOUNDARY_FIXTURES) {
    const road = roadCentrelineTolerance(buildGroundBoundaryScene(fixture.state()).roads, 0.25);
    assert.equal(road.over, 0, `${fixture.name}: ${JSON.stringify(road)}`);
  }
});

test("Given a walker stepping from a road into a building When it is drawn Then the pull fades to zero at the cell edge, and plazas and bridge decks are left alone", () => {
  // Given: the fixed scene's dead end at the south end of the long road (local 3,11) meets grass to the south.
  const state = fixedSceneState();
  const scene = buildGroundBoundaryScene(state);
  const index = alignmentIndex(scene.roads, state.width, state.height, state.tiles);
  const deadEnd = { tx: 36 + 3, ty: 50 + 11 };

  // When
  const atEdge = alignedRoadPosition(index, { tx: deadEnd.tx, ty: deadEnd.ty + 0.5 });
  const onDeck = { tx: 36 + 9, ty: 50 + 3 };

  // Then
  assert.deepEqual(atEdge, { tx: deadEnd.tx, ty: deadEnd.ty + 0.5 });
  assert.equal(alignedRoadPosition(index, onDeck), onDeck);
});
