import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import { decideNextAction } from "../src/engine/autoplay";
import { autoplayActionToGameAction } from "../src/engine/autoplayActions";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import { computePalisadeProposal, type PalisadeFootprint } from "../src/world/palisadeGeometry";
import type { Tile } from "../src/world/world.types";

function building(id: string, kind: BuildingKind, tx: number, ty: number): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: BUILDING_CONFIG_BY_KIND[kind].workersRequired,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function house(buildingId: string): House {
  return {
    buildingId,
    level: 3,
    residents: 20,
    hasWater: true,
    breadStock: 50,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

function tiles(buildings: readonly Building[]): Tile[] {
  return Array.from({ length: 8 * 8 }, (_unused, index): Tile => {
    const tx = index % 8;
    const ty = Math.floor(index / 8);
    const owner = buildings.find((candidate) => {
      const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
      return tx >= candidate.tx &&
        tx < candidate.tx + definition.width &&
        ty >= candidate.ty &&
        ty < candidate.ty + definition.height;
    });
    return {
      tx,
      ty,
      terrain: "grass",
      buildingId: owner?.id ?? null,
      hasRoad: true,
    };
  });
}

function palisadeFootprints(state: GameState): readonly PalisadeFootprint[] {
  return state.buildings.map((candidate) => {
    const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
    return {
      id: candidate.id,
      tx: candidate.tx,
      ty: candidate.ty,
      width: definition.width,
      height: definition.height,
    };
  });
}

function readyEdgeMapState(): GameState {
  const buildings = [
    building("house-a", "house", 0, 0),
    building("house-b", "house", 0, 1),
    building("house-c", "house", 0, 2),
    building("granary-a", "granary", 0, 3),
    building("chapel-a", "chapel", 0, 5),
  ];
  const homes = buildings.filter((candidate) => candidate.kind === "house").map((candidate) => house(candidate.id));
  return {
    tick: 0,
    seed: 1,
    width: 8,
    height: 8,
    tiles: tiles(buildings),
    buildings: [...buildings],
    constructionSites: [],
    houses: homes,
    walkers: [],
    population: 60,
    idleWorkers: 0,
    treasuryTimber: 250,
    treasuryCoin: 0,
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    forestHarvests: [],
    nextConstructionOrdinal: 1,
    roadRevision: 1,
    pathCache: {},
  };
}

test("Given a ready edge-map settlement When palisade proposal is out of bounds Then autoplay does not synthesize a fallback wall", () => {
  const state = readyEdgeMapState();
  const action = decideNextAction(state);
  const proposal = computePalisadeProposal(state, palisadeFootprints(state));

  assert.deepEqual(action, { kind: "proclaim_era" });
  assert.deepEqual(proposal, { ok: false, reason: "out_of_bounds" });
  assert.equal(autoplayActionToGameAction(action, state), null);
});
