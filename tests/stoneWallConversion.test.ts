import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import {
  createPalisadeConstructionSite,
  createStoneWallConstructionSite,
  isStoneWallConstructionSite,
  type ConstructionSite,
  type PalisadeConstructionSite,
  type StoneWallConstructionSite,
} from "../src/economy/construction";
import { palisadeConstructionSchedule } from "../src/economy/palisadeConstruction";
import { cancelConstruction } from "../src/engine/constructionCancellation";
import { advanceTick } from "../src/engine/tick";
import { confirmStoneTownProclamation } from "../src/engine/era";
import type { GameState, PalisadeSegment, PalisadeState } from "../src/engine/engine.types";
import { allocateBuildingAndConstructionLabour } from "../src/population/labour";
import type { House } from "../src/population/population.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { hashEconomyState } from "../scripts/economyHarness";
import { DELIVERY_INVENTORY, building as fixtureBuilding, line, routePort } from "./deliveryFixtures";

function building(id: string, kind: Building["kind"], tx: number, ty: number, patch: Partial<Building> = {}): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
    ...patch,
  };
}

function eligibilityBuildings(stone: number): readonly Building[] {
  return [
    building("home-a", "house", 5, 5),
    building("market-a", "market", 1, 1),
    building("masonry-a", "masonry", 3, 1),
    building("store-a", "storehouse", 0, 0, { inventory: { stone } }),
  ];
}

function house(residents: number): House {
  return {
    buildingId: "home-a",
    level: 0,
    residents,
    hasWater: false,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

function timberSite(index: number, patch: Partial<PalisadeConstructionSite> = {}): PalisadeConstructionSite {
  return {
    ...createPalisadeConstructionSite({
      id: `wall-a-segment-${String(index).padStart(3, "0")}`,
      wallId: "wall-a",
      segmentIndex: index,
      gateDistance: index === 0 ? 0 : index === 1 ? 4 : 8,
      order: index,
      path: [{ x: 2 + index, y: 2 }, { x: 3 + index, y: 2 }],
      startedTick: 0,
    }),
    ...patch,
  };
}

function stoneSite(index: number, patch: Partial<StoneWallConstructionSite> = {}): StoneWallConstructionSite {
  return {
    ...createStoneWallConstructionSite({
      id: `wall-a-segment-${String(index).padStart(3, "0")}-stone`,
      wallId: "wall-a",
      segmentIndex: index,
      gateDistance: index === 0 ? 0 : index === 1 ? 4 : 8,
      order: index,
      path: [{ x: 2 + index, y: 2 }, { x: 3 + index, y: 2 }],
      startedTick: 100,
    }),
    ...patch,
  };
}

function palisadeSegment(index: number, patch: Partial<PalisadeSegment> = {}): PalisadeSegment {
  const site = timberSite(index);
  return {
    id: site.id,
    order: site.order,
    gateDistance: site.gateDistance,
    edgePath: site.path,
    tileCount: 1,
    completed: true,
    constructionSiteId: null,
    material: "timber",
    replacementConstructionSiteId: null,
    ...patch,
  };
}

function palisade(segments: readonly PalisadeSegment[]): PalisadeState {
  return {
    id: "wall-a",
    polygon: [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 2 }],
    gate: { x: 2, y: 2 },
    segments,
  };
}

function state(patch: Partial<GameState> = {}): GameState {
  return {
    ...DEFAULT_GAME_STATE,
    tick: 100,
    wallTick: 100,
    era: "palisade",
    eraProclaimedTick: 10,
    population: 140,
    houses: [house(140)],
    treasuryCoin: 200,
    buildings: [...eligibilityBuildings(400)],
    constructionSites: [],
    palisade: palisade([palisadeSegment(0), palisadeSegment(1), palisadeSegment(2)]),
    ...patch,
  };
}

function coverageMaterial(segment: PalisadeSegment): "none" | "timber" | "stone" {
  if (!segment.completed) return "none";
  return segment.material ?? "timber";
}

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

test("Given an unfinished timber predecessor When proclaiming Stone Town Then the stone queue does not leapfrog behind it", () => {
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
  const afterOneTick = advanceTick({
    ...proclaimed,
    constructionSites: proclaimed.constructionSites.map((site) =>
      isStoneWallConstructionSite(site) ? { ...site, delivered: { stone: 25 }, assignedBuilders: 3 } : site,
    ),
    wallTick: 160,
  });

  // Then
  assert.deepEqual(proclaimed.constructionSites.map((site) => site.id), [
    "wall-a-segment-000",
    "wall-a-segment-000-stone",
    "wall-a-segment-001-stone",
  ]);
  assert.equal(proclaimed.palisade?.segments[0]?.replacementConstructionSiteId, "wall-a-segment-000-stone");
  assert.equal(proclaimed.palisade?.segments[1]?.replacementConstructionSiteId, "wall-a-segment-001-stone");
  assert.deepEqual(afterOneTick.constructionSites.map((site) => [site.id, site.builderTicks]), [
    ["wall-a-segment-000-stone", 0],
    ["wall-a-segment-001-stone", 0],
  ]);
  assert.equal(afterOneTick.palisade?.segments[0]?.completed, true);
  assert.equal(afterOneTick.palisade?.segments[0]?.material, "timber");
});

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

test("Given a Stone Town replacement site When cancellation is requested Then cancellation is a no-op", () => {
  // Given
  const target = stoneSite(0, { delivered: { stone: 10 }, reserved: { stone: 15 }, assignedBuilders: 3 });
  const current = state({
    era: "stone_town",
    constructionSites: [target],
    palisade: palisade([palisadeSegment(0, { replacementConstructionSiteId: target.id })]),
    buildings: [fixtureBuilding("store-a", "storehouse", { tx: 0, ty: 0 })],
  });

  // When
  const result = cancelConstruction({
    state: current,
    siteId: target.id,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({ "2,0->store-a": line([2, 0], [1, 0], [0, 0]) }),
  });

  // Then
  assert.equal(result.state, current);
  assert.deepEqual(result.ledger.deliveredRefund, {});
  assert.deepEqual(result.ledger.reservedRefund, {});
  assert.deepEqual(result.ledger.treasuryRefund, {});
  assert.deepEqual(result.ledger.dropped, {});
});

test("Given Stone Town labour reservation When mixed sites exist Then only the active stone wall site receives the fifty percent target", () => {
  // Given
  const farm = building("farm-a", "wheat_farm", 8, 8);
  const activeStone = stoneSite(0, { delivered: { stone: 25 } });
  const queuedStone = stoneSite(1, { delivered: { stone: 25 } });
  const arbitraryBuildingSite: ConstructionSite = {
    id: "construction-site-000009",
    kind: "market",
    tx: 10,
    ty: 10,
    required: {},
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 700,
    assignedBuilders: 0,
    stall: "no_builders",
    startedTick: 100,
  };

  // When
  const result = allocateBuildingAndConstructionLabour(
    [farm],
    [arbitraryBuildingSite, queuedStone, activeStone],
    20,
    { era: "stone_town", tick: 100, eraProclaimedTick: 100 },
  );

  // Then
  assert.equal(result.diagnostics.palisadeEraLabour.activeSiteId, activeStone.id);
  assert.deepEqual(result.constructionSites.map((site) => [site.id, site.assignedBuilders]), [
    ["construction-site-000009", 1],
    ["wall-a-segment-001-stone", 0],
    ["wall-a-segment-000-stone", 3],
  ]);
});
