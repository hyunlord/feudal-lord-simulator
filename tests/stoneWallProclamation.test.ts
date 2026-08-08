import assert from "node:assert/strict";
import test from "node:test";

import { isStoneWallConstructionSite } from "../src/economy/construction";
import { advanceTick } from "../src/engine/tick";
import { confirmStoneTownProclamation } from "../src/engine/era";
import { palisade, palisadeSegment, state, stoneSite, timberSite } from "./stoneWallConversionFixtures";

test("Given an eligible completed palisade When proclaiming Stone Town Then deterministic stone replacement sites are queued for every segment", () => {
  // Given
  const eligible = state();

  // When
  const next = confirmStoneTownProclamation(eligible);

  // Then
  assert.equal(next.era, "stone_town");
  assert.equal(next.eraProclaimedTick, 100);
  assert.equal(next.constructionSites.length, 3);
  assert.equal(next.constructionSites.every(isStoneWallConstructionSite), true);
  const stoneSites = next.constructionSites.filter(isStoneWallConstructionSite);
  assert.equal(stoneSites.length, 3);
  assert.deepEqual(stoneSites.map((site) => site.id), [
    "wall-a-segment-000-stone",
    "wall-a-segment-001-stone",
    "wall-a-segment-002-stone",
  ]);
  assert.deepEqual(stoneSites.map((site) => site.required), [
    { stone: 25 },
    { stone: 25 },
    { stone: 25 },
  ]);
  assert.deepEqual(stoneSites.map((site) => site.requiredBuilderTicks), [200, 200, 200]);
  assert.deepEqual(stoneSites.map((site) => [site.order, site.gateDistance, site.wallId, site.segmentIndex]), [
    [0, 0, "wall-a", 0],
    [1, 4, "wall-a", 1],
    [2, 8, "wall-a", 2],
  ]);
  assert.deepEqual(next.palisade?.segments.map((segment) => ({
    id: segment.id,
    material: segment.material,
    completed: segment.completed,
    constructionSiteId: segment.constructionSiteId,
    replacementConstructionSiteId: segment.replacementConstructionSiteId,
  })), [
    { id: "wall-a-segment-000", material: "timber", completed: true, constructionSiteId: null, replacementConstructionSiteId: "wall-a-segment-000-stone" },
    { id: "wall-a-segment-001", material: "timber", completed: true, constructionSiteId: null, replacementConstructionSiteId: "wall-a-segment-001-stone" },
    { id: "wall-a-segment-002", material: "timber", completed: true, constructionSiteId: null, replacementConstructionSiteId: "wall-a-segment-002-stone" },
  ]);
});

test("Given an eligible malformed Stone Town state without a palisade When proclaiming Then Todo5 zero-site transition remains valid", () => {
  // Given
  const eligible = state({ palisade: null });

  // When
  const next = confirmStoneTownProclamation(eligible);

  // Then
  assert.equal(next.era, "stone_town");
  assert.equal(next.eraProclaimedTick, 100);
  assert.deepEqual(next.constructionSites, []);
  assert.equal(next.palisade, null);
});

test("Given an unfinished timber predecessor When proclaiming Stone Town Then only standing timber receives stone replacement", () => {
  // Given
  const unfinished = timberSite(0, {
    delivered: { timber: 15 },
    builderTicks: 119,
    assignedBuilders: 1,
  });
  const eligible = state({
    constructionSites: [unfinished],
    palisade: palisade([
      palisadeSegment(0, {
        completed: false,
        constructionSiteId: unfinished.id,
        material: "timber",
      }),
      palisadeSegment(1),
    ]),
  });

  // When
  const proclaimed = confirmStoneTownProclamation(eligible);
  // Then
  assert.deepEqual(proclaimed.constructionSites.map((site) => site.id), [
    "wall-a-segment-000",
    "wall-a-segment-001-stone",
  ]);
  assert.equal(proclaimed.palisade?.segments[0]?.replacementConstructionSiteId, null);
  assert.equal(proclaimed.palisade?.segments[1]?.replacementConstructionSiteId, "wall-a-segment-001-stone");
  assert.equal(proclaimed.palisade?.segments[0]?.completed, false);
  assert.equal(proclaimed.palisade?.segments[1]?.completed, true);
});

test("Given unfinished timber completes after Stone Town proclamation When ticking again Then its stone replacement is enqueued exactly once", () => {
  // Given
  const unfinished = timberSite(0, {
    delivered: { timber: 15 },
    builderTicks: 119,
    assignedBuilders: 1,
  });
  let current = state({
    constructionSites: [unfinished],
    palisade: palisade([
      palisadeSegment(0, {
        completed: false,
        constructionSiteId: unfinished.id,
        material: "timber",
      }),
      palisadeSegment(1),
    ]),
  });

  // When
  current = confirmStoneTownProclamation(current);
  current = advanceTick(current);
  const afterCompletion = current;
  current = advanceTick({
    ...current,
    constructionSites: current.constructionSites.map((site) =>
      isStoneWallConstructionSite(site) ? { ...site, delivered: { stone: 25 }, assignedBuilders: 3 } : site,
    ),
  });

  // Then
  assert.deepEqual(afterCompletion.constructionSites.map((site) => site.id), [
    "wall-a-segment-001-stone",
    "wall-a-segment-000-stone",
  ]);
  assert.equal(afterCompletion.constructionSites.filter((site) => site.id === "wall-a-segment-000-stone").length, 1);
  assert.deepEqual(afterCompletion.constructionSites.find((site) => site.id === "wall-a-segment-000-stone"), stoneSite(0, {
    startedTick: afterCompletion.tick,
  }));
  assert.equal(afterCompletion.palisade?.segments[0]?.completed, true);
  assert.equal(afterCompletion.palisade?.segments[0]?.material, "timber");
  assert.equal(afterCompletion.palisade?.segments[0]?.replacementConstructionSiteId, "wall-a-segment-000-stone");
  assert.equal(current.constructionSites.filter((site) => site.id === "wall-a-segment-000-stone").length, 1);
});
