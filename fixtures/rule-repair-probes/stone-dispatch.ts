import { spawnCarters } from "../../src/agents/deliverySpawn";
import { createDeliveryInventoryPort } from "../../src/engine/simulationPorts";
import type { Building } from "../../src/content/buildingConfig";
import { createConstructionSite, createStoneWallConstructionSite, constructionStall } from "../../src/economy/construction";
import { palisadeConstructionSchedule } from "../../src/domain/palisadeConstructionSchedule";
import { allocateBuildingAndConstructionLabour } from "../../src/population/labour";
import type { DeliveryRoutePort } from "../../src/agents/deliveryTypes";

const b = (id: string, kind: Building["kind"], inv: Building["inventory"] = {}): Building => ({ id, kind, tx: 0, ty: 0, workers: 0, inventory: inv, reserved: {}, stockReserved: {}, productionProgress: 0 });
const line = (n: number) => Array.from({ length: n }, (_, i) => ({ tx: i, ty: 0 }));
// store-a is FAR (path 40), store-b is NEAR (path 3)
const lengths: Record<string, number> = { "store-a": 40, "store-b": 3 };
const routes: DeliveryRoutePort = {
  betweenBuildings: () => null,
  fromBuildingToDestination: (from) => lengths[from] === undefined ? null : line(lengths[from]!),
  fromTileToBuilding: () => null,
  fromTileToDestination: () => null,
  isRoad: () => true,
  canTraverse: () => true,
} as unknown as DeliveryRoutePort;
const inventory = createDeliveryInventoryPort();
const s1 = createConstructionSite({ ordinal: 1, kind: "storehouse", tx: 0, ty: 0, startedTick: 0 });
const s2 = createConstructionSite({ ordinal: 2, kind: "granary", tx: 0, ty: 0, startedTick: 0 });
const result = spawnCarters({ tick: 1, buildings: [b("store-a", "storehouse", { timber: 50 }), b("store-b", "storehouse", { timber: 50 })], constructionSites: [s1, s2], walkers: [], treasuryTimber: 100, inventory, routes });
console.log("P1 ordinary-site source choice + dispatch count:", JSON.stringify(result.walkers.map(w => w.kind === "carter" ? { home: w.homeBuildingId, dest: w.destination, pathLen: w.path.length, cargo: w.cargo } : w.kind)));
console.log("P1 reserved:", JSON.stringify(result.constructionSites.map(s => [s.id, s.reserved])), "treasury", result.treasuryTimber);

// P2: stone wall serial block
const stone = (id: string, order: number) => createStoneWallConstructionSite({ id, wallId: "w", segmentIndex: order, gateDistance: order, order, path: [{ x: order, y: 0 }, { x: order + 1, y: 0 }], startedTick: 0 });
const blocked = { ...stone("seg-000-stone", 0), stall: "no_route" as const };
const supplied = Array.from({ length: 3 }, (_, i) => ({ ...stone(`seg-00${i + 1}-stone`, i + 1), delivered: { stone: 25 } }));
const sites = [blocked, ...supplied];
console.log("P2 schedules:", JSON.stringify(sites.map(s => [s.id, palisadeConstructionSchedule(s, sites)])));
const lab = allocateBuildingAndConstructionLabour([], sites, 100, { era: "stone_town", tick: 5000, eraProclaimedTick: 0 });
console.log("P2 builders after window:", JSON.stringify(lab.constructionSites.map(s => [s.id, s.assignedBuilders, s.stall])), "idle", lab.idleWorkers);
// P3: stall when only source is busy: shows awaiting_materials
console.log("P3 stall with stock+route (source busy irrelevant):", constructionStall(s1, [{ id: "store-a", stock: { timber: 50 }, hasRoute: true }]));
