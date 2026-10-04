import assert from "node:assert/strict";
import test from "node:test";

import { recordingCanvas } from "../scripts/recordingCanvas";
import { palisade, palisadeSegment } from "./stoneWallConversionFixtures";
import { drawWallModules, FACE_HEIGHT } from "../src/render/drawWallFaces";
import { cornerGateModules } from "../src/render/gateCornerModules";
import { drawGateArtPosts, gateArmPosts, gateArtPostArms, gatePostArms, gatePostPoint, gatePostWidth, GATE_POST_HEIGHT, isGateEnd } from "../src/render/gateOpeningPosts";
import { tileToScreen } from "../src/render/iso";
import { setShoreAssetsForTest } from "../src/render/terrainVariantAssets";
import { TERRAIN_VARIANT_ASSETS, WALL_FACE_KEYS } from "../src/render/terrainVariantManifest";
import { unitEdgeKey, wallBaselines, type WallNode } from "../src/world/boundary/wallBaseline";
import { GATE_HALF_CLEARANCE } from "../src/world/wallTraversal";
import type { TileEdgePoint } from "../src/world/palisadeGeometry";

// QA-003 gate posts: a palisade gate's every arm ends in a doubled post cut from the face strip, a stone corner gate's
// off-axis arm in the stone jamb; plain ends, towers and bends draw what they drew before.
setShoreAssetsForTest(Object.fromEntries(WALL_FACE_KEYS.map(key => {
  const asset = TERRAIN_VARIANT_ASSETS.find(candidate => candidate.key === key)!;
  return [key, { label: key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height } as unknown as HTMLImageElement];
})));

const P = { x: 5, y: 2 };
const at = (dx: number, dy: number) => ({ x: P.x + dx, y: P.y + dy });
const tiles = Array.from({ length: 144 }, (_, index) => ({ tx: index % 12, ty: Math.floor(index / 12), terrain: "grass" as const, buildingId: null, hasRoad: false }));
const wallOf = (material: "timber" | "stone", paths: readonly (readonly TileEdgePoint[])[], gate: TileEdgePoint = P) =>
  wallBaselines({ ...palisade(paths.map((edgePath, order) => palisadeSegment(order, { material, edgePath: [...edgePath] }))), gate }, { width: 12, height: 12, tiles });
const gateNode = (walls: ReturnType<typeof wallOf>) => walls.nodes.find(node => node.kind === "gate") as WallNode;
const legacy = (node: WallNode) => ({ point: node.point, neighbors: node.neighbors, kind: "gate" as const });
const draws = (nodes: readonly WallNode[], material: "timber" | "stone") => {
  const recording = recordingCanvas(1024, 1024);
  drawWallModules(recording.context, nodes, [], material, 1);
  return recording.canvas.ops.filter(op => op.startsWith("drawImage(") || op.startsWith("fillRect("));
};
const faceCrops = (ops: readonly string[]) => ops.filter(op => op.startsWith("drawImage(palisade_face_v2_a,238,"));

test("Given a straight palisade gate When its arms' items draw their modules Then each arm draws one door post, and the gate's owner draws the art and both posts", () => {
  // Given: a straight wall along y = 2 with the gate in its middle.
  const walls = wallOf("timber", [[at(-3, 0), P], [P, at(3, 0)]]);
  const node = gateNode(walls);
  const west = unitEdgeKey(P, at(-1, 0)); const east = unitEdgeKey(P, at(1, 0));

  // When / Then: both arms are the art's (no corner modules), one post each on its own item.
  assert.equal(cornerGateModules(node, west), null);
  assert.equal(gateArtPostArms(legacy(node)).length, 2);
  for (const key of [west, east]) {
    const posts = gateArmPosts(node, key);
    assert.equal(posts.length, 1, key);
    assert.ok(posts.every(isGateEnd) && posts[0]!.gate === node.point);
    assert.equal(faceCrops(draws(posts, "timber")).length, 3, "one post: tips, plain stake, rails");
  }
  assert.deepEqual(gateArmPosts(node, unitEdgeKey(at(-2, 0), at(-1, 0))), [], "a farther edge draws none");
  // The gate's owner draws both posts after the art (drawGateArtPosts); in Node the gate art is not loaded, so here it is
  // the fallback marker, whose piers are the same door posts instead of its plain posts.
  const art = recordingCanvas(1024, 1024);
  drawGateArtPosts(art.context, legacy(node), FACE_HEIGHT);
  assert.equal(faceCrops(art.canvas.ops).length, 6);
  const owner = draws([node], "timber");
  assert.equal(faceCrops(owner).length, 6);
  assert.ok(!owner.some(op => op.startsWith("fillRect(")), "no plain post");
});

test("Given a palisade corner gate When the items draw Then the axis arm draws its post, the diagonal arm's end module is the doubled post", () => {
  // Given: the 1380 town's spike (an edge row arm and a diagonal arm), built of timber.
  const walls = wallOf("timber", [[P, at(-3, 0)], [at(-3, 3), P]]);
  const node = gateNode(walls);
  const axisKey = unitEdgeKey(P, at(-1, 0)); const offKey = unitEdgeKey(P, at(-1, 1));

  // When
  const axis = gateArmPosts(node, axisKey);
  const off = cornerGateModules(node, offKey) ?? [];

  // Then
  assert.deepEqual(gateArtPostArms(legacy(node)), [at(-1, 0)]);
  assert.equal(axis.length, 1);
  assert.deepEqual(gateArmPosts(node, offKey), [], "the diagonal arm keeps its corner-gate end module");
  assert.equal(off.length, 1);
  assert.ok(isGateEnd(off[0]!));
  const ops = draws(off, "timber");
  assert.equal(faceCrops(ops).length, 3);
  assert.ok(!ops.some(op => op.startsWith("fillRect(")), "no plain post under it");
});

test("Given stone gates When the items draw Then a corner gate's off-axis end is the jamb on its record's pivot, and no arm draws a door post", () => {
  const straight = gateNode(wallOf("stone", [[at(-3, 0), P], [P, at(3, 0)]]));
  for (const arm of [at(-1, 0), at(1, 0)]) assert.deepEqual(gateArmPosts(straight, unitEdgeKey(P, arm)), []);
  const corner = gateNode(wallOf("stone", [[P, at(-3, 0)], [at(-3, 3), P]]));
  const [jamb] = cornerGateModules(corner, unitEdgeKey(P, at(-1, 1))) ?? [];
  assert.ok(jamb !== undefined && isGateEnd(jamb));
  // The pier (0.95 out along the diagonal) is the jamb's foot: canvas 64 x 80 at scale 0.5 about the pivot (32, 70).
  const foot = tileToScreen(P.x - 0.95, P.y + 0.95);
  const ops = draws([jamb], "stone");
  assert.deepEqual(ops, [`drawImage(gate_jamb_stone,0,0,64,80,${+(foot.sx - 16).toFixed(3)},${+(foot.sy - 16 - 35).toFixed(3)},32,40)`]);
});

test("Given plain ends, towers and bends When their modules draw Then no door post: the plain post, nothing, and the pillars as before", () => {
  // Given: an open palisade (two plain ends) round a 90 degree corner and a 135 degree bend, no gate on it.
  const walls = wallOf("timber", [[at(-3, 0), P, at(0, 3), at(1, 4), at(1, 6)]], { x: -9, y: -9 });

  // When
  const kinds = new Set(walls.nodes.map(node => node.kind));
  const keys = [...walls.chains.flatMap(chain => [...chain.edges.keys()])];

  // Then
  assert.ok(kinds.has("terminal"), "plain ends");
  assert.ok(!kinds.has("gate"));
  for (const node of walls.nodes) for (const key of keys) assert.deepEqual(gateArmPosts(node, key), []);
  const terminal = walls.nodes.filter(node => node.kind === "terminal");
  const ops = draws(terminal, "timber");
  assert.equal(faceCrops(ops).length, 0, "a plain end keeps its plain post");
  assert.ok(ops.some(op => op.startsWith("fillRect(")));
  assert.ok(kinds.has("tower") && walls.pillars.length > 0, "a 90 degree corner and a 135 degree bend");
  assert.deepEqual(draws(walls.nodes.filter(node => node.kind === "tower"), "timber"), [], "the joined band turns by itself (N5-W2)");
  const bends = recordingCanvas(1024, 1024);
  drawWallModules(bends.context, [], walls.pillars, "timber", 1);
  assert.equal(faceCrops(bends.canvas.ops).length, 0);
});

test("Given an arm When its door post is placed Then its opening side stands on the strip's cut end (end-on: on the end)", () => {
  const half = gatePostWidth(FACE_HEIGHT) / 2;
  const screenX = (point: TileEdgePoint) => tileToScreen(point.x, point.y).sx;
  for (const arm of [at(-1, 0), at(1, 0), at(0, -1), at(0, 1), at(-1, 1), at(1, -1)]) {
    const end = { x: P.x + (arm.x - P.x) * GATE_HALF_CLEARANCE, y: P.y + (arm.y - P.y) * GATE_HALF_CLEARANCE };
    const post = gatePostPoint(P, arm, FACE_HEIGHT);
    assert.ok(Math.abs(Math.abs(screenX(post) - screenX(end)) - half) < 1e-9, JSON.stringify(arm));
    assert.ok(Math.abs(screenX(post) - screenX(P)) > Math.abs(screenX(end) - screenX(P)), "set in from the cut end, away from the opening");
  }
  for (const arm of [at(-1, -1), at(1, 1)]) {
    const end = { x: P.x + (arm.x - P.x) * GATE_HALF_CLEARANCE, y: P.y + (arm.y - P.y) * GATE_HALF_CLEARANCE };
    assert.deepEqual(gatePostPoint(P, arm, FACE_HEIGHT), end, "seen end-on");
  }
  // A point farther along the arm gives the same post (only the arm's direction counts).
  assert.deepEqual(gatePostPoint(P, at(-0.95, 0), FACE_HEIGHT), gatePostPoint(P, at(-1, 0), FACE_HEIGHT));
  assert.ok(gatePostWidth(FACE_HEIGHT) > 2 * 14 * FACE_HEIGHT / 128, "wider than two stakes");
  assert.ok(GATE_POST_HEIGHT > 1, "taller than the face");
  // A shared opening's half has no post.
  assert.deepEqual(gatePostArms({ point: P, neighbors: [at(-1, 0), at(1, 0)], kind: "gate", clearanceGates: [at(1, 0)] }), [at(-1, 0)]);
});
