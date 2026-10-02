import assert from "node:assert/strict";
import { test } from "node:test";

import type { RenderQueueItem } from "../src/render/objectRenderOrder";
import { sortRenderItems } from "../src/render/objectRenderSort";
import { inFrontOfBox, inGatePassage, occlusionFaults, placeWalkers } from "../src/render/walkerOcclusion";
import { advanceTick } from "../src/engine/tick";
import { walkerVisualAnchor } from "../src/render/walkerAnchor";
import { drawOrders, loadState } from "../scripts/nat1Occlusion";

// NAT-1: walkers drawn in the depth order of the buildings, sites and walls around them (the box rule,
// src/render/walkerOcclusion.ts), not all after them — the user's 1380 town had people standing on roofs.

/** A storehouse: a 2 × 2 footprint (buildingConfig). */
const building = (id: string, tx: number, ty: number) =>
  ({ kind: "building", id, building: { id, kind: "storehouse", tx, ty }, depth: tx + 1 + ty + 1, anchorTx: tx + 1 }) as unknown as RenderQueueItem;
const walker = (id: string, tx: number, ty: number) => {
  const anchor = walkerVisualAnchor({ tx, ty });
  return { kind: "walker", id, walker: { id, kind: "carter", position: { tx, ty }, path: [] }, depth: anchor.tx + anchor.ty, anchorTx: anchor.tx } as unknown as RenderQueueItem;
};
const order = (queue: readonly RenderQueueItem[]) => queue.map(item => item.id);
const noSites = { constructionSites: [] };

test("NAT-1 the box rule: in front of a footprint when past its far edge on either axis", () => {
  const box = { x0: 9.5, x1: 12.5, y0: 9.5, y1: 12.5 }; // a 3 × 3 building at (10, 10)
  assert.equal(inFrontOfBox({ tx: 12.6, ty: 10 }, box), true, "before its +x face");
  assert.equal(inFrontOfBox({ tx: 11, ty: 12.7 }, box), true, "before its +y face");
  assert.equal(inFrontOfBox({ tx: 11, ty: 9.2 }, box), false, "on the lane behind it");
  assert.equal(inFrontOfBox({ tx: 9.2, ty: 11 }, box), false, "behind its far side");
});

test("NAT-1 a walker before a building's side face is drawn after it; one on the lane behind before it", () => {
  // The scalar depth (tx + ty; the storehouse's front corner 11 + 11 = 22) put the walker at (11.8, 9.8) — its foot's
  // depth about 21.96 — first, under the building it stands in front of.
  const queue = sortRenderItems([building("hall", 10, 10), walker("front", 11.8, 9.8), walker("lane", 10.5, 8.8)]);
  assert.deepEqual(order(queue), ["lane", "front", "hall"], "the scalar order hides the one in front");
  const placed = placeWalkers(queue, noSites, () => false);
  assert.deepEqual(order(placed), ["lane", "hall", "front"]);
  assert.deepEqual(occlusionFaults(placed, noSites), { onRoof: [], hidden: [] });
  // Before NAT-1 every walker came after all the objects: the one on the lane stood on the roof.
  const deferred = [...queue.filter(item => item.kind !== "walker"), ...queue.filter(item => item.kind === "walker")];
  assert.deepEqual(occlusionFaults(deferred, noSites).onRoof, ["lane>hall"]);
});

test("NAT-1 walkers at a stone gate or on a bridge keep the queue's own place", () => {
  const queue = sortRenderItems([building("hall", 10, 10), walker("gate", 11.8, 9.8)]);
  assert.deepEqual(order(placeWalkers(queue, noSites, item => item.walker.id === "gate")), order(queue));
});

test("NAT-1 0 walkers on roofs in a real town (chapter-four-town fixture, the whole map, as the renderer builds the queue)", () => {
  const state = loadState("fixtures/saves/v31/chapter-four-town.save.json");
  const { deferred, placed, keepOrder, walkers } = drawOrders(state);
  assert.ok(walkers >= 30, `${walkers} walkers`);
  const before = occlusionFaults(deferred, state, keepOrder); const after = occlusionFaults(placed, state, keepOrder);
  assert.ok(before.onRoof.length > 100, `before NAT-1: ${before.onRoof.length} walker-object pairs on roofs`);
  assert.deepEqual(after.onRoof, []);
  // NAT-4: with the residents and the road ribbon (the walkers the screen draws) and the walls as drawn, none is left
  // under an object it stands in front of (the unit edges' lines left 15 at the market by the east wall).
  assert.ok(after.hidden.length <= 2, after.hidden.join(" "));
});

// NAT-4 QA-005 (Astra round 14, wall14 frames 19–22: a carter drawn over the town wall). The wall's depth test follows
// the wall as drawn: its face, half the wall's thickness toward the camera from the line (wallOcclusionEdges.ts).

/** A finished stone wall item along `edgePath` (edge points), at the queue depth `depth`. */
const wall = (id: string, edgePath: readonly { x: number; y: number }[], depth: number) =>
  ({ kind: "palisade_segment", id, segment: { id, edgePath, material: "stone", completed: true }, gate: null, depth, anchorTx: 0 }) as unknown as RenderQueueItem;

test("NAT-4 QA-005 a foot within the wall's thickness is behind it; past its face, in front", () => {
  // The wall along the tile y axis at edge x = 39: its line is x = 38.5 (tile centres), its face 38.65.
  const queue = [wall("wall", [{ x: 39, y: 36 }, { x: 39, y: 41 }], 0), walker("road", 38, 38), walker("child", 38.3, 38), walker("inside", 39, 38)];
  // The road just outside (foot 38.18) and a child walking beside an adult on the wall side (foot 38.48: the old test,
  // "within 0.2 of the line is in front", drew it over the wall) are behind; the lane inside (foot 39.18) in front.
  assert.deepEqual(order(placeWalkers(queue, noSites, () => false)), ["road", "child", "wall", "inside"]);
  // A wall across the view (x + y = 80 at tile centres): a foot above it on screen is behind, one below in front.
  const across = [wall("across", [{ x: 40, y: 41 }, { x: 41, y: 40 }], 0), walker("back", 39.6, 39.7), walker("front", 40.4, 40.3)];
  assert.deepEqual(order(placeWalkers(across, noSites, () => false)), ["back", "across", "front"]);
});

test("NAT-4 QA-005 a stone gate's passage is the four tiles at its point (tile-centre coordinates)", () => {
  const gate = [{ x: 47, y: 42 }];
  for (const tile of [{ tx: 46, ty: 41 }, { tx: 47, ty: 41 }, { tx: 46, ty: 42 }, { tx: 47, ty: 42 }]) assert.equal(inGatePassage(tile, gate), true);
  // The old disc (1.5 tiles about the edge point, half a tile off) took in walkers along the lane beside the gate.
  assert.equal(inGatePassage({ tx: 47.8, ty: 42.6 }, gate), false);
  assert.equal(inGatePassage({ tx: 45.5, ty: 41.0 }, gate), false);
});

test("NAT-4 QA-005 Astra's wall14 Roger (ch4-1380): on the road ribbon round the NW corner he is behind the wall", () => {
  let state = loadState("fixtures/perf-gate/ch4-1380.save.json.gz");
  const roger = "carter:construction-site-000048:319813";
  const corner = ["stone:39,39:39,40", "stone:39,40:39,41", "stone:39,41:40,41", "stone:40,41:41,42"];
  while (state.tick < 320052) {
    state = advanceTick(state);
    if (state.tick < 320040) continue;
    const { placed, keepOrder } = drawOrders(state);
    const at = placed.findIndex(item => item.kind === "walker" && item.walker.id === roger);
    const shown = placed[at]!.kind === "walker" ? (placed[at] as Extract<RenderQueueItem, { kind: "walker" }>).walker.position : null;
    const foot = walkerVisualAnchor(shown!);
    const after = corner.filter(id => placed.findIndex(item => item.id === id) < at);
    if (state.tick <= 320045) {
      // South of the corner, on the camera side of the wall's arm along x (the pillar's owner, 39,41:40,41): in front.
      assert.ok(after.includes("stone:39,41:40,41"), `${state.tick}: ${after.join(" ")}`);
    } else {
      // Up the wall's outside: the ribbon puts his foot inside the wall's thickness (the old test called it in front).
      assert.ok(foot.tx >= 38.5 - 0.2 && foot.tx < 38.65, `${state.tick}: foot ${foot.tx.toFixed(2)}`);
      assert.deepEqual(after, [], `${state.tick}: drawn after ${after.join(" ")}`);
    }
    const faults = occlusionFaults(placed, state, keepOrder);
    assert.deepEqual(faults.onRoof, [], `${state.tick}`);
    assert.ok(faults.hidden.length <= 3, `${state.tick}: ${faults.hidden.join(" ")}`);
  }
});
