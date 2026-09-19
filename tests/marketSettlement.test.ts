import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import { advanceTick } from "../src/engine/tick";
import { marketHasSaleCandidate } from "../src/engine/marketSettlement";
import { historicalFacilityAssetId } from "../src/render/historicalFacilityAssets";
import { hashEconomyState } from "../scripts/economyHarness";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { Tile } from "../src/world/world.types";

type Stock = Partial<Record<ResourceType, number>>;

function tile(tx: number, ty: number, input: Partial<Tile> = {}): Tile {
  return {
    tx,
    ty,
    terrain: "grass",
    buildingId: null,
    hasRoad: false,
    ...input,
  };
}

function building(input: {
  readonly id: string;
  readonly kind: Building["kind"];
  readonly tx: number;
  readonly ty: number;
  readonly workers?: number;
  readonly inventory?: Stock;
  readonly stockReserved?: Stock;
}): Building {
  return {
    id: input.id,
    kind: input.kind,
    tx: input.tx,
    ty: input.ty,
    workers: input.workers ?? 0,
    inventory: input.inventory ?? {},
    reserved: {},
    stockReserved: input.stockReserved ?? {},
    productionProgress: 0,
  };
}

function market(id: string, tx: number, ty: number, workers = 3): Building {
  return building({ id, kind: "market", tx, ty, workers });
}

function roadedState(buildings: readonly Building[], roads: readonly { readonly tx: number; readonly ty: number }[]) {
  const population = 2 * buildings.reduce((total, b) => total + (b.kind === "market" ? b.workers : BUILDING_CONFIG_BY_KIND[b.kind].workersRequired), 0);
  const homes = [{ buildingId: "residents", level: 0, residents: population, hasWater: false, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 }];
  const width = 18;
  const height = 8;
  const roadKeys = new Set(roads.map((road) => `${road.tx},${road.ty}`));
  const ownerByTile = new Map<string, string>();
  for (const placed of buildings) {
    const widthByKind = placed.kind === "storehouse" || placed.kind === "granary" || placed.kind === "market" ? 2 : 1;
    const heightByKind = widthByKind;
    for (let dy = 0; dy < heightByKind; dy += 1) {
      for (let dx = 0; dx < widthByKind; dx += 1) {
        ownerByTile.set(`${placed.tx + dx},${placed.ty + dy}`, placed.id);
      }
    }
  }
  return {
    ...DEFAULT_GAME_STATE,
    tick: 79,
    width,
    height,
    tiles: Array.from({ length: width * height }, (_unused, index) => {
      const tx = index % width;
      const ty = Math.floor(index / width);
      const key = `${tx},${ty}`;
      return tile(tx, ty, {
        hasRoad: roadKeys.has(key),
        buildingId: ownerByTile.get(key) ?? null,
      });
    }),
    buildings: [...buildings, building({ id: "residents", kind: "house", tx: 16, ty: 6 })],
    houses: homes,
    walkers: [],
    population,
    idleWorkers: 0,
    treasuryCoin: 0,
  };
}

const CONNECTED_ROAD = [
  { tx: 2, ty: 3 },
  { tx: 3, ty: 3 },
  { tx: 4, ty: 3 },
  { tx: 5, ty: 3 },
  { tx: 6, ty: 3 },
  { tx: 7, ty: 3 },
  { tx: 8, ty: 3 },
] as const;

test("market artwork queries actual connected surplus without consuming goods or ignoring reservations", () => {
  const placedMarket = market("market", 8, 1);
  const stocked = building({ id: "store", kind: "storehouse", tx: 1, ty: 1, inventory: { bread: 41 } });
  const state = roadedState([stocked, placedMarket], CONNECTED_ROAD);
  const before = JSON.stringify(state);
  assert.equal(marketHasSaleCandidate(state, placedMarket), true);
  assert.equal(historicalFacilityAssetId(placedMarket, state), "market_active");
  assert.equal(JSON.stringify(state), before);
  assert.equal(marketHasSaleCandidate(state, { ...placedMarket, workers: 2 }), false);
  const reserved = roadedState([{ ...stocked, stockReserved: { bread: 1 } }, placedMarket], CONNECTED_ROAD);
  assert.equal(marketHasSaleCandidate(reserved, placedMarket), false);
  assert.equal(historicalFacilityAssetId(placedMarket, reserved), "market_quiet");
  const disconnected = roadedState([stocked, placedMarket], CONNECTED_ROAD.filter(road => road.tx !== 5));
  assert.equal(marketHasSaleCandidate(disconnected, placedMarket), false);
  assert.equal(historicalFacilityAssetId(placedMarket, disconnected), "market_quiet");
});

test("market sells exactly one surplus unit above reserve on the eighty-tick cadence", () => {
  // Given: a staffed completed market connected to one storehouse with timber at reserve + 1.
  const store = building({
    id: "store",
    kind: "storehouse",
    tx: 1,
    ty: 1,
    workers: 2,
    inventory: { timber: 61 },
  });
  const state = roadedState([store, market("market", 8, 1)], CONNECTED_ROAD);

  // When: the next real tick reaches tick 80.
  const next = advanceTick(state);

  // Then: one total unit is sold, reserve remains intact, and coin is treasury-only.
  assert.equal(next.treasuryCoin, 6);
  assert.equal(next.buildings.find((candidate) => candidate.id === "store")?.inventory.timber, 60);
  assert.equal(next.walkers.some((walker) => walker.cargo?.resource === "coin"), false);
  assert.equal(next.buildings.some((candidate) => (candidate.inventory.coin ?? 0) > 0), false);
});

test("market does not sell at or below reserves and respects cadence and staffing", () => {
  // Given: short, exact, unstafed, and off-cadence states.
  const short = roadedState([
    building({ id: "short", kind: "storehouse", tx: 1, ty: 1, workers: 2, inventory: { timber: 59 } }),
    market("market", 8, 1),
  ], CONNECTED_ROAD);
  const exact = roadedState([
    building({ id: "exact", kind: "storehouse", tx: 1, ty: 1, workers: 2, inventory: { timber: 60 } }),
    market("market", 8, 1),
  ], CONNECTED_ROAD);
  const unstaffed = roadedState([
    building({ id: "surplus", kind: "storehouse", tx: 1, ty: 1, workers: 2, inventory: { timber: 61 } }),
    market("market", 8, 1, 2),
  ], CONNECTED_ROAD);
  const offCadence = { ...roadedState([
    building({ id: "surplus", kind: "storehouse", tx: 1, ty: 1, workers: 2, inventory: { timber: 61 } }),
    market("market", 8, 1),
  ], CONNECTED_ROAD), tick: 78 };

  // When / Then: none of these cases can create coin.
  assert.equal(advanceTick(short).treasuryCoin, 0);
  assert.equal(advanceTick(exact).treasuryCoin, 0);
  assert.equal(advanceTick(unstaffed).treasuryCoin, 0);
  assert.equal(advanceTick(offCadence).treasuryCoin, 0);
});

test("market chooses highest value then resource order then source id while ignoring reservations", () => {
  // Given: several eligible resources and a reserved high-value stone unit.
  const sourceA = building({
    id: "a-source",
    kind: "storehouse",
    tx: 1,
    ty: 1,
    workers: 2,
    inventory: { logs: 31, timber: 61, stone: 41 },
    stockReserved: { stone: 1 },
  });
  const sourceB = building({
    id: "b-source",
    kind: "granary",
    tx: 4,
    ty: 1,
    workers: 2,
    inventory: { wheat: 31, bread: 41 },
  });
  const state = roadedState([sourceA, sourceB, market("market", 8, 1)], CONNECTED_ROAD);

  // When
  const next = advanceTick(state);

  // Then: reserved stone is not sold, so timber wins over bread/logs/wheat.
  assert.equal(next.treasuryCoin, 6);
  assert.equal(next.buildings.find((candidate) => candidate.id === "a-source")?.inventory.timber, 60);
  assert.equal(next.buildings.find((candidate) => candidate.id === "a-source")?.stockReserved.stone, 1);
});

test("market ignores disconnected sources and reserved-only surplus", () => {
  // Given: disconnected surplus and connected stock whose only surplus is reserved.
  const connected = building({
    id: "connected",
    kind: "storehouse",
    tx: 1,
    ty: 1,
    workers: 2,
    inventory: { timber: 61 },
    stockReserved: { timber: 1 },
  });
  const disconnected = building({
    id: "disconnected",
    kind: "storehouse",
    tx: 13,
    ty: 1,
    workers: 2,
    inventory: { stone: 100 },
  });
  const state = roadedState([connected, disconnected, market("market", 8, 1)], CONNECTED_ROAD);

  // When
  const next = advanceTick(state);

  // Then
  assert.equal(next.treasuryCoin, 0);
  assert.equal(next.buildings.find((candidate) => candidate.id === "connected")?.inventory.timber, 61);
  assert.equal(next.buildings.find((candidate) => candidate.id === "disconnected")?.inventory.stone, 100);
});

test("multiple markets settle deterministically by market id and change the economy hash", () => {
  // Given: two markets and two eligible source buildings.
  const first = building({
    id: "source-a",
    kind: "storehouse",
    tx: 1,
    ty: 1,
    workers: 2,
    inventory: { stone: 42 },
  });
  const second = building({
    id: "source-b",
    kind: "storehouse",
    tx: 4,
    ty: 1,
    workers: 2,
    inventory: { stone: 42 },
  });
  const state = roadedState(
    [second, market("market-b", 10, 1), first, market("market-a", 8, 1)],
    [...CONNECTED_ROAD, { tx: 9, ty: 3 }, { tx: 10, ty: 3 }],
  );

  // When
  const next = advanceTick(state);

  // Then: both markets sell one unit in stable order, and treasury coin affects hashing.
  assert.equal(next.treasuryCoin, 16);
  assert.equal(next.buildings.find((candidate) => candidate.id === "source-a")?.inventory.stone, 40);
  assert.equal(next.buildings.find((candidate) => candidate.id === "source-b")?.inventory.stone, 42);
  assert.notEqual(hashEconomyState(state), hashEconomyState(next));
});

test("Given a palisade town saving stone When trading Then the next era reserve is preserved across connected stores", () => {
  const placedMarket = market("market", 8, 1);
  const stores = [
    building({ id: "west", kind: "storehouse", tx: 1, ty: 1, inventory: { stone: 200 } }),
    building({ id: "east", kind: "storehouse", tx: 4, ty: 1, inventory: { stone: 200 } }),
  ];
  const state = { ...roadedState([...stores, placedMarket], CONNECTED_ROAD), era: "palisade" as const };
  assert.equal(marketHasSaleCandidate(state, placedMarket), false);
  const surplus = { ...state, buildings: state.buildings.map(b => b.id === "east" ? { ...b, inventory: { stone: 201 } } : b) };
  assert.equal(marketHasSaleCandidate(surplus, placedMarket), true);
  const reserved = { ...surplus, buildings: surplus.buildings.map(b => b.id === "east" ? { ...b, stockReserved: { stone: 1 } } : b) };
  assert.equal(marketHasSaleCandidate(reserved, placedMarket), false);
  assert.equal(marketHasSaleCandidate({ ...state, era: "stone_town" }, placedMarket), true);
});

test('market cannot sell using stale assigned workers after the population disappears', () => {
  const store = building({ id: 'store', kind: 'storehouse', tx: 1, ty: 1, inventory: { timber: 61 } });
  const initial = roadedState([store, market('market', 8, 1)], CONNECTED_ROAD);
  const next = advanceTick({ ...initial, population: 0, houses: initial.houses.map(h => ({...h, residents: 0})) });
  assert.equal(next.treasuryCoin, 0);
  assert.equal(next.buildings.find(b => b.id === 'market')?.workers, 0);
  assert.equal(next.buildings.find(b => b.id === 'store')?.inventory.timber, 61);
});
