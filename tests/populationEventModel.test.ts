import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import {
  appendPopulationEvents,
  diffPopulationEvents,
  groupPopulationEvents,
  type PopulationEvent,
} from "../src/ui/populationEventModel";

function house(
  buildingId: string,
  residents: number,
  patch: Partial<House> = {},
): House {
  return {
    buildingId,
    level: 1,
    residents,
    hasWater: true,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
    ...patch,
  };
}

function state(tick: number, houses: readonly House[]): GameState {
  return {
    tick,
    seed: 1,
    tiles: [],
    width: 0,
    height: 0,
    buildings: [],
    constructionSites: [],
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    houses: [...houses],
    walkers: [],
    population: houses.reduce((sum, candidate) => sum + candidate.residents, 0),
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 0,
    pathCache: {},
  };
}

function event(
  tick: number,
  cause: PopulationEvent["cause"],
  houseId: string,
): PopulationEvent {
  return {
    tick,
    delta: cause === "starvation" || cause === "no_water" ? -1 : 1,
    cause,
    houseId,
  };
}

test("population diff records one growth event for an existing house", () => {
  // Given
  const previous = state(49, [house("a", 2)]);
  const current = state(50, [house("a", 3)]);

  // When
  const events = diffPopulationEvents(previous, current);

  // Then
  assert.deepEqual(events, [event(50, "growth", "a")]);
});

test("population diff records starvation when bread service is stale", () => {
  // Given
  const previous = state(349, [house("a", 3, { hasWater: false, lastServicedTick: 0 })]);
  const current = state(350, [house("a", 2, { hasWater: false, lastServicedTick: 0 })]);

  // When
  const events = diffPopulationEvents(previous, current);

  // Then
  assert.deepEqual(events, [event(350, "starvation", "a")]);
});

test("population diff can distinguish a constructed recent-bread no-water loss", () => {
  // Given
  const previous = state(100, [house("a", 3, { hasWater: false, lastServicedTick: 90 })]);
  const current = state(101, [house("a", 2, { hasWater: false, lastServicedTick: 90 })]);

  // When
  const events = diffPopulationEvents(previous, current);

  // Then
  assert.deepEqual(events, [event(101, "no_water", "a")]);
});

test("population diff expands each resident change into signed unit events", () => {
  // Given
  const previous = state(10, [house("a", 1), house("b", 4)]);
  const current = state(11, [house("a", 3), house("b", 2, { lastServicedTick: -400 })]);

  // When
  const events = diffPopulationEvents(previous, current);

  // Then
  assert.deepEqual(events, [
    event(11, "growth", "a"),
    event(11, "growth", "a"),
    event(11, "starvation", "b"),
    event(11, "starvation", "b"),
  ]);
});

test("population diff marks populated new houses as recruited without backfilling existing state", () => {
  // Given
  const previous = state(20, [house("a", 2)]);
  const current = state(21, [house("a", 2), house("new", 2)]);

  // When
  const events = diffPopulationEvents(previous, current);

  // Then
  assert.deepEqual(events, [
    event(21, "recruited", "new"),
    event(21, "recruited", "new"),
  ]);
  assert.deepEqual(diffPopulationEvents(current, current), []);
});

test("population history retains only the newest 200 presentation events", () => {
  // Given
  const existing = Array.from({ length: 199 }, (_unused, index) =>
    event(index, "growth", `house-${index}`),
  );
  const incoming = [
    event(199, "growth", "house-199"),
    event(200, "growth", "house-200"),
    event(201, "growth", "house-201"),
  ];

  // When
  const history = appendPopulationEvents(existing, incoming);

  // Then
  assert.equal(history.length, 200);
  assert.equal(history[0]?.tick, 2);
  assert.equal(history[199]?.tick, 201);
});

test("population grouping merges only consecutive equal causes", () => {
  // Given
  const events = [
    event(10, "growth", "a"),
    event(11, "growth", "b"),
    event(12, "starvation", "a"),
    event(13, "growth", "a"),
  ];

  // When
  const groups = groupPopulationEvents(events);

  // Then
  assert.deepEqual(groups.map((group) => ({
    cause: group.cause,
    count: group.count,
    houseIds: group.houseIds,
  })), [
    { cause: "growth", count: 2, houseIds: ["a", "b"] },
    { cause: "starvation", count: 1, houseIds: ["a"] },
    { cause: "growth", count: 1, houseIds: ["a"] },
  ]);
});
