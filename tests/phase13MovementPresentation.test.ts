import assert from "node:assert/strict";
import test from "node:test";

import type { BuildingConstructionSite } from "../src/economy/construction";
import {
  interpolatedConstructionProgress,
} from "../src/render/constructionInterpolation";
import { snapPointToDevicePixel } from "../src/render/style";
import {
  createResourceCounterTween,
  resourceCounterValues,
  retargetResourceCounterTween,
} from "../src/ui/resourceCounterTween";

const site = (
  id: string,
  builderTicks: number,
  requiredBuilderTicks = 100,
): BuildingConstructionSite => ({
  id,
  kind: "house",
  tx: 1,
  ty: 1,
  required: { timber: 10 },
  delivered: { timber: 10 },
  reserved: {},
  builderTicks,
  requiredBuilderTicks,
  assignedBuilders: 1,
  stall: "none",
  startedTick: 0,
});

test("walker anchors snap after camera transform so zoom never amplifies a pixel jump", () => {
  const transform = { a: 2, b: 0, c: 0, d: 2, e: 0.3, f: 0.7 };
  const anchors = [0.1, 0.3, 0.5, 0.7, 0.9].map((x) =>
    snapPointToDevicePixel({ x, y: x }, transform),
  );
  const deviceX = anchors.map(({ x }) => Math.round((transform.a * x) + transform.e));
  const deviceSteps = deviceX.slice(1).map((value, index) => value - (deviceX[index] ?? 0));

  assert.ok(deviceSteps.every((step) => Math.abs(step) <= 1));
  assert.deepEqual(deviceX, [1, 1, 1, 2, 2]);
});

test("construction progress interpolates matched sites without changing simulation state", () => {
  const previous = site("site-a", 20);
  const current = site("site-a", 24);

  const progress = interpolatedConstructionProgress({
    previous: [previous],
    current: [current],
    alpha: 0.5,
  });

  assert.equal(progress.get("site-a"), 0.22);
  assert.equal(previous.builderTicks, 20);
  assert.equal(current.builderTicks, 24);
});

test("new construction sites render their current progress and invalid alpha clamps", () => {
  const current = site("site-new", 10);

  assert.equal(interpolatedConstructionProgress({
    previous: [],
    current: [current],
    alpha: 0,
  }).get("site-new"), 0.1);
  assert.equal(interpolatedConstructionProgress({
    previous: [site("site-new", 0)],
    current: [current],
    alpha: Number.NaN,
  }).get("site-new"), 0.1);
});

test("resource counters expose intermediate values for 300ms before reaching the target", () => {
  const initial = createResourceCounterTween({ timber: 10, bread: 2 }, 1_000);
  const changed = retargetResourceCounterTween(initial, { timber: 20, bread: 8 }, 1_100);

  assert.deepEqual(resourceCounterValues(changed, 1_100), { timber: 10, bread: 2 });
  const halfway = resourceCounterValues(changed, 1_250);
  const halfwayTimber = halfway.timber;
  const halfwayBread = halfway.bread;
  if (halfwayTimber === undefined || halfwayBread === undefined) {
    throw new Error("resource counter tween omitted a requested value");
  }
  assert.ok(halfwayTimber > 10 && halfwayTimber < 20);
  assert.ok(halfwayBread > 2 && halfwayBread < 8);
  assert.deepEqual(resourceCounterValues(changed, 1_400), { timber: 20, bread: 8 });
});

test("one-unit resource changes remain pending until the 300ms tween completes", () => {
  const initial = createResourceCounterTween({ timber: 10, bread: 3 }, 1_000);
  const changed = retargetResourceCounterTween(initial, { timber: 11, bread: 2 }, 1_100);

  assert.deepEqual(resourceCounterValues(changed, 1_200), { timber: 10, bread: 3 });
  assert.deepEqual(resourceCounterValues(changed, 1_300), { timber: 10, bread: 3 });
  assert.deepEqual(resourceCounterValues(changed, 1_400), { timber: 11, bread: 2 });
});
