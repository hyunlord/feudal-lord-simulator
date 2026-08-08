import assert from "node:assert/strict";
import test from "node:test";

import { palisadeConstructionSchedule } from "../src/economy/palisadeConstruction";
import { advanceTick } from "../src/engine/tick";
import { hashEconomyState } from "../scripts/economyHarness";
import { coverageMaterial, palisade, palisadeSegment, state, stoneSite, timberSite } from "./stoneWallConversionFixtures";

test("Given same-order timber and stone sites with reversed ids When scheduling Then timber explicitly blocks stone", () => {
  // Given
  const timber = timberSite(0, { id: "z-timber-segment", builderTicks: 119, delivered: { timber: 15 } });
  const stone = stoneSite(0, { id: "a-stone-segment", delivered: { stone: 25 } });

  // When
  const schedule = palisadeConstructionSchedule(stone, [stone, timber]);

  // Then
  assert.deepEqual(schedule, { kind: "queued", position: 1 });
});

test("Given queued stone sites with delivered material When ticking past five hundred frames Then only the active replacement makes builder progress", () => {
  // Given
  let current = state({
    era: "stone_town",
    eraProclaimedTick: 100,
    constructionSites: [
      stoneSite(0, { delivered: {}, assignedBuilders: 3, stall: "awaiting_materials" }),
      stoneSite(1, { delivered: { stone: 25 }, assignedBuilders: 3 }),
    ],
    palisade: palisade([
      palisadeSegment(0, { replacementConstructionSiteId: "wall-a-segment-000-stone" }),
      palisadeSegment(1, { replacementConstructionSiteId: "wall-a-segment-001-stone" }),
    ]),
  });

  // When
  for (let tick = 0; tick < 520; tick += 1) {
    current = advanceTick(current);
  }

  // Then
  assert.deepEqual(current.constructionSites.map((site) => [site.id, site.builderTicks]), [
    ["wall-a-segment-000-stone", 0],
    ["wall-a-segment-001-stone", 0],
  ]);
  current = {
    ...current,
    constructionSites: current.constructionSites.map((site) =>
      site.id === "wall-a-segment-000-stone" ? { ...site, delivered: { stone: 25 } } : site,
    ),
  };
  const delivered = advanceTick(current);
  assert.deepEqual(delivered.constructionSites.map((site) => [site.id, site.builderTicks]), [
    ["wall-a-segment-000-stone", 3],
    ["wall-a-segment-001-stone", 0],
  ]);
});

test("Given a completed timber segment under replacement When stone completes Then coverage never drops and the same segment atomically becomes stone", () => {
  // Given
  let current = state({
    era: "stone_town",
    eraProclaimedTick: 100,
    wallTick: 160,
    constructionSites: [stoneSite(0, {
      delivered: { stone: 25 },
      builderTicks: 199,
      assignedBuilders: 1,
    })],
    palisade: palisade([
      palisadeSegment(0, { replacementConstructionSiteId: "wall-a-segment-000-stone" }),
    ]),
  });
  const materials: Array<"none" | "timber" | "stone"> = [];

  // When
  materials.push(coverageMaterial(current.palisade?.segments[0] ?? palisadeSegment(0, { completed: false })));
  current = advanceTick(current);
  materials.push(coverageMaterial(current.palisade?.segments[0] ?? palisadeSegment(0, { completed: false })));

  // Then
  assert.deepEqual(materials, ["timber", "stone"]);
  assert.deepEqual(current.constructionSites, []);
  assert.deepEqual(current.palisade?.segments[0], {
    id: "wall-a-segment-000",
    order: 0,
    gateDistance: 0,
    edgePath: [{ x: 2, y: 2 }, { x: 3, y: 2 }],
    tileCount: 1,
    completed: true,
    constructionSiteId: null,
    material: "stone",
    replacementConstructionSiteId: null,
  });
});

test("Given every stone replacement completes When hashing final state Then all segments are stone and no replacement sites remain", () => {
  // Given
  let current = state({
    era: "stone_town",
    eraProclaimedTick: 100,
    wallTick: 160,
    constructionSites: [
      stoneSite(0, { delivered: { stone: 25 }, builderTicks: 200, assignedBuilders: 1 }),
      stoneSite(1, { delivered: { stone: 25 }, builderTicks: 200, assignedBuilders: 1 }),
    ],
    palisade: palisade([
      palisadeSegment(0, { replacementConstructionSiteId: "wall-a-segment-000-stone" }),
      palisadeSegment(1, { replacementConstructionSiteId: "wall-a-segment-001-stone" }),
    ]),
  });
  const beforeHash = hashEconomyState(current);

  // When
  current = advanceTick(current);

  // Then
  assert.notEqual(hashEconomyState(current), beforeHash);
  assert.deepEqual(current.constructionSites, []);
  assert.deepEqual(current.palisade?.segments.map((segment) => [segment.material, segment.replacementConstructionSiteId]), [
    ["stone", null],
    ["stone", null],
  ]);
});
