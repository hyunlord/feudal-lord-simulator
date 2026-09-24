import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { buildGroundBoundaryScene } from "../src/render/groundBoundaryScene";
import { placementPreview, resolveBuildingPlacementAttempt } from "../src/render/interactions";
import { applyZoneBrushIntent, gestureStroke, nextBrushRadius, type ZoneBrushTool } from "../src/render/zoneBrushInteraction";
import { gameReducer } from "../src/state/gameStore";
import { zoneBoundaryLayout } from "../src/world/boundary/zoneBoundaries";
import { zonePaintAssessment } from "../src/zones/zoneEdits";
import { ZonePlacementFailure } from "../src/zones/zonePlacement";
import { seedGroundState } from "../scripts/boundaryFixtureStates";

// C1b zone brush: shared outlines (gate 2), the brush intent reducer, and the zone-aware placement preview.

const paint = (state: GameState, tool: ZoneBrushTool, points: readonly { x: number; y: number }[]): GameState => {
  let gesture = applyZoneBrushIntent({ state, tool, gesture: null, intent: { type: "strokeBegin", point: points[0]! } }).gesture;
  for (const point of points.slice(1)) gesture = applyZoneBrushIntent({ state, tool, gesture, intent: { type: "strokeMove", point } }).gesture;
  const outcome = applyZoneBrushIntent({ state, tool, gesture, intent: { type: "strokeEnd" } });
  return outcome.action === null ? state : gameReducer(state, outcome.action);
};
// The long curved road outside the seed 2 wall runs (36,39) -> (43,47); plots go on its south-west side.
const ROAD_SIDE = [[36, 39], [37, 40], [38, 41], [39, 42], [39, 43], [40, 44], [41, 45], [42, 46]].map(([x, y]) => ({ x: x! - 1.3 + 0.5, y: y! + 1.3 + 0.5 }));
const BURGAGE: ZoneBrushTool = { target: "burgage", radius: 2, polygon: false };

test("Given three labelled regions When their outline is derived Then every boundary edge belongs to exactly one chain and each zone's rings are stitched from those chains", () => {
  // Given: A and B touch along an edge, C only touches B diagonally.
  const rows = ["......", ".AAB..", ".AABB.", "..A.BC", "......"];
  const width = 6; const height = rows.length;
  const labels = new Int32Array(width * height).fill(-1);
  rows.forEach((row, y) => [...row].forEach((c, x) => { labels[y * width + x] = c === "." ? -1 : c.charCodeAt(0) - 65; }));

  // When
  const layout = zoneBoundaryLayout({ width, height, labels, zoneCount: 3 });

  // Then: the chains cover every boundary edge of the grid exactly once (no edge is drawn twice), and the A|B line
  // is one chain labelled [0,1].
  let edges = 0;
  const label = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height ? -1 : labels[y * width + x];
  for (let y = 0; y <= height; y += 1) for (let x = 0; x <= width; x += 1) {
    if (label(x, y) !== label(x - 1, y)) edges += y < height ? 1 : 0;
    if (label(x, y) !== label(x, y - 1)) edges += x < width ? 1 : 0;
  }
  assert.equal(layout.chains.reduce((sum, chain) => sum + chain.edges, 0), edges);
  assert.equal(layout.chains.filter(chain => chain.labels[0] === 0 && chain.labels[1] === 1).length, 1);
  assert.deepEqual(layout.rings.map(rings => rings.length), [1, 1, 1]);
  // Every ring point is a point of some chain (rings reuse the smoothed chains; no private copy that could drift).
  const chainPoints = new Set(layout.chains.flatMap(chain => chain.points.map(point => `${point.x},${point.y}`)));
  for (const rings of layout.rings) for (const ring of rings) for (const point of ring) assert.ok(chainPoints.has(`${point.x},${point.y}`));
});

test("Given a painted seed 2 town When the scene is built from tiles in reverse order Then zone outlines, plots and props are identical", () => {
  // Given
  let state = paint(seedGroundState(2), BURGAGE, ROAD_SIDE);
  state = paint(state, { target: "pasture", radius: 2, polygon: false }, [{ x: 30, y: 44 }, { x: 31, y: 46 }]);
  assert.ok((state.zones ?? []).length >= 2);

  // When
  const forward = buildGroundBoundaryScene(state, false);
  const reversed = buildGroundBoundaryScene(state, true);

  // Then
  assert.equal(JSON.stringify(reversed.zones), JSON.stringify(forward.zones));
  assert.ok(forward.zones.parcelEdges.length > 0, "plots are drawn");
  assert.ok(forward.zones.frontage.length > 0, "frontage marks are drawn");
  assert.ok(forward.zones.props.some(prop => prop.kind.startsWith("haycock")), "pasture gets haycocks");
});

test("Given the plot brush along the curved road When the stroke ends Then one zone_paint is sent and the result equals its preview", () => {
  // Given
  const state = seedGroundState(2);

  // When
  const next = paint(state, BURGAGE, ROAD_SIDE);

  // Then
  const zones = next.zones ?? [];
  assert.equal(zones.length, 1);
  const preview = zonePaintAssessment(state, "burgage", { tool: "brush", points: ROAD_SIDE, radius: 2 });
  assert.ok(preview.ok);
  assert.deepEqual(zones[0]!.membership, preview.cells);
});

test("Given the arable brush inside the wall When the stroke ends Then nothing is sent and the refusal says why", () => {
  // Given: (55,30) is inside the seed 2 wall.
  const state = seedGroundState(2);
  const tool: ZoneBrushTool = { target: "arable", radius: 1, polygon: false };
  const begin = applyZoneBrushIntent({ state, tool, gesture: null, intent: { type: "strokeBegin", point: { x: 55.5, y: 30.5 } } });

  // When
  const end = applyZoneBrushIntent({ state, tool, gesture: begin.gesture, intent: { type: "strokeEnd" } });

  // Then
  assert.equal(end.action, null);
  assert.equal(end.message?.kind, "failure");
  assert.match(end.message?.text ?? "", /성내 경작지 금지/);
});

test("Given a polygon of four clicks When it is closed Then one polygon stroke is painted; Given the eraser Then the cells leave the zone", () => {
  // Given
  const state = seedGroundState(2);
  const tool: ZoneBrushTool = { target: "orchard", radius: 2, polygon: true };
  let gesture = null as ReturnType<typeof applyZoneBrushIntent>["gesture"];
  for (const point of [{ x: 20, y: 40 }, { x: 24, y: 40 }, { x: 24, y: 44 }, { x: 20, y: 44 }]) {
    gesture = applyZoneBrushIntent({ state, tool, gesture, intent: { type: "polygonPoint", point } }).gesture;
  }

  // When
  const closed = applyZoneBrushIntent({ state, tool, gesture, intent: { type: "polygonClose" } });
  const painted = gameReducer(state, closed.action!);
  const erased = paint(painted, { target: "erase", radius: 1, polygon: false }, [{ x: 22, y: 42 }]);

  // Then
  assert.equal(closed.action?.type, "zone_paint");
  assert.equal(painted.zones?.[0]?.membership.length, 16);
  assert.ok((erased.zones?.[0]?.membership.length ?? 0) < 16);
  assert.equal(nextBrushRadius(3, 1), 3);
  assert.equal(nextBrushRadius(1, -1), 1);
  assert.equal(gestureStroke(tool, null, { x: 1, y: 1 }), null, "polygon mode has no hover dab");
});

test("Given a plot zone When a house is previewed inside and outside it Then inside is allowed and outside is refused as outside the zone", () => {
  // Given
  const state = paint(seedGroundState(2), BURGAGE, ROAD_SIDE);
  const inside = (state.zones?.[0]?.membership ?? []).map(cell => ({ tx: cell % state.width, ty: Math.floor(cell / state.width) }))
    .find(tile => placementPreview(state, "house", tile, null).ok);

  // When
  const outside = placementPreview(state, "house", { tx: 10, ty: 50 }, null);
  const attempt = resolveBuildingPlacementAttempt({ state, tool: "house", tile: { tx: 10, ty: 50 }, nowMs: 0 });

  // Then
  assert.ok(inside !== undefined, "some plot cell takes a house");
  assert.equal(outside.ok, false);
  assert.equal(outside.reason, ZonePlacementFailure.outside_zone);
  assert.equal(outside.zoneRule, "burgage");
  assert.equal(attempt.action, null);
  assert.match(attempt.feedback.message, /필지 구역 밖/);
});
