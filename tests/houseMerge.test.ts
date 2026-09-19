import { houseGrowthPhase } from "../src/population/houseFood";
import assert from "node:assert/strict";
import test from "node:test";
import type { CarterWalker, DistributorWalker } from "../src/agents/walker.types";
import { stepDistributors } from "../src/agents/roaming";
import { createMulberry32 } from "../src/engine/prng";
import { createConstructionSite } from "../src/economy/construction";
import { hashEconomyState, hashOpeningState } from "../scripts/economyHarnessSerializer";
import { advanceTick } from "../src/engine/tick";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { houseMergeOptions, mergeHouses } from "../src/engine/houseMerge";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { updateHouse } from "../src/population/housing";
import { BALANCE } from "../src/content/balanceConfig";

function pair(vertical = false): GameState {
  const buildings: Building[] = [
    { id: "a", kind: "house", tx: 2, ty: 2, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
    { id: "b", kind: "house", tx: vertical ? 2 : 3, ty: vertical ? 3 : 2, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
  ];
  return { ...DEFAULT_GAME_STATE, width: 7, height: 7, buildings,
    tiles: Array.from({ length: 49 }, (_, index) => {
      const tx = index % 7, ty = Math.floor(index / 7);
      return { tx, ty, terrain: "grass" as const, buildingId: buildings.find((b) => b.tx === tx && b.ty === ty)?.id ?? null, hasRoad: vertical ? tx === 1 : ty === 3 };
    }),
    houses: buildings.map((b, i) => ({ buildingId: b.id, level: 2, residents: 3 + i, hasWater: true, breadStock: 4 + i, lastServicedTick: 20 + i, unmetRequirementTicks: i, starvationGraceUntilTick: 50 + i })),
    population: 7, walkers: [], constructionSites: [], palisade: null, pathCache: { old: [{ tx: 1, ty: 1 }] },
  };
}

for (const vertical of [false, true]) for (const reversed of [false, true]) {
  test(`merge ${vertical ? "vertical" : "horizontal"}, reversed=${reversed}, conserves households`, () => {
    const before = pair(vertical), source = reversed ? "b" : "a", target = reversed ? "a" : "b";
    assert.equal(houseMergeOptions(before, source)[0]?.enabled, true);
    const after = gameReducer(before, { type: "merge_houses", sourceBuildingId: source, targetBuildingId: target });
    assert.equal(after.buildings.length, 1);
    assert.equal(after.buildings[0]?.id, source);
    assert.equal(after.buildings[0]?.houseLot, vertical ? "vertical" : "horizontal");
    assert.equal(after.buildings[0]?.tx, 2); assert.equal(after.buildings[0]?.ty, 2);
    assert.equal(after.houses[0]?.residents, 7); assert.equal(after.houses[0]?.breadStock, 9);
    assert.equal(after.houses[0]?.lastServicedTick, 20); assert.equal(after.houses[0]?.starvationGraceUntilTick, 50);
    assert.equal(after.houses[0]?.unmetRequirementTicks, 1);
    assert.equal(after.population, before.population); assert.equal(after.treasuryTimber, before.treasuryTimber);
    assert.equal(after.tiles.filter((t) => t.buildingId === source).length, 2);
    assert.equal(after.roadRevision, before.roadRevision + 1); assert.deepEqual(after.pathCache, {});
    assert.equal(mergeHouses(after, source, target), after);
    assert.equal(before.buildings.length, 2);
  });
}

test("rejects mismatched levels, chains, invalid ownership, roads, terrain and stock", () => {
  const original = pair();
  const cases: GameState[] = [
    { ...original, houses: original.houses.map((h, i) => ({ ...h, level: i ? 1 : 2 })) },
    { ...original, buildings: original.buildings.map((b, i) => i ? b : { ...b, houseLot: "horizontal" }) },
    { ...original, tiles: original.tiles.map((t) => t.tx === 0 && t.ty === 0 ? { ...t, buildingId: "a" } : t) },
    ...(["road", "water", "rock"] as const).map((kind): GameState => ({ ...original, tiles: original.tiles.map((t) => t.buildingId === "b" ? kind === "road" ? { ...t, hasRoad: true } : { ...t, terrain: kind } : t) })),
    ...(["inventory", "reserved", "stockReserved"] as const).map((field): GameState => ({ ...original, buildings: original.buildings.map((b) => b.id === "b" ? { ...b, [field]: { timber: 1 } } : b) })),
    { ...original, tiles: original.tiles.map((t) => ({ ...t, hasRoad: false })) },
  ];
  for (const before of cases) assert.equal(mergeHouses(before, "a", "b"), before);
});

test("merged capacity, growth and starvation retain two housing lots", () => {
  const house = { buildingId: "a", level: 2, residents: 7, hasWater: true, breadStock: 9, lastServicedTick: BALANCE.GROWTH_INTERVAL, unmetRequirementTicks: 0 };
  const grown = updateHouse(house, { tick: BALANCE.GROWTH_INTERVAL + houseGrowthPhase("a"), hasGranaryNearby: false, lotArea: 2 });
  assert.equal(grown.residents, 9);
  const starved = updateHouse({ ...house, lastServicedTick: 0, breadStock: 0, emptyFoodTicks: 301 }, { tick: BALANCE.GROWTH_INTERVAL * 100 + houseGrowthPhase("a"), hasGranaryNearby: false, lotArea: 2 });
  assert.equal(starved.residents, 5);
});

test("road access on only the second half works; diagonal access does not", () => {
  const before = pair();
  const secondRoad = { ...before, tiles: before.tiles.map((tile) => ({ ...tile, hasRoad: tile.tx === 4 && tile.ty === 2 })) };
  assert.notEqual(mergeHouses(secondRoad, "a", "b"), secondRoad);
  const diagonal = { ...before, tiles: before.tiles.map((tile) => ({ ...tile, hasRoad: tile.tx === 4 && tile.ty === 3 })) };
  assert.equal(mergeHouses(diagonal, "a", "b"), diagonal);
});

test("planned and completed walls block touching or shared edges but permit a one-tile exterior setback", () => {
  const base = pair();
  for (const completed of [false, true]) {
    const before: GameState = { ...base, palisade: { id: "wall", polygon: [], gate: { x: 0, y: 0 }, segments: [{ id: "wall-1", order: 0, edgePath: [{ x: 3, y: 2 }, { x: 3, y: 3 }], tileCount: 1, completed, constructionSiteId: null }] } };
    assert.equal(mergeHouses(before, "a", "b"), before);
    const wall = before.palisade;
    assert.ok(wall);
    const segment = wall.segments[0];
    assert.ok(segment);
    const exterior: GameState = { ...before, palisade: { ...wall, segments: [{ ...segment, edgePath: [{ x: 2, y: 2 }, { x: 4, y: 2 }] }] } };
    assert.equal(mergeHouses(exterior, "a", "b"), exterior);
    const setback: GameState = { ...before, palisade: { ...wall, segments: [{ ...segment, edgePath: [{ x: 2, y: 1 }, { x: 4, y: 1 }] }] } };
    assert.notEqual(mergeHouses(setback, "a", "b"), setback);
  }
});

test("every walker reference blocks merge, including released or zero-amount claims", () => {
  const base = pair();
  const carter: CarterWalker = { id: "carter", kind: "carter", homeBuildingId: "other", position: { tx: 0, ty: 0 }, path: [], pathIndex: 0, previousTile: null, cargo: null, spawnedTick: 0, mission: "deliver", phase: "returning", destination: { kind: "building", buildingId: "other" }, reservation: { destination: { kind: "building", buildingId: "other" }, resource: "timber", amount: 0, sourceStockClaim: null, homeCapacityClaim: null }, cancellation: null };
  const references: CarterWalker[] = [
    { ...carter, homeBuildingId: "a" },
    { ...carter, destination: { kind: "building", buildingId: "a" } },
    { ...carter, reservation: { ...carter.reservation, destination: { kind: "building", buildingId: "a" } } },
    { ...carter, reservation: { ...carter.reservation, sourceStockClaim: { kind: "building", buildingId: "a", resource: "timber", amount: 0 } } },
    { ...carter, reservation: { ...carter.reservation, homeCapacityClaim: { buildingId: "a", resource: "timber", amount: 0 } } },
  ];
  for (const walker of references) {
    const before = { ...base, walkers: [walker] };
    assert.equal(mergeHouses(before, "a", "b"), before);
  }
  assert.notEqual(mergeHouses({ ...base, walkers: [carter] }, "a", "b"), base);
});

test("construction overlap blocks merge and an unrelated construction survives", () => {
  const base = pair();
  const site = createConstructionSite({ ordinal: 999, kind: "well", tx: 3, ty: 2, startedTick: 0 });
  const before = { ...base, constructionSites: [site] };
  assert.equal(mergeHouses(before, "a", "b"), before);
  const unrelated = { ...base, constructionSites: [{ ...site, tx: 5, ty: 5 }] };
  assert.deepEqual(mergeHouses(unrelated, "a", "b").constructionSites, unrelated.constructionSites);
});

for (const vertical of [false, true]) test(`food service reaches far side of ${vertical ? "vertical" : "horizontal"} house and preserves cargo`, () => {
  for (const cargo of [1, 3]) {
    const tile = vertical ? { tx: 2, ty: 4 } : { tx: 4, ty: 2 };
    const walker: DistributorWalker = { id: "d", kind: "distributor", homeBuildingId: "granary", position: tile, path: [tile], pathIndex: 0, previousTile: null, cargo: { resource: "bread", amount: cargo }, spawnedTick: 0, phase: "roaming", junctionVisits: 0, tilesTravelled: 0, priorTile: null };
    const next = stepDistributors({ tick: 5, buildings: [], walkers: [walker], houses: [{ buildingId: "a", tx: 2, ty: 2, width: vertical ? 1 : 2, height: vertical ? 2 : 1, residents: 16, breadStock: 4, lastServicedTick: 0 }], routes: { homePath: () => [tile], returnPath: () => [tile], neighbors: () => [], isRoad: () => true }, rngForJunction: () => createMulberry32(1) });
    assert.equal(next.houses[0]?.breadStock, 4 + Math.min(cargo, 2));
    assert.equal(next.houses[0]?.lastServicedTick, 5);
    assert.equal(next.walkers[0]?.cargo?.amount ?? 0, Math.max(0, cargo - 2));
  }
});

test("devolution keeps the merged footprint and conservative freshness", () => {
  const base = pair();
  const before = { ...base, houses: base.houses.map(({ starvationGraceUntilTick: _grace, ...house }, i) => ({ ...house, hasWater: i === 0, unmetRequirementTicks: BALANCE.DEVOLUTION_GRACE - 1 })) };
  const merged = mergeHouses(before, "a", "b");
  assert.equal(merged.houses[0]?.hasWater, false);
  assert.equal(merged.houses[0]?.starvationGraceUntilTick, 0);
  const next = advanceTick(merged);
  assert.equal(next.buildings[0]?.houseLot, "horizontal");
  assert.equal(next.houses[0]?.level, 1);
  assert.equal(next.tiles.filter((tile) => tile.buildingId === "a").length, 2);
});

test("lot orientation and merged starvation grace contribute to deterministic state hashes", () => {
  const state = mergeHouses(pair(), "a", "b");
  const vertical: GameState = { ...state, buildings: state.buildings.map((building) => ({ ...building, houseLot: "vertical" })) };
  assert.notEqual(hashEconomyState(state), hashEconomyState(vertical));
  assert.notEqual(hashOpeningState(state), hashOpeningState(vertical));
  const grace = { ...state, houses: state.houses.map((house) => ({ ...house, starvationGraceUntilTick: 999 })) };
  assert.notEqual(hashEconomyState(state), hashEconomyState(grace));
});

test("missing, same-house, diagonal and stale level requests are no-ops", () => {
  const base = pair();
  assert.equal(mergeHouses(base, "missing", "b"), base);
  assert.equal(mergeHouses(base, "a", "a"), base);
  const diagonal = { ...base, buildings: base.buildings.map((building) => building.id === "b" ? { ...building, ty: 3 } : building) };
  assert.equal(mergeHouses(diagonal, "a", "b"), diagonal);
  for (const level of [0, 1, 2.5, 5]) {
    const stale = { ...base, houses: base.houses.map((house) => ({ ...house, level })) };
    assert.equal(mergeHouses(stale, "a", "b"), stale);
  }
});

test("merge labels describe all four neighbor directions on the fixed isometric screen", () => {
  const cases = [
    { vertical: false, source: "a", label: "오른쪽 아래 주택과 2×1 합필" },
    { vertical: false, source: "b", label: "왼쪽 위 주택과 2×1 합필" },
    { vertical: true, source: "a", label: "왼쪽 아래 주택과 1×2 합필" },
    { vertical: true, source: "b", label: "오른쪽 위 주택과 1×2 합필" },
  ];
  for (const entry of cases) {
    assert.equal(houseMergeOptions(pair(entry.vertical), entry.source)[0]?.label, entry.label);
  }
});


test("merge retains matching built history and rejects different forms despite equal living level", () => {
  const original = pair();
  const matching = { ...original, houses: original.houses.map(house => ({ ...house, builtLevel: 4 })) };
  const merged = mergeHouses(matching, "a", "b");
  assert.equal(merged.houses[0]?.builtLevel, 4);
  assert.equal(merged.houses[0]?.level, 2);
  assert.equal(merged.houses[0]?.residents, 7);
  const mismatched = { ...matching, houses: matching.houses.map((house, index) => ({ ...house, builtLevel: index === 0 ? 3 : 4 })) };
  assert.equal(mergeHouses(mismatched, "a", "b"), mismatched);
  assert.match(houseMergeOptions(mismatched, "a")[0]?.reason ?? "", /건축 단계가 같은/);
});

test("merging preserves hunger duration conservatively and food clears it", () => {
  const base = pair();
  const hungry = { ...base, houses: base.houses.map((house, index) => ({ ...house, breadStock: 0, emptyFoodTicks: index === 0 ? 200 : 350 })) };
  assert.equal(mergeHouses(hungry, "a", "b").houses[0]?.emptyFoodTicks, 350);
  const fed = { ...hungry, houses: hungry.houses.map((house, index) => ({ ...house, breadStock: index })) };
  assert.equal(mergeHouses(fed, "a", "b").houses[0]?.emptyFoodTicks, 0);
});
