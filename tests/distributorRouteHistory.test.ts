import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BALANCE } from "../src/content/balanceConfig";
import type { GameState } from "../src/engine/engine.types";
import {
  createDistributorRouteHistory,
  observeDistributorRouteHistory,
  routeHistoryForGranary,
} from "../src/ui/distributorRouteHistory";
import type { DistributorWalker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import type { Tile } from "../src/world/world.types";

const ENGINE_TYPES_SOURCE = "src/engine/engine.types.ts";
const HARNESS_SERIALIZER_SOURCE = "scripts/economyHarnessSerializer.ts";

function granary(id: string): Building {
  return {
    id,
    kind: "granary",
    tx: 2,
    ty: 2,
    workers: 0,
    inventory: { bread: BALANCE.DISTRIBUTOR_CAPACITY },
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function distributor(input: {
  readonly id: string;
  readonly granaryId: string;
  readonly phase?: DistributorWalker["phase"];
  readonly path: DistributorWalker["path"];
  readonly pathIndex?: number;
  readonly spawnedTick?: number;
}): DistributorWalker {
  return {
    id: input.id,
    kind: "distributor",
    phase: input.phase ?? "roaming",
    homeBuildingId: input.granaryId,
    position: input.path[0] ?? { tx: 0, ty: 0 },
    path: input.path,
    pathIndex: input.pathIndex ?? 0,
    previousTile: null,
    cargo: { resource: "bread", amount: 4 },
    spawnedTick: input.spawnedTick ?? 120,
    junctionVisits: 0,
    tilesTravelled: input.path.length,
    priorTile: null,
  };
}

function state(input: {
  readonly tick: number;
  readonly buildings?: readonly Building[];
  readonly walkers?: readonly DistributorWalker[];
}): GameState {
  const tiles: Tile[] = [];
  return {
    tick: input.tick,
    seed: 1,
    tiles,
    width: 12,
    height: 12,
    buildings: [...(input.buildings ?? [granary("granary-a")])],
    constructionSites: [],
    houses: [],
    walkers: [...(input.walkers ?? [])],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
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

test("records a completed distributor branch under its granary without mutating GameState", () => {
  // Given
  const before = state({
    tick: 120,
    walkers: [distributor({
      id: "distributor:granary-a:120",
      granaryId: "granary-a",
      path: [{ tx: 3, ty: 2 }, { tx: 4, ty: 2 }],
      pathIndex: 0,
    })],
  });
  const after = state({
    tick: 121,
    walkers: [distributor({
      id: "distributor:granary-a:120",
      granaryId: "granary-a",
      phase: "returning",
      path: [{ tx: 4, ty: 2 }, { tx: 3, ty: 2 }],
      pathIndex: 0,
    })],
  });
  const snapshot = structuredClone(after);

  // When
  const history = observeDistributorRouteHistory({
    previousState: before,
    nextState: after,
    history: createDistributorRouteHistory(),
  });

  // Then
  assert.deepEqual(after, snapshot);
  assert.deepEqual(routeHistoryForGranary(history, "granary-a"), [{
    granaryId: "granary-a",
    startedTick: 120,
    completedTick: 121,
    branchLabel: "동쪽 가지",
    coordinates: [{ tx: 4, ty: 2 }],
    distance: 1,
  }]);
});

test("keeps the last five completed routes isolated per granary and prunes removed granaries", () => {
  // Given
  let history = createDistributorRouteHistory();
  let previous = state({ tick: 0, buildings: [granary("granary-a"), granary("granary-b")] });

  // When
  for (let index = 0; index < 6; index += 1) {
    const id = `distributor:granary-a:${index}`;
    const roaming = state({
      tick: index * 2 + 1,
      buildings: [granary("granary-a"), granary("granary-b")],
      walkers: [distributor({
        id,
        granaryId: "granary-a",
        path: [{ tx: index, ty: 2 }, { tx: index + 1, ty: 2 }],
      })],
    });
    history = observeDistributorRouteHistory({ previousState: previous, nextState: roaming, history });
    const returning = state({
      tick: index * 2 + 2,
      buildings: [granary("granary-a"), granary("granary-b")],
      walkers: [distributor({
        id,
        granaryId: "granary-a",
        phase: "returning",
        path: [{ tx: index + 1, ty: 2 }],
      })],
    });
    history = observeDistributorRouteHistory({ previousState: roaming, nextState: returning, history });
    previous = returning;
  }

  history = observeDistributorRouteHistory({
    previousState: previous,
    nextState: state({ tick: 20, buildings: [granary("granary-b")] }),
    history,
  });

  // Then
  assert.equal(routeHistoryForGranary(history, "granary-a").length, 0);
  assert.deepEqual(routeHistoryForGranary(history, "granary-b"), []);
});

test("keeps distributor route history out of GameState and harness serialization", () => {
  // Given / When
  const engineTypes = readFileSync(ENGINE_TYPES_SOURCE, "utf8");
  const serializer = readFileSync(HARNESS_SERIALIZER_SOURCE, "utf8");

  // Then
  assert.doesNotMatch(engineTypes, /DistributorRouteHistory|routeHistory|routesByGranaryId/);
  assert.doesNotMatch(serializer, /DistributorRouteHistory|routeHistory|routesByGranaryId/);
});

test("preserves history identity when a simulation tick has no distributor route change", () => {
  const history = createDistributorRouteHistory();
  const before = state({ tick: 20, buildings: [] });
  const after = state({ tick: 21, buildings: [] });

  const observed = observeDistributorRouteHistory({ previousState: before, nextState: after, history });

  assert.equal(observed, history);
});
