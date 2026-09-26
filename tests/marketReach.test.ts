import assert from "node:assert/strict";
import test from "node:test";

import { loadAutoplayFixture } from "../scripts/autoplayStallProbe";
import { urbanServiceAction } from "../src/engine/autoplayServices";
import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import { anotherMarketAllowed, MARKET_ROAD_REACH, MARKET_UNSERVED_LOTS_FOR_ANOTHER, marketReach, marketRoadDistance, marketRoadService, marketUnservedLots } from "../src/engine/marketService";
import { buildingFootprintDistance } from "../src/geometry/buildingDistance";
import { allocateHouseServices } from "../src/population/serviceAllocation";

// MARKET-1 market reach (spec docs/design/market-reach.md MK-1…MK-4), work order M1–M4.
const TOWNS = ["fixtures/autoplay/seed2-1200000.json.gz", "fixtures/autoplay/seed4-f0a-1200000.json.gz", "fixtures/autoplay/seed3-792000.json.gz"] as const;

const markets = (state: GameState) => state.buildings.filter(building => building.kind === "market");
const homes = (state: GameState) => state.buildings.filter(building => building.kind === "house");

test("M1 a market serves the homes within 40 road steps — near by road though far by air, not near by air though far by road", () => {
  let farByAir = 0;
  for (const path of TOWNS) {
    const state = loadAutoplayFixture(path);
    const distance = marketRoadDistance(state);
    const services = householdServices(state);
    for (const home of homes(state)) {
      const within = markets(state).filter(market => { const steps = distance(home, market); return steps !== null && steps <= MARKET_ROAD_REACH; });
      const access = services.houses.get(home.id)!.market;
      // Served only by a market within its road reach; out of every market's road reach is `outside`.
      if (access.kind === "served") assert.ok(within.some(market => market.id === access.providerId), `${path} ${home.id}`);
      if (within.length === 0 && markets(state).length > 0) assert.equal(access.kind, "outside", `${path} ${home.id}`);
      farByAir += within.filter(market => buildingFootprintDistance(home, market) > 8).length;
    }
  }
  assert.ok(farByAir > 0, "some homes are reached along the road beyond the old radius of 8");
  assert.equal(MARKET_ROAD_REACH, 40);
});

test("M2 no count cap on markets: the first is always allowed, another only while 12 lots or more go unserved", () => {
  const state = loadAutoplayFixture(TOWNS[0]);
  const services = householdServices(state);
  assert.equal(anotherMarketAllowed(state, services), marketUnservedLots(state, services) >= MARKET_UNSERVED_LOTS_FOR_ANOTHER);
  assert.equal(MARKET_UNSERVED_LOTS_FOR_ANOTHER, 12);
  // Without its markets the town may have its first one.
  const bare: GameState = { ...state, buildings: state.buildings.filter(building => building.kind !== "market") };
  assert.equal(anotherMarketAllowed(bare, householdServices(bare)), true);
  // A served town with fewer than 12 unserved lots gets no further market from the bot's service planner.
  if (!anotherMarketAllowed(state, services)) {
    const diagnostic: { services?: { service: string; reason: string }[] } = {};
    const action = urbanServiceAction(state, diagnostic as never);
    assert.ok(!(action.kind === "place_building" && action.building === "market"));
  }
});

test("M3 the placement preview's reach is the road tiles within 40 steps and the homes the market would serve", () => {
  const state = loadAutoplayFixture(TOWNS[0]);
  const market = markets(state)[0]!;
  const reach = marketReach(state, market);
  assert.ok(reach.roadTiles.length > 0 && reach.homeIds.length > 0);
  const inReach = marketRoadService(state).marketReach!;
  assert.deepEqual([...reach.homeIds].sort(), homes(state).filter(home => inReach(home, market)).map(home => home.id).sort());
  // A market not yet built (a preview at another site) gets its reach the same way.
  const other = { ...market, id: "preview-market", tx: markets(state).at(-1)!.tx, ty: markets(state).at(-1)!.ty };
  assert.ok(marketReach(state, other).roadTiles.length > 0);
});

test("M4 the reach is calibrated so the old radius's homes keep their market, and the rule reads the same through every allocation", () => {
  for (const path of TOWNS) {
    const state = loadAutoplayFixture(path);
    const connection = marketRoadService(state);
    const plain = (home: Parameters<typeof connection>[0], market: Parameters<typeof connection>[1]) => connection(home, market);
    const old = allocateHouseServices({ houses: state.houses, buildings: state.buildings, roadService: plain });
    const now = householdServices(state);
    const oldServed = [...old.houses].filter(([, access]) => access.market.kind === "served").length;
    const nowServed = [...now.houses].filter(([, access]) => access.market.kind === "served").length;
    assert.ok(nowServed >= oldServed, `${path}: ${nowServed} served now, ${oldServed} by the old radius`);
    // The bot's projections pass the engine's road service: the same allocation.
    assert.deepEqual(allocateHouseServices({ houses: state.houses, buildings: state.buildings, roadService: marketRoadService(state) }), now);
  }
});
