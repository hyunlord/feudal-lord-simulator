import assert from "node:assert/strict";
import test from "node:test";

import type { BuildingConstructionSite } from "../src/economy/construction";
import {
  createConstructionCompletionTracker,
  constructionCompletionEffectsForFrame,
} from "../src/render/drawConstructionSites";
import { drawPalisadeSegment } from "../src/render/drawPalisadeSegments";

function postContext(calls: string[]): CanvasRenderingContext2D {
  return {
    fillStyle: "",
    lineWidth: 0,
    strokeStyle: "",
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    strokeRect: () => undefined,
  } as unknown as CanvasRenderingContext2D;
}

function site(): BuildingConstructionSite {
  return {
    id: "construction-site-000001",
    kind: "storehouse",
    tx: 2,
    ty: 1,
    required: { timber: 40 },
    delivered: { timber: 40 },
    reserved: {},
    builderTicks: 800,
    requiredBuilderTicks: 800,
    assignedBuilders: 0,
    stall: "none",
    startedTick: 0,
  };
}

test("completed posts follow cumulative distance around a bent wall path", () => {
  const calls: string[] = [];
  drawPalisadeSegment(postContext(calls), {
    segment: {
      id: "wall-a-segment-bent",
      order: 1,
      edgePath: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 2, y: 4 },
      ],
      tileCount: 4,
      completed: true,
      constructionSiteId: null,
    },
    gate: null,
    zoom: 1,
  });

  assert.deepEqual(calls, [
    "fillRect:12,-4,8,30",
    "fillRect:12,12,8,30",
    "fillRect:-20,28,8,30",
    "fillRect:-52,44,8,30",
  ]);
});

test("construction completion histories remain isolated per canvas tracker", () => {
  const first = createConstructionCompletionTracker();
  const second = createConstructionCompletionTracker();
  assert.deepEqual(constructionCompletionEffectsForFrame(first, [site()], 0), []);
  assert.deepEqual(constructionCompletionEffectsForFrame(first, [], 10), [
    { id: "construction-site-000001", tx: 2, ty: 1, ageMs: 0 },
  ]);
  assert.deepEqual(constructionCompletionEffectsForFrame(second, [], 10), []);
});
