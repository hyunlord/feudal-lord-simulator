import assert from "node:assert/strict";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import { createConstructionSite } from "../src/economy/construction";
import type { GameState, PalisadeState } from "../src/engine/engine.types";
import { segmentPalisadePathForConstruction } from "../src/engine/palisade";
import { gameReducer, DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";
import type { PalisadePath } from "../src/world/palisadeGeometry";
import type { Tile } from "../src/world/world.types";

const BASE_PATH: PalisadePath = [
  { x: 5, y: 5 },
  { x: 15, y: 5 },
  { x: 15, y: 15 },
  { x: 5, y: 15 },
  { x: 5, y: 5 },
];

function tile(tx: number, ty: number, hasRoad = false): Tile {
  return { tx, ty, terrain: "grass", buildingId: null, hasRoad };
}

function building(id: string, kind: Building["kind"], tx: number, ty: number): Building {
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
  };
}

function worldTiles(roadKeys: readonly string[] = []): Tile[] {
  const roads = new Set(roadKeys);
  return Array.from({ length: 24 * 24 }, (_unused, index) => {
    const tx = index % 24;
    const ty = Math.floor(index / 24);
    return tile(tx, ty, roads.has(`${tx},${ty}`));
  });
}

function eligibleState(patch: Partial<GameState> = {}): GameState {
  const buildings = [
    building("house-a", "house", 8, 8),
    building("house-b", "house", 11, 8),
    building("granary-a", "granary", 8, 11),
    building("chapel-a", "chapel", 12, 11),
  ];
  return {
    ...DEFAULT_GAME_STATE,
    tick: 77,
    tiles: worldTiles(["9,5", "12,5", "10,10"]),
    width: 24,
    height: 24,
    buildings,
    houses: [],
    constructionSites: [],
    walkers: [],
    population: 60,
    treasuryTimber: 600,
    nextConstructionOrdinal: 3,
    ...patch,
  };
}

function confirmAction(candidatePath: PalisadePath = BASE_PATH): GameAction {
  return { type: "confirm_palisade_proclamation", candidatePath };
}

function proclaim(state: GameState, candidatePath: PalisadePath = BASE_PATH): GameState {
  return gameReducer(state, confirmAction(candidatePath));
}

function siteIds(palisade: PalisadeState): readonly string[] {
  return palisade.segments.map((segment) => segment.constructionSiteId ?? "");
}

function walker(input: {
  readonly id: string;
  readonly kind: Walker["kind"];
  readonly path: Walker["path"];
  readonly pathIndex: number;
  readonly siteId?: string;
}): Walker {
  const base = {
    id: input.id,
    kind: input.kind,
    homeBuildingId: "home",
    position: input.path[input.pathIndex] ?? { tx: 0, ty: 0 },
    path: input.path,
    pathIndex: input.pathIndex,
    previousTile: null,
    cargo: null,
    spawnedTick: 0,
  };
  switch (input.kind) {
    case "builder":
      return { ...base, kind: "builder", siteId: input.siteId ?? "site-a", slotIndex: 0 };
    case "carter":
      return {
        ...base,
        kind: "carter",
        mission: "deliver",
        phase: "outbound",
        destination: { kind: "building", buildingId: "granary-a" },
        reservation: {
          destination: { kind: "building", buildingId: "granary-a" },
          resource: "timber",
          amount: 0,
          sourceStockClaim: null,
          homeCapacityClaim: null,
        },
        cancellation: null,
      };
    case "distributor":
      return {
        ...base,
        kind: "distributor",
        phase: "roaming",
        junctionVisits: 0,
        tilesTravelled: 0,
        priorTile: null,
      };
    default:
      throw new Error(`Unhandled walker kind: ${input.kind satisfies never}`);
  }
}

test("Given an eligible hamlet and a 40-step candidate When confirming Then proclamation creates ten ordered wall sites costing 600 timber", () => {
  // Given
  const state = eligibleState();

  // When
  const next = proclaim(state);

  // Then
  assert.notEqual(next, state);
  assert.equal(next.era, "palisade");
  assert.equal(next.eraProclaimedTick, 77);
  assert.ok(next.palisade !== null);
  assert.equal(next.palisade.segments.length, 10);
  assert.equal(next.constructionSites.length, 10);
  assert.equal(next.constructionSites.reduce((total, site) => total + (site.required.timber ?? 0), 0), 600);
  assert.deepEqual(next.constructionSites.map((site) => site.requiredBuilderTicks), Array(10).fill(120));
  assert.equal(new Set(siteIds(next.palisade)).size, 10);
  assert.equal(next.nextConstructionOrdinal, state.nextConstructionOrdinal + 1);
});

test("Given exactly 250 spendable timber When proclaiming a 600-timber wall Then every site starts and later delivery owns the shortfall", () => {
  // Given: the published era threshold is met, but the full enclosure is not prepaid.
  const state = eligibleState({ treasuryTimber: 250 });

  // When
  const next = proclaim(state);

  // Then: proclamation commits the plan without inventing or immediately spending timber.
  assert.notEqual(next, state);
  assert.equal(next.era, "palisade");
  assert.equal(next.treasuryTimber, 250);
  assert.equal(next.constructionSites.length, 10);
  assert.equal(next.constructionSites.reduce((total, site) => total + (site.required.timber ?? 0), 0), 600);
  assert.equal(next.constructionSites.every((site) => (site.delivered.timber ?? 0) === 0), true);
});

test("Given perimeter lengths When segmenting Then each site covers at most four steps and partial tails keep exact timber", () => {
  // Given
  const pathWithSteps = (steps: number): PalisadePath => [{ x: 2, y: 2 }, { x: 2 + steps, y: 2 }];

  // When / Then
  for (const [steps, expectedSites, expectedTimber] of [
    [1, 1, 15],
    [4, 1, 60],
    [5, 2, 75],
    [40, 10, 600],
    [41, 11, 615],
  ] as const) {
    const segments = segmentPalisadePathForConstruction(pathWithSteps(steps));
    assert.equal(segments.length, expectedSites, `steps ${steps}`);
    assert.equal(segments.reduce((total, segment) => total + segment.tileCount * 15, 0), expectedTimber, `steps ${steps}`);
    assert.equal(segments.every((segment) => segment.tileCount <= 4), true, `steps ${steps}`);
  }
});

test("Given traffic on remaining non-builder paths When confirming Then one gate uses the highest future road occurrence", () => {
  // Given
  const highTrafficRoad = { tx: 12, ty: 5 };
  const state = eligibleState({
    walkers: [
      walker({ id: "past", kind: "carter", path: [{ tx: 12, ty: 5 }, { tx: 8, ty: 8 }], pathIndex: 1 }),
      walker({ id: "future-a", kind: "carter", path: [{ tx: 8, ty: 8 }, highTrafficRoad], pathIndex: 0 }),
      walker({ id: "future-b", kind: "distributor", path: [{ tx: 7, ty: 7 }, highTrafficRoad], pathIndex: 0 }),
    ],
  });

  // When
  const next = proclaim(state);

  // Then
  assert.ok(next.palisade !== null);
  assert.deepEqual(next.palisade.gate, { x: 12, y: 5 });
  assert.equal(next.palisade.segments.filter((segment) => segment.order === 0).length, 1);
});

test("Given tied traffic permutations When confirming Then gate tie-break stays deterministic", () => {
  // Given
  const firstOrder = [
    walker({ id: "a", kind: "carter", path: [{ tx: 9, ty: 5 }], pathIndex: 0 }),
    walker({ id: "b", kind: "distributor", path: [{ tx: 12, ty: 5 }], pathIndex: 0 }),
  ];
  const secondOrder = [...firstOrder].reverse();

  // When
  const first = proclaim(eligibleState({ walkers: firstOrder }));
  const second = proclaim(eligibleState({ walkers: secondOrder }));

  // Then
  assert.ok(first.palisade !== null);
  assert.ok(second.palisade !== null);
  assert.deepEqual(first.palisade.gate, second.palisade.gate);
  assert.deepEqual(siteIds(first.palisade), siteIds(second.palisade));
});

test("Given a builder on a candidate road When confirming Then builder traffic is excluded", () => {
  // Given
  const state = eligibleState({
    walkers: [
      walker({ id: "builder", kind: "builder", path: [{ tx: 12, ty: 5 }, { tx: 12, ty: 5 }], pathIndex: 0 }),
      walker({ id: "carter", kind: "carter", path: [{ tx: 9, ty: 5 }], pathIndex: 0 }),
    ],
  });

  // When
  const next = proclaim(state);

  // Then
  assert.ok(next.palisade !== null);
  assert.deepEqual(next.palisade.gate, { x: 9, y: 5 });
});

test("Given roads exist but none cross the polygon When confirming Then gate falls back without mutating roads", () => {
  // Given
  const state = eligibleState({ tiles: worldTiles(["10,10"]) });

  // When
  const next = proclaim(state);

  // Then
  assert.ok(next.palisade !== null);
  assert.equal(next.tiles, state.tiles);
  assert.equal(next.roadRevision, state.roadRevision);
  assert.equal(next.palisade.segments.filter((segment) => segment.order === 0).length, 1);
});

test("Given invalid or unmet confirmation When reducing Then the exact same state object is returned", () => {
  // Given
  const valid = eligibleState();
  const invalidPolygon = BASE_PATH.slice(0, -1);
  const unmet = eligibleState({ population: 59 });
  const repeated = eligibleState({ era: "palisade" });
  const committed = createConstructionSite({ ordinal: 99, kind: "well", tx: 1, ty: 1, startedTick: 0 });
  const insufficient = eligibleState({ treasuryTimber: 250, constructionSites: [{ ...committed, required: { timber: 1 }, delivered: {}, reserved: {} }] });

  // When / Then
  assert.equal(proclaim(valid, invalidPolygon), valid);
  assert.equal(proclaim(unmet), unmet);
  assert.equal(proclaim(repeated), repeated);
  assert.equal(proclaim(insufficient), insufficient);
});

test("Given confirmation succeeds When inspecting ids Then wall and site ids are stable and unique", () => {
  // Given
  const state = eligibleState();

  // When
  const first = proclaim(state);
  const second = proclaim(eligibleState());

  // Then
  assert.ok(first.palisade !== null);
  assert.ok(second.palisade !== null);
  assert.equal(first.palisade.id, "palisade-000003");
  assert.deepEqual(first.palisade, second.palisade);
  assert.deepEqual(first.constructionSites.map((site) => site.id), [
    "palisade-000003-segment-000",
    "palisade-000003-segment-001",
    "palisade-000003-segment-002",
    "palisade-000003-segment-003",
    "palisade-000003-segment-004",
    "palisade-000003-segment-005",
    "palisade-000003-segment-006",
    "palisade-000003-segment-007",
    "palisade-000003-segment-008",
    "palisade-000003-segment-009",
  ]);
});
