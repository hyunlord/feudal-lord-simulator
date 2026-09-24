import assert from "node:assert/strict";
import test from "node:test";
import type { Building, BuildingKind } from "../src/content/buildingConfig";
import type { BuildingConstructionSite } from "../src/domain/constructionSite";
import { allocateBuildingAndConstructionLabour, allocateBuildingLabour, availableWorkers } from "../src/population/labour";

const building = (id: string, kind: BuildingKind): Building => ({ id, kind, tx: 0, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 });
const site = (id: string, delivered = 10): BuildingConstructionSite => ({ id, kind: "well", tx: 0, ty: 0, required: { timber: 10 }, delivered: { timber: delivered }, reserved: {}, builderTicks: 0, requiredBuilderTicks: 20, assignedBuilders: 0, stall: "awaiting_materials", startedTick: 0 });
const food = [building("z-farm", "wheat_farm"), building("y-mill", "mill"), building("x-granary", "granary")];

test("food chain wins scarce labour regardless of lexical industry ids and input order", () => {
  // Given
  const buildings = [building("a-quarry", "quarry"), ...food];
  // When
  const forward = allocateBuildingLabour(buildings, 16);
  const reversed = allocateBuildingLabour([...buildings].reverse(), 16);
  // Then
  assert.deepEqual(forward.buildings.map(({ workers }) => workers), [0, 4, 2, 2]);
  assert.deepEqual([...reversed.buildings].reverse(), forward.buildings);
});

test("ready ordinary construction reserves three workers before production", () => {
  // Given
  const buildings = [...food, building("a-quarry", "quarry")];
  // When
  const result = allocateBuildingAndConstructionLabour(buildings, [site("ready")], 20);
  // Then
  assert.deepEqual(result.buildings.map(({ workers }) => workers), [4, 2, 1, 0]);
  assert.equal(result.constructionSites[0]?.assignedBuilders, 3);
  assert.equal(result.idleWorkers, 0);
});

test("unready sites never consume workers or starve a later ready site", () => {
  // Given
  const sites = [site("a-waiting", 0), site("b-ready")];
  // When
  const result = allocateBuildingAndConstructionLabour([], sites, 6);
  // Then
  assert.deepEqual(result.constructionSites.map(({ assignedBuilders }) => assignedBuilders), [0, 3]);
  assert.equal(result.idleWorkers, 0);
});

test("construction floor remains available even with a scarce food workforce", () => {
  // Given
  const buildings = [...food, building("a-quarry", "quarry")];
  // When
  const result = allocateBuildingAndConstructionLabour(buildings, [site("ready")], 16);
  // Then
  assert.deepEqual(result.buildings.map(({ workers }) => workers), [4, 1, 0, 0]);
  assert.equal(result.constructionSites[0]?.assignedBuilders, 3);
});

test("completed ordinary sites do not hold a reservation", () => {
  // Given
  const completed = { ...site("a-done"), builderTicks: 20 };
  // When
  const result = allocateBuildingAndConstructionLabour([building("a-saw", "sawmill")], [completed], 4);
  // Then
  assert.equal(result.buildings[0]?.workers, 2);
  assert.equal(result.constructionSites[0]?.assignedBuilders, 0);
});

test("all small populations conserve ordinary workforce", () => {
  // Given
  const buildings = [...food, building("a-saw", "sawmill")];
  for (let population = 0; population < 40; population++) {
    // When
    const result = allocateBuildingAndConstructionLabour(buildings, [site("a"), site("b", 0)], population);
    // Then
    assert.equal(result.buildings.reduce((sum, item) => sum + item.workers, 0) + result.constructionSites.reduce((sum, item) => sum + item.assignedBuilders, 0) + result.idleWorkers, availableWorkers(population));
  }
});

test("one complete food chain is staffed before duplicate farms", () => {
  // Given
  const buildings = [building("a-farm", "wheat_farm"), building("b-farm", "wheat_farm"), building("z-mill", "mill"), building("z-granary", "granary")];
  // When
  const result = allocateBuildingLabour(buildings, 16);
  // Then
  assert.deepEqual(result.buildings.map(({ workers }) => workers), [4, 0, 2, 2]);
});

test("ineligible disconnected facilities release labour to connected food and construction", () => {
  // Given
  const buildings = [building("a-farm", "wheat_farm"), building("z-mill", "mill")];
  // When
  const result = allocateBuildingAndConstructionLabour(buildings, [site("ready")], 6, undefined, (building) => building.id !== "a-farm");
  // Then
  assert.deepEqual(result.buildings.map(({ workers }) => workers), [0, 0]);
  assert.equal(result.constructionSites[0]?.assignedBuilders, 3);
});

test("era reservation and ordinary builders cannot double assign any worker", () => {
  // Given
  const wall = { id: "wall", kind: "palisade_segment", wallId: "w", segmentIndex: 0, gateDistance: 0, order: 0, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], anchor: { tx: 0, ty: 0 }, required: { timber: 10 }, delivered: { timber: 10 }, reserved: {}, builderTicks: 0, requiredBuilderTicks: 20, assignedBuilders: 0, stall: "none", startedTick: 0 } as const;
  for (let population = 0; population < 50; population++) {
    // When
    const result = allocateBuildingAndConstructionLabour(food, [wall, site("ordinary")], population, { era: "palisade", tick: 1, eraProclaimedTick: 0 });
    // Then
    const assigned = result.buildings.reduce((sum, item) => sum + item.workers, 0) + result.constructionSites.reduce((sum, item) => sum + item.assignedBuilders, 0);
    assert.equal(assigned + result.idleWorkers + result.diagnostics.palisadeEraLabour.unavailableReservedWorkers, availableWorkers(population));
    assert.ok(result.constructionSites.every((item) => item.assignedBuilders <= 3));
  }
});

test("construction allocation is invariant to site and building array order", () => {
  // Given
  const buildings = [...food, building("a-quarry", "quarry")];
  const sites = [site("z-ready"), site("a-waiting", 0), site("b-ready")];
  // When
  const forward = allocateBuildingAndConstructionLabour(buildings, sites, 26);
  const reverse = allocateBuildingAndConstructionLabour([...buildings].reverse(), [...sites].reverse(), 26);
  // Then
  assert.deepEqual([...reverse.buildings].reverse(), forward.buildings);
  assert.deepEqual([...reverse.constructionSites].reverse(), forward.constructionSites);
  assert.equal(reverse.idleWorkers, forward.idleWorkers);
});

test("no ready construction leaves nonfood production fully staffed", () => {
  // Given
  const buildings = [...food, building("a-saw", "sawmill")];
  // When
  const result = allocateBuildingAndConstructionLabour(buildings, [site("waiting", 0)], 20);
  // Then
  assert.deepEqual(result.buildings.map(({ workers }) => workers), [4, 2, 2, 2]);
  assert.equal(result.constructionSites[0]?.assignedBuilders, 0);
});
