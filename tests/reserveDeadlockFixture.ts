import { readFileSync } from "node:fs";
import type { Building } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import type { ConstructionSite } from "../src/economy/construction";
import { createPalisadeConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

export const reserveDeadlockDiagnosticSource = "fixtures/reserve-deadlock-seed3-snapshot.json";

type SnapshotStore = {
  readonly id: string;
  readonly inventory: Partial<Record<ResourceType, number>>;
};

type Snapshot = {
  readonly tick: number;
  readonly treasuryTimber: number;
  readonly loggingCamp: { readonly logs: number };
  readonly stores: readonly SnapshotStore[];
  readonly reserve: {
    readonly resource: "timber";
    readonly sources: readonly { readonly id: string; readonly floor: number }[];
    readonly proclaimedTick: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberField(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== "number") throw new Error(`Bad reserve deadlock fixture: ${field}`);
  return value;
}

function inventoryField(value: unknown): Partial<Record<ResourceType, number>> {
  if (!isRecord(value)) throw new Error("Bad reserve deadlock fixture: inventory");
  const result: Partial<Record<ResourceType, number>> = {};
  for (const resource of ["timber", "stone_raw", "stone"] as const) {
    const amount = value[resource];
    if (typeof amount === "number") result[resource] = amount;
  }
  return result;
}

function parseSnapshot(value: unknown): Snapshot {
  if (!isRecord(value)) throw new Error("Bad reserve deadlock fixture");
  const loggingCamp = value.loggingCamp;
  const reserve = value.reserve;
  const stores = value.stores;
  if (!isRecord(loggingCamp) || !isRecord(reserve) || !Array.isArray(stores)) {
    throw new Error("Bad reserve deadlock fixture shape");
  }
  const sources = reserve.sources;
  if (reserve.resource !== "timber" || !Array.isArray(sources)) {
    throw new Error("Bad reserve deadlock reserve shape");
  }
  return {
    tick: numberField(value, "tick"),
    treasuryTimber: numberField(value, "treasuryTimber"),
    loggingCamp: { logs: numberField(loggingCamp, "logs") },
    stores: stores.map((store) => {
      if (!isRecord(store) || typeof store.id !== "string") {
        throw new Error("Bad reserve deadlock store shape");
      }
      return { id: store.id, inventory: inventoryField(store.inventory) };
    }),
    reserve: {
      resource: "timber",
      sources: sources.map((source) => {
        if (!isRecord(source) || typeof source.id !== "string") {
          throw new Error("Bad reserve deadlock reserve source shape");
        }
        return { id: source.id, floor: numberField(source, "floor") };
      }),
      proclaimedTick: numberField(reserve, "proclaimedTick"),
    },
  };
}

export function loadReserveDeadlockSnapshot(): Snapshot {
  const url = new URL(`../${reserveDeadlockDiagnosticSource}`, import.meta.url);
  return parseSnapshot(JSON.parse(readFileSync(url, "utf8")));
}

export function reserveDeadlockStoreBuildings(snapshot: Snapshot): readonly Building[] {
  return snapshot.stores.map((store, index) => building(store.id, "storehouse", {
    tx: 2 + index * 3,
    ty: 2,
    workers: 2,
    inventory: store.inventory,
  }));
}

export function building(id: string, kind: Building["kind"], patch: Partial<Building> = {}): Building {
  return {
    id,
    kind,
    tx: 2,
    ty: 2,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
    ...patch,
  };
}

function wallSite(id: string): ConstructionSite {
  return {
    ...createPalisadeConstructionSite({
      id,
      wallId: "wall-a",
      segmentIndex: 0,
      gateDistance: 0,
      order: 0,
      path: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
      startedTick: 100,
    }),
    stall: "reserve_held",
  };
}

export function reserveDeadlockFixture(patch: Partial<GameState> = {}): GameState {
  const snapshot = loadReserveDeadlockSnapshot();
  const tiles = Array.from({ length: 64 }, (_, index) => ({
    tx: index % 8,
    ty: Math.floor(index / 8),
    terrain: "grass" as const,
    buildingId: null,
    hasRoad: Math.floor(index / 8) === 1,
  }));
  return {
    ...DEFAULT_GAME_STATE,
    tick: snapshot.tick,
    wallTick: snapshot.tick,
    width: 8,
    height: 8,
    tiles,
    era: "palisade",
    treasuryTimber: snapshot.treasuryTimber,
    constructionSites: [wallSite("wall-a-segment-000")],
    buildings: [
      building("logging-camp-a", "logging_camp", {
        workers: 3,
        inventory: { logs: snapshot.loggingCamp.logs },
        productionProgress: 49,
      }),
      ...reserveDeadlockStoreBuildings(snapshot),
    ],
    timberProductionWindow: {
      startTick: snapshot.tick - 2399,
      throughTick: snapshot.tick,
      produced: 0,
      productionTicks: [],
      availableTimber: 36,
      lastAvailableIncreaseTick: snapshot.tick - 2400,
    },
    wallConstructionPriority: "balanced",
    wallConstructionReserve: snapshot.reserve,
    ...patch,
  };
}
