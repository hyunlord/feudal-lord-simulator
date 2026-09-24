import { allocateHouseServices } from "../../src/population/serviceAllocation";
import { updateHouse, updateHousing } from "../../src/population/housing";
import { spawnDistributors } from "../../src/agents/roamingSpawn";
import type { Building, BuildingKind } from "../../src/content/buildingConfig";
import type { House } from "../../src/population/population.types";

const b = (id: string, kind: BuildingKind, tx: number, ty: number, extra: Partial<Building> = {}): Building =>
  ({ id, kind, tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...extra });
const h = (buildingId: string, extra: Partial<House> = {}): House =>
  ({ buildingId, level: 0, residents: 0, hasWater: false, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0, ...extra });

// P1: incumbent opening-style ids lose water to a newer construction-site id
{
  const well = b("well-0", "well", 10, 10);
  const olds = Array.from({ length: 12 }, (_, i) => b(`house-${7 + (i % 6)}-${i < 6 ? 8 : 12}-0`, "house", 7 + (i % 6), i < 6 ? 8 : 12));
  const houses = olds.map(o => h(o.id, { level: 1, residents: 8, hasWater: true, breadStock: 3 }));
  const before = allocateHouseServices({ houses, buildings: [...olds, well] });
  const newcomer = b("construction-site-000042", "house", 10, 14);
  const after = allocateHouseServices({ houses: [...houses, h(newcomer.id)], buildings: [...olds, newcomer, well] });
  const lost = [...after.houses].filter(([id, s]) => s.water.kind !== "served" && before.houses.get(id)?.water.kind === "served").map(([id, s]) => `${id}:${s.water.kind}`);
  console.log("P1 before served:", [...before.houses.values()].filter(s => s.water.kind === "served").length,
    "| newcomer:", after.houses.get(newcomer.id)?.water.kind, "| incumbents that lost water:", lost.join(","));
  // devolution of the displaced L1 house over time
  let hs: readonly House[] = [...houses, h(newcomer.id)];
  const blds = [...olds, newcomer, well];
  let firstDrop = -1;
  for (let t = 1; t <= 1000; t++) {
    hs = updateHousing(hs, blds, t, null).houses;
    const victim = hs.find(x => x.buildingId === lost[0]?.split(":")[0]);
    if (victim && victim.level === 0 && firstDrop < 0) firstDrop = t;
  }
  console.log("P1 displaced house level drops 1->0 at tick", firstDrop);
}

// P2: residents are not clamped when capacity falls on downgrade
{
  let house = h("hx", { level: 1, residents: 8, hasWater: false, breadStock: 3 });
  for (let t = 1; t <= 1200; t++) {
    house = updateHouse({ ...house, hasWater: false, breadStock: 3 }, { tick: t, hasGranaryNearby: false });
  }
  console.log("P2 after 1200 ticks without water: level", house.level, "residents", house.residents, "capacity(L0)=4");
}

// P3: L2 house with every L4 gate but no granary within 12 never promotes; L4 needs no granary
{
  let house = h("hy", { level: 2, builtLevel: 2, residents: 14, hasWater: true, breadStock: 3 });
  for (let t = 1; t <= 20000; t++) house = updateHouse({ ...house, breadStock: 3, hasWater: true },
    { tick: t, hasGranaryNearby: false, hasMarketAccess: true, hasChurchAccess: true, palisadeProtection: "inside" });
  let l4 = h("hz", { level: 4, builtLevel: 4, residents: 32, hasWater: true, breadStock: 3 });
  for (let t = 1; t <= 5000; t++) l4 = updateHouse({ ...l4, breadStock: 3, hasWater: true },
    { tick: t, hasGranaryNearby: false, hasMarketAccess: true, hasChurchAccess: true, palisadeProtection: "inside" });
  console.log("P3 L2 without granary after 20000 ticks: level", house.level, "| L4 without granary after 5000 ticks: level", l4.level);
}

// P4: merge of two homes served by the last slot of two different wells loses water entirely
{
  const w1 = b("w1", "well", 2, 5), w2 = b("w2", "well", 14, 5);
  const fill1 = Array.from({ length: 11 }, (_, i) => b(`a${String(i).padStart(2, "0")}`, "house", 0 + (i % 4), 1 + Math.floor(i / 4)));
  const fill2 = Array.from({ length: 11 }, (_, i) => b(`z${String(i).padStart(2, "0")}`, "house", 12 + (i % 4), 1 + Math.floor(i / 4)));
  const left = b("m-left", "house", 8, 5), right = b("m-right", "house", 9, 5);
  const blds = [...fill1, ...fill2, left, right, w1, w2];
  const hs = blds.filter(x => x.kind === "house").map(x => h(x.id));
  const before = allocateHouseServices({ houses: hs, buildings: blds });
  const merged = { ...left, houseLot: "horizontal" as const };
  const blds2 = [...fill1, ...fill2, merged, w1, w2];
  const after = allocateHouseServices({ houses: hs.filter(x => x.buildingId !== "m-right"), buildings: blds2 });
  console.log("P4 before merge:", before.houses.get("m-left")?.water.kind, before.houses.get("m-left")?.water.providerId,
    before.houses.get("m-right")?.water.kind, before.houses.get("m-right")?.water.providerId,
    "| after merge:", after.houses.get("m-left")?.water.kind, "w1 used", after.providers.get("w1")?.used, "w2 used", after.providers.get("w2")?.used);
}

// P5: an unstaffed granary still dispatches bread distributors
{
  const granary = b("g", "granary", 5, 5, { workers: 0, inventory: { bread: 30 } });
  const res = spawnDistributors({ tick: 120, buildings: [granary], walkers: [],
    routes: { homePath: () => [{ tx: 4, ty: 5 }], returnPath: () => null, neighbors: () => [], isRoad: () => true } });
  console.log("P5 granary workers=0 -> distributors spawned:", res.walkers.length, "cargo", (res.walkers[0] as any)?.cargo?.amount);
}
