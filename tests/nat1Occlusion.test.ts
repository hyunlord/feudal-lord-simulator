import assert from "node:assert/strict";
import { test } from "node:test";

import type { RenderQueueItem } from "../src/render/objectRenderOrder";
import { sortRenderItems } from "../src/render/objectRenderSort";
import { inFrontOfBox, occlusionFaults, placeWalkers } from "../src/render/walkerOcclusion";
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
  // Left: hands at a wall's own works, where a wall edge and a footprint disagree in their own order (the footprint wins).
  assert.ok(after.hidden.length <= 5, after.hidden.join(" "));
});
