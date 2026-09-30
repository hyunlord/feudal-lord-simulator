/**
 * FIX-10 (specs docs/design/timber-trade.md TT-1…TT-4, docs/design/map-archetypes.md FD-1…FD-4): timber bought dear from
 * the market's traders (the player's order and the bot's), and the river's fords as roads — cheaper than a bridge,
 * slower to wade — with the bot crossing the water for the rock or wood it lacks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { COASTAL_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { TIMBER_TRADE_BALANCE } from "../src/content/timberTradeConfig";
import { crossingAction } from "../src/engine/autoplayCrossing";
import { TIMBER_EXPANSION_OBSERVATION_TICKS } from "../src/engine/autoplayTimberRecovery";
import type { GameState } from "../src/engine/engine.types";
import { MARKET_CADENCE_TICKS } from "../src/engine/marketSettlement";
import { roadPlacementFailure, roadTimberCost } from "../src/engine/roadPlacement";
import { advanceTimberTrade, botTimberOrder, botTimberOrderFor, orderTimber, timberTradeMarket } from "../src/engine/timberTrade";
import { treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { BRIDGE_TIMBER_PER_TILE, canTraverseRoadBoundary, FORD_TIMBER_PER_TILE, isFordCell, isFordRoad } from "../src/world/bridges";
import { FORD_PACE_DIVISOR, wadingPace } from "../src/agents/wading";
import { roadLine } from "../src/world/roadGraph";
import { findExistingRoadPath } from "../src/world/roadGraph";
import { placementSpendableResource } from "../src/world/placement";

const town = () => decodeSave(new Uint8Array(readFileSync("fixtures/saves/v33/chapter-five-town.save.json"))).envelope.state as GameState;
const marketDay = (state: GameState) => ({ ...state, tick: Math.ceil((state.tick + 1) / MARKET_CADENCE_TICKS) * MARKET_CADENCE_TICKS });

test("TT-1 the timber order: a standing order of 0…400, 0 cancels; the command sets it and nothing else", () => {
  const state = town();
  assert.equal(orderTimber(state, 30).timberOrder, 30);
  assert.equal(orderTimber(state, 9_999).timberOrder, TIMBER_TRADE_BALANCE.maxOrder);
  assert.equal("timberOrder" in orderTimber(orderTimber(state, 30), 0), false, "0 cancels");
  assert.equal(orderTimber(state, -5), state);
  const ordered = gameReducer(state, { type: "order_timber", amount: 12 });
  assert.equal(ordered.timberOrder, 12);
  assert.equal(ordered.treasuryTimber, state.treasuryTimber);
});

test("TT-2 TT-3 on a market day with a staffed market the traders bring two timber at 18d each, posted, until the order is filled; not without a market or the coin", () => {
  const base = marketDay(orderTimber(town(), 3));
  assert.ok(timberTradeMarket(base) !== null, "the town's market trades");
  const first = advanceTimberTrade(base);
  assert.equal(first.treasuryTimber, base.treasuryTimber + TIMBER_TRADE_BALANCE.perMarketDay);
  assert.equal(treasuryBalance(first), treasuryBalance(base) - TIMBER_TRADE_BALANCE.perMarketDay * TIMBER_TRADE_BALANCE.price);
  assert.equal(first.ledger!.entries.at(-1)!.category, "timber_purchase");
  assert.equal(first.timberOrder, 1);
  const second = advanceTimberTrade({ ...first, tick: first.tick + MARKET_CADENCE_TICKS });
  assert.equal(second.treasuryTimber, base.treasuryTimber + 3);
  assert.equal("timberOrder" in second, false, "filled: the order is gone");
  const between = { ...base, tick: base.tick + 1 };
  assert.equal(advanceTimberTrade(between), between, "not between market days");
  const noMarket = { ...base, buildings: base.buildings.filter(building => building.kind !== "market") };
  assert.equal(advanceTimberTrade(noMarket), noMarket, "the order waits for a market");
  const poor = { ...base, treasuryCoin: TIMBER_TRADE_BALANCE.price - 1 };
  assert.equal(advanceTimberTrade(poor), poor, "the treasury cannot pay for one");
});

test("TT-4 the bot orders its wall's missing timber after a whole shortage window, keeping 300d; not before, not twice", () => {
  const state = town();
  const wallShort = { ...state, timberProductionWindow: { ...(state.timberProductionWindow ?? { produced: 0 }), expansionShortageSinceTick: state.tick - TIMBER_EXPANSION_OBSERVATION_TICKS } } as GameState;
  const need = (wallShort.constructionSites as GameState["constructionSites"]).length;
  void need;
  const order = botTimberOrder(wallShort);
  const wallNeed = wallShort.constructionSites.filter(site => site.kind === "palisade_segment" || site.kind === "stone_wall_segment")
    .reduce((sum, site) => sum + Math.max(0, (site.required.timber ?? 0) - (site.delivered.timber ?? 0)), 0) - placementSpendableResource(wallShort, "timber");
  if (wallNeed >= TIMBER_TRADE_BALANCE.perMarketDay) assert.equal(order, Math.min(wallNeed, Math.floor((wallShort.treasuryCoin - 300) / 18), 400));
  else assert.equal(order, null);
  assert.equal(botTimberOrder({ ...wallShort, timberProductionWindow: { ...wallShort.timberProductionWindow!, expansionShortageSinceTick: state.tick - 10 } }), null, "not before the window");
  assert.equal(botTimberOrder({ ...wallShort, timberOrder: 5 }), null, "an order stands");
  assert.equal(botTimberOrder({ ...wallShort, treasuryCoin: 300 }), null, "the reserve");
});

test("TT-4b a building short of timber alone, the town's sawmills idle a whole window: the bot orders the shortfall; not while its timber still comes", () => {
  const state = town();
  assert.ok(state.buildings.some(building => building.kind === "sawmill"));
  const spendable = placementSpendableResource(state, "timber");
  const stalled = { ...state, timberProductionWindow: { startTick: state.tick - 2399, throughTick: state.tick, produced: 0, productionTicks: [] } } as GameState;
  assert.equal(botTimberOrderFor(stalled, spendable + 40), 40);
  assert.equal(botTimberOrderFor(stalled, spendable + 1), TIMBER_TRADE_BALANCE.perMarketDay, "at least a market day's worth");
  assert.equal(botTimberOrderFor(stalled, spendable), null, "nothing short");
  assert.equal(botTimberOrderFor({ ...stalled, timberProductionWindow: { ...stalled.timberProductionWindow!, produced: 3 } }, spendable + 40), null, "the town's timber still comes");
  assert.equal(botTimberOrderFor({ ...stalled, treasuryCoin: 300 + 18 * 39 }, spendable + 40), null, "not above the reserve");
});

/** A harbour town (its brook has fords) with the treasury's timber for a crossing. */
function harbour(): GameState {
  const state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: COASTAL_ARCHETYPE_ID, seed: 1 })!;
  return { ...state, treasuryTimber: 200 };
}

/** A straight crossing bank → water → bank at one of the river's sites; `fords` picks a ford's or one of plain water. */
function crossing(state: GameState, fords: boolean): { from: { tx: number; ty: number }; to: { tx: number; ty: number }; water: { tx: number; ty: number }[] } {
  for (const site of state.river!.bridgeSites) for (const sign of [1, -1]) {
    const step = site.axis === "x" ? { tx: sign, ty: 0 } : { tx: 0, ty: sign };
    const water: { tx: number; ty: number }[] = [];
    let at = { tx: site.tx + step.tx, ty: site.ty + step.ty };
    while (state.tiles[at.ty * 64 + at.tx]?.terrain === "water" && water.length < 6) { water.push(at); at = { tx: at.tx + step.tx, ty: at.ty + step.ty }; }
    if (water.length === 0 || state.tiles[at.ty * 64 + at.tx]?.terrain !== "grass") continue;
    if (water.every(tile => isFordCell(state, tile)) === fords) return { from: { tx: site.tx, ty: site.ty }, to: at, water };
  }
  throw new Error("no crossing");
}

test("FD-1 a road over a ford: 1 timber a cell (a bridge 4), passable both ways, a road search crosses it; the river's other water still needs a bridge", () => {
  const state = harbour();
  assert.ok(state.river!.fords.length > 0);
  const ford = crossing(state, true);
  const line = roadLine(ford.from, ford.to);
  assert.equal(roadPlacementFailure(state, line), null);
  assert.equal(roadTimberCost(state, line), ford.water.length * FORD_TIMBER_PER_TILE);
  const built = gameReducer(state, { type: "place_road_line", start: ford.from, destination: ford.to });
  assert.ok(ford.water.every(tile => isFordRoad(built, tile)));
  assert.equal(built.treasuryTimber, state.treasuryTimber - ford.water.length * FORD_TIMBER_PER_TILE);
  assert.ok(canTraverseRoadBoundary(built, ford.from, ford.water[0]!) && canTraverseRoadBoundary(built, ford.water.at(-1)!, ford.to));
  assert.equal(findExistingRoadPath(built, { start: ford.from, destination: ford.to })?.length, ford.water.length + 2);
  const withoutFords = { ...state, river: { ...state.river!, fords: [] } };
  assert.equal(roadTimberCost(withoutFords, line), ford.water.length * BRIDGE_TIMBER_PER_TILE, "the same water without its ford is a bridge's");
});

test("FD-2 a step onto or off a ford goes at half pace", () => {
  const isFord = (tile: { tx: number; ty: number }) => tile.tx === 5;
  assert.equal(wadingPace(isFord, { tx: 4, ty: 0 }, { tx: 5, ty: 0 }, 0.14), 0.14 / FORD_PACE_DIVISOR);
  assert.equal(wadingPace(isFord, { tx: 5, ty: 0 }, { tx: 6, ty: 0 }, 0.14), 0.07);
  assert.equal(wadingPace(isFord, { tx: 6, ty: 0 }, { tx: 7, ty: 0 }, 0.14), 0.14);
  assert.equal(wadingPace(undefined, { tx: 4, ty: 0 }, { tx: 5, ty: 0 }, 0.14), 0.14, "a port without fords");
});

test("FD-4 the bot with no rock on its side lays one crossing from its roads to the far bank's rock — a ford first — and none once one stands", () => {
  const state = harbour();
  const roads = state.tiles.flatMap((tile, index) => tile.hasRoad ? [index] : []);
  assert.ok(roads.length > 0);
  // Every rock on the town's side of the brook becomes grass (the far side keeps its own).
  const side = new Uint8Array(4096); const queue = [...roads]; for (const index of queue) side[index] = 1;
  for (let head = 0; head < queue.length; head += 1) { const at = queue[head]!; const x = at % 64, y = (at - x) / 64;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const nx = x + dx!, ny = y + dy!; const next = ny * 64 + nx;
      if (nx < 0 || ny < 0 || nx > 63 || ny > 63 || side[next] === 1 || state.tiles[next]!.terrain === "water") continue; side[next] = 1; queue.push(next); } }
  const bare = { ...state, tiles: state.tiles.map((tile, index) => side[index] === 1 && tile.terrain === "rock" ? { ...tile, terrain: "grass" as const } : tile) };
  assert.ok(bare.tiles.some((tile, index) => tile.terrain === "rock" && side[index] !== 1), "rock across the water");
  // The bot's calls until the crossing stands (an approach road to the bank, then the crossing).
  let built = bare;
  let crossed: { from: { tx: number; ty: number }; to: { tx: number; ty: number } } | null = null;
  for (let call = 0; call < 12 && crossed === null; call += 1) {
    const action = crossingAction(built, "quarry");
    assert.equal(action.kind, "place_road", `call ${call}`);
    if (action.kind !== "place_road") return;
    const next = gameReducer(built, { type: "place_road_line", start: action.from, destination: action.to });
    assert.notEqual(next, built, "the reducer takes the bot's road");
    built = next;
    if (built.tiles.some(tile => tile.terrain === "water" && tile.hasRoad)) crossed = { from: action.from, to: action.to };
  }
  assert.ok(crossed !== null, "the crossing stands");
  const far = crossed.to;
  assert.equal(side[far.ty * 64 + far.tx], 0, "it reaches the far bank");
  assert.ok(findExistingRoadPath(built, { start: { tx: roads[0]! % 64, ty: Math.floor(roads[0]! / 64) }, destination: far }) !== null, "joined to the town's roads");
  assert.equal(crossingAction(built, "quarry").kind, "none", "one crossing a town");
  assert.equal(crossingAction(bare, "house" as never).kind, "none");
});
