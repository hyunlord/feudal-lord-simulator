import { BALANCE } from "../content/balanceConfig";
import type { Building } from "../content/buildingConfig";
import type { DistributorWalker, TilePos, Walker } from "./walker.types";
import { breadStock, replaceBuilding, withBread } from "./roamingCommon";
import type { RoamingSpawnInput, RoamingSpawnResult } from "./roamingTypes";

function activeDistributors(
  walkers: readonly Walker[],
  homeBuildingId: string,
): number {
  return walkers.filter(
    (walker) =>
      walker.kind === "distributor" && walker.homeBuildingId === homeBuildingId,
  ).length;
}

function spawnDistributor(
  tick: number,
  granary: Building,
  path: readonly TilePos[],
  amount: number,
): DistributorWalker {
  return {
    id: `distributor:${granary.id}:${tick}`,
    kind: "distributor",
    phase: "roaming",
    homeBuildingId: granary.id,
    position: path[0] ?? { tx: granary.tx, ty: granary.ty },
    path,
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "bread", amount },
    spawnedTick: tick,
    junctionVisits: 0,
    tilesTravelled: 0,
    priorTile: null,
  };
}

export function spawnDistributors(input: RoamingSpawnInput): RoamingSpawnResult {
  if (input.tick % BALANCE.DISTRIBUTOR_INTERVAL !== 0) {
    return { buildings: input.buildings, walkers: input.walkers };
  }

  let buildings = input.buildings;
  const walkers: Walker[] = [...input.walkers];
  for (const granary of [...buildings].sort((left, right) => left.id.localeCompare(right.id))) {
    if (granary.kind !== "granary") continue;
    if (activeDistributors(walkers, granary.id) >= 2) continue;
    const path = input.routes.homePath(granary.id);
    if (path === null) continue;
    const amount = Math.min(BALANCE.DISTRIBUTOR_CAPACITY, breadStock(granary));
    if (amount === 0) continue;
    const loaded = withBread(granary, breadStock(granary) - amount);
    buildings = replaceBuilding(buildings, loaded);
    walkers.push(spawnDistributor(input.tick, loaded, path, amount));
  }

  return { buildings, walkers };
}
