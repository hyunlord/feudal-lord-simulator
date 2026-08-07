import assert from "node:assert/strict";
import test from "node:test";

import type { CarterWalker, DistributorWalker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { economyStockTotals } from "../src/ui/ledgerModel";

const store: Building = {
  id: "store",
  kind: "storehouse",
  tx: 1,
  ty: 1,
  workers: 2,
  inventory: { wheat: 2, bread: 3, logs: 4, timber: 6 },
  reserved: { timber: 100 },
  stockReserved: { logs: 2 },
  productionProgress: 0,
};

const carter: CarterWalker = {
  id: "carter:producer:1",
  kind: "carter",
  homeBuildingId: "producer",
  destination: { kind: "building", buildingId: "store" },
  mission: "deliver",
  phase: "outbound",
  position: { tx: 0, ty: 0 },
  path: [{ tx: 0, ty: 0 }],
  pathIndex: 0,
  previousTile: null,
  cargo: { resource: "wheat", amount: 8 },
  reservation: {
    destination: { kind: "building", buildingId: "store" },
    resource: "wheat",
    amount: 8,
    sourceStockClaim: null,
    homeCapacityClaim: null,
  },
  cancellation: null,
  spawnedTick: 1,
};

const distributor: DistributorWalker = {
  id: "distributor:granary:120",
  kind: "distributor",
  homeBuildingId: "granary",
  phase: "roaming",
  position: { tx: 0, ty: 0 },
  path: [{ tx: 0, ty: 0 }],
  pathIndex: 0,
  previousTile: null,
  cargo: { resource: "bread", amount: 12 },
  spawnedTick: 120,
  junctionVisits: 0,
  tilesTravelled: 0,
  priorTile: null,
};

test("ledger totals treasury, building inventory, and walker cargo without counting claims", () => {
  const totals = economyStockTotals({
    ...DEFAULT_GAME_STATE,
    treasuryTimber: 5,
    treasuryCoin: 7,
    buildings: [store],
    walkers: [carter, distributor],
    houses: [{
      buildingId: "house",
      level: 2,
      residents: 4,
      hasWater: true,
      breadStock: 99,
      lastServicedTick: 120,
      unmetRequirementTicks: 0,
    }],
  });

  assert.deepEqual(totals, {
    wheat: 10,
    bread: 15,
    logs: 4,
    timber: 11,
    stone_raw: 0,
    stone: 0,
    coin: 7,
  });
});
