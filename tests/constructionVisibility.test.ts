import assert from "node:assert/strict";
import { test } from "node:test";

import { createConstructionSite } from "../src/economy/construction";
import {
  constructionBarCells, constructionBlocker, constructionPileLevels, constructionStageIndex, shownConstructionArrival,
} from "../src/render/constructionVisibility";
import { COMPLETION_SEQUENCE_MS, constructionCompletionEffectsForFrame, createConstructionCompletionTracker } from "../src/render/constructionCompletionEffects";
import { setPresentationSpeed } from "../src/render/presentationSpeed";
import { calendarArrivalLabel } from "../src/ui/calendarArrival";

const barn = (patch: Record<string, unknown> = {}) => ({ ...createConstructionSite({ ordinal: 7, kind: "farmstead", tx: 4, ty: 4, startedTick: 0 }), ...patch });

test("F0-V piles: the delivered share sets 1-3 levels in the materials phase (0-30 / 30-70 / 70-100 %), each stage uses one up", () => {
  assert.deepEqual(constructionPileLevels(barn({ delivered: {} }), 0), { wood: 0, stone: 0 });
  assert.deepEqual(constructionPileLevels(barn({ delivered: { timber: 4 } }), 0), { wood: 1, stone: 0 });
  assert.deepEqual(constructionPileLevels(barn({ delivered: { timber: 12 } }), 0), { wood: 2, stone: 0 });
  assert.deepEqual(constructionPileLevels(barn({ delivered: { timber: 16 } }), 0), { wood: 3, stone: 0 });
  const full = barn({ delivered: { timber: 20 } });
  assert.deepEqual([0, 0.3, 0.6, 0.9].map(progress => constructionPileLevels(full, progress).wood), [3, 2, 1, 0]);
});

test("F0-V bar: four cells on the stage boundaries 25 / 55 / 85 %, the stage index changes at the same thresholds", () => {
  assert.deepEqual(constructionBarCells(0.25), [1, 0, 0, 0]);
  assert.deepEqual(constructionBarCells(0.4).map(value => Math.round(value * 100)), [100, 50, 0, 0]);
  assert.deepEqual(constructionBarCells(1), [1, 1, 1, 1]);
  assert.deepEqual([0.24, 0.25, 0.549, 0.55, 0.85].map(constructionStageIndex), [0, 1, 1, 2, 3]);
});

test("F0-V blocker: road cut, no material in store and no builders each have their icon; material on the way is no blocker", () => {
  assert.equal(constructionBlocker(barn(), "no_route"), "road");
  assert.equal(constructionBlocker(barn(), "no_material_source"), "materials");
  assert.equal(constructionBlocker(barn(), "no_builders"), "workers");
  assert.equal(constructionBlocker(barn(), "awaiting_materials"), null);
  assert.equal(constructionBlocker(barn(), "none"), null);
});

test("F0-V arrival: work-phase only, from the builders' ticks left, and the shown arrival never moves later", () => {
  const working = barn({ id: "construction-site-000901", delivered: { timber: 20 }, builderTicks: 100, assignedBuilders: 3, stall: "none" });
  assert.equal(shownConstructionArrival(barn({ id: "construction-site-000902" }), 50), null, "materials phase: no time, the owed material instead");
  const first = shownConstructionArrival(working, 200)!;
  assert.equal(first, 200 + 100);
  const slowed = shownConstructionArrival({ ...working, assignedBuilders: 1 }, 210)!;
  assert.equal(slowed, first, "one builder left would be later: the plaque keeps the earlier point");
  assert.ok(shownConstructionArrival({ ...working, builderTicks: 380, assignedBuilders: 3 }, 220)! < first);
});

test("F0-V calendar arrival: soon, season thirds, next year, never ticks or seconds", () => {
  assert.equal(calendarArrivalLabel(0, 20, 1300), "곧");
  assert.equal(calendarArrivalLabel(0, 900, 1300), "봄 말쯤");
  assert.equal(calendarArrivalLabel(0, 1_100, 1300), "여름 초쯤");
  assert.equal(calendarArrivalLabel(3_900, 4_500, 1300), "내년 봄 중순쯤");
  for (const label of [calendarArrivalLabel(0, 900, 1300), calendarArrivalLabel(0, 50_000, 1300)]) assert.doesNotMatch(label, /틱|초\b|분/);
});

test("F0-V completion sequence: 1.2 s at 1x, only the 0.4 s dust at 5x", () => {
  const site = createConstructionSite({ ordinal: 3, kind: "well", tx: 2, ty: 2, startedTick: 0 });
  for (const [speed, lasts] of [[1, COMPLETION_SEQUENCE_MS], [5, 400]] as const) {
    setPresentationSpeed(speed);
    const tracker = createConstructionCompletionTracker();
    constructionCompletionEffectsForFrame(tracker, [site], 0, []);
    assert.equal(constructionCompletionEffectsForFrame(tracker, [], 10, [site.id]).length, 1);
    assert.equal(constructionCompletionEffectsForFrame(tracker, [], lasts - 1, [site.id]).length, 1);
    assert.equal(constructionCompletionEffectsForFrame(tracker, [], lasts + 11, [site.id]).length, 0);
  }
  setPresentationSpeed(1);
});
