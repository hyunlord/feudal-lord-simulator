/**
 * LM-E6a (spec docs/design/trades.md TR-1…TR-9): lord mode's trades on the 176-person town — the data, the choice by
 * location score with its receipt, the butcher → tanner → shoemaker chain, one bottleneck per chain, the streets, the
 * carters' haulage, giving up a trade, and nothing at all outside lord mode.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { TRADE_GOOD_NAMES, TRADE_NAMES, WORKSHOP_NAMES, chainLine, streetName, tradeReceiptLine } from "../src/content/trades.ko";
import { TRADE_IDS, TRADES, WORKSHOP_ARCHETYPES, type TradeId } from "../src/content/trades";
import type { GameState } from "../src/engine/engine.types";
import { stuckStock } from "../src/engine/stuckStock";
import { initialAgency } from "../src/engine/townAgency";
import { advanceTrades, haulStuckStock, initialTrades, tradesOf } from "../src/engine/trades";
import type { TradeHousehold } from "../src/engine/trades.types";
import { migrateSaveToLatest } from "../src/save/migrations";
import { decodeSave } from "../src/save/saveCodec";

const SEASON_START = 61 * 1000;

function town(): GameState {
  return decodeSave(new Uint8Array(readFileSync("fixtures/saves/v46/population-176.save.json"))).envelope.state as GameState;
}

const lordTown = (): GameState => ({ ...town(), agency: initialAgency() });
const houseIds = (state: GameState) => state.houses.filter(house => house.residents > 0).map(house => house.buildingId).sort();

function household(houseId: string, tradeId: TradeId): TradeHousehold {
  return { houseId, tradeId, sinceTick: 0, workshop: TRADES.find(trade => trade.id === tradeId)!.workshop,
    receipt: { tick: 0, reasons: [], score: 0, chancePermille: 1000, of: 1 }, productivityPermille: 0, idleSeasons: 0 };
}

test("TR-1·TR-2 twenty trades (twelve core, eight by condition) on twelve workshop archetypes, every name in Korean", () => {
  assert.equal(TRADE_IDS.length, 20);
  assert.equal(TRADES.filter(trade => trade.core).length, 12);
  assert.equal(WORKSHOP_ARCHETYPES.length, 12);
  for (const trade of TRADES) {
    assert.ok(WORKSHOP_ARCHETYPES.includes(trade.workshop), trade.id);
    assert.ok(TRADE_NAMES[trade.id].length > 0, trade.id);
    assert.ok(trade.min <= trade.max && trade.perThousand > 0, trade.id);
    assert.equal(trade.seasons.length, 4, trade.id);
  }
  for (const archetype of WORKSHOP_ARCHETYPES) assert.ok(WORKSHOP_NAMES[archetype].length > 0, archetype);
  assert.equal(TRADE_NAMES.tanner, "무두장이");
  assert.equal(TRADE_GOOD_NAMES.hides, "생가죽");
});

test("TR-9 outside lord mode nothing happens; a v45 save migrates to v46 with nothing to add", () => {
  const sandbox = { ...town(), tick: SEASON_START };
  assert.equal(advanceTrades(sandbox), sandbox);
  const v45 = JSON.parse(readFileSync("fixtures/saves/v45/population-176.save.json", "utf8"));
  const migrated = migrateSaveToLatest(v45).value as { schemaVersion: number; state: GameState };
  assert.equal(migrated.schemaVersion, 46);
  assert.equal(migrated.state.trades, undefined);
});

test("TR-3·TR-4 at a season's start households take up trades by location score, each with its receipt", () => {
  const state = { ...lordTown(), tick: SEASON_START };
  const next = advanceTrades(state);
  const trades = tradesOf(next).households;
  assert.equal(trades.length, 2, "two choices a season");
  for (const chosen of trades) {
    assert.ok(houseIds(state).includes(chosen.houseId));
    assert.ok(chosen.receipt.reasons.length > 0);
    assert.equal(chosen.receipt.score, chosen.receipt.reasons.reduce((sum, reason) => sum + reason.value, 0));
    assert.match(tradeReceiptLine(chosen.tradeId, chosen.receipt.reasons), new RegExp(`^${TRADE_NAMES[chosen.tradeId]}: .+[+−]\\d+`));
    assert.ok(chosen.receipt.chancePermille > 0 && chosen.receipt.chancePermille <= 1000);
  }
  // The same state chooses the same; another seed may choose otherwise.
  assert.deepEqual(tradesOf(advanceTrades(state)).households, trades);
});

test("TR-5·TR-6 the butcher → tanner → shoemaker chain runs: hides become leather become shoes, and each chain names one cause", () => {
  const base = lordTown();
  const [a, b, c] = houseIds(base);
  const state: GameState = { ...base, tick: SEASON_START, trades: { ...initialTrades(), households: [household(a!, "butcher"), household(b!, "tanner"), household(c!, "shoemaker")] } };
  const next = tradesOf(advanceTrades(state));
  const by = (id: TradeId) => next.households.find(entry => entry.tradeId === id)!;
  assert.ok(by("butcher").productivityPermille > 0, "the butcher slaughtered");
  assert.ok(by("tanner").productivityPermille > 0, "the tanner tanned the butcher's hides");
  assert.ok(by("shoemaker").productivityPermille > 0, "the shoemaker used the leather");
  const chain = next.chains.meat_leather!;
  assert.ok(chain.productivityPermille > 0 && chain.productivityPermille <= 1000);
  assert.match(chainLine("meat_leather", chain), /^고기·가죽 생산성 \d+% — .+주원인: /);
  // Without hides the tanner makes nothing: the cause is the hides, with the days they last.
  const alone: GameState = { ...state, trades: { ...initialTrades(), households: [household(b!, "tanner")] } };
  const tanner = tradesOf(advanceTrades(alone)).chains.meat_leather!;
  assert.equal(tanner.productivityPermille, 0);
  assert.deepEqual(tanner.cause, { kind: "input", subject: "hides", days: 0 });
  assert.equal(chainLine("meat_leather", tanner), "고기·가죽 생산성 0% — 무두장이, 주원인: 생가죽 부족(0일분)");
});

test("TR-4 four seasons without output and the household gives the trade up; the trade stays shut four seasons", () => {
  const base = lordTown();
  const [a] = houseIds(base);
  let state: GameState = { ...base, trades: { ...initialTrades(), households: [{ ...household(a!, "tanner"), idleSeasons: 3 }] } };
  state = advanceTrades({ ...state, tick: SEASON_START });
  const trades = tradesOf(state);
  assert.ok(!trades.households.some(entry => entry.houseId === a && entry.tradeId === "tanner"));
  assert.deepEqual(trades.quits.at(-1), { houseId: a, tradeId: "tanner", tick: SEASON_START });
});

test("TR-8 three households of one trade within three cells of each other make a named street", () => {
  const base = lordTown();
  const spots = base.buildings.filter(building => building.kind === "house" && houseIds(base).includes(building.id));
  // The three houses closest together.
  const near = spots.flatMap(first => [spots.filter(other => Math.max(Math.abs(other.tx - first.tx), Math.abs(other.ty - first.ty)) <= 3)])
    .sort((left, right) => right.length - left.length)[0]!;
  assert.ok(near.length >= 3, "the fixture has three houses close together");
  const state: GameState = { ...base, tick: SEASON_START, trades: { ...initialTrades(), households: near.slice(0, 3).map(spot => household(spot.id, "butcher")) } };
  const streets = tradesOf(advanceTrades(state)).streets;
  assert.equal(streets.length, 1);
  assert.equal(streets[0]!.tradeId, "butcher");
  assert.equal(streets[0]!.namedTick, SEASON_START);
  assert.equal(streetName("butcher"), "푸줏간 거리");
});

test("TR-7 carters move stock stuck for want of carters to a store with room; with a market they carry out what no store can take", () => {
  const base = lordTown();
  const barn = base.buildings.find(building => building.kind === "farmstead")!;
  const granary = base.buildings.find(building => building.kind === "granary")!;
  const [a, b] = houseIds(base);
  // The barn without workers holds wheat; the granary has room: no_carrier.
  const stuckState: GameState = { ...base, buildings: base.buildings.map(building => building.id === barn.id ? { ...building, workers: 0, inventory: { ...building.inventory, wheat: 40 } }
    : building.id === granary.id ? { ...building, inventory: {} } : building) };
  const entry = stuckStock(stuckState).find(candidate => candidate.buildingId === barn.id);
  assert.equal(entry?.reason, "no_carrier");
  const none = haulStuckStock(stuckState, initialTrades());
  assert.equal(none.moved, 0, "no carters, nothing moves");
  const two = haulStuckStock(stuckState, { ...initialTrades(), households: [household(a!, "carter"), household(b!, "carter")] });
  assert.equal(two.moved, 16, "two carters, two loads");
  const barnAfter = two.state.buildings.find(building => building.id === barn.id)!;
  assert.equal(barnAfter.inventory.wheat, 24);
  // Every granary full: receiver_full. Without a market the carters cannot help; with one they carry it out.
  const capacity = BUILDING_CONFIG_BY_KIND.granary.storageCapacity;
  const full: GameState = { ...stuckState, buildings: stuckState.buildings.filter(building => building.kind !== "mill" && building.kind !== "market")
    .map(building => building.kind === "granary" ? { ...building, inventory: { bread: capacity } } : building.id === barn.id ? { ...building, workers: 2 } : building) };
  assert.equal(stuckStock(full).find(candidate => candidate.buildingId === barn.id)?.reason, "receiver_full");
  const carters = { ...initialTrades(), households: [household(a!, "carter")] };
  assert.equal(haulStuckStock(full, carters).carriedOut, 0, "no market: nowhere to sell");
  const market = { id: "market-test", kind: "market" as const, tx: 2, ty: 2, workers: 3, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  const withMarket = haulStuckStock({ ...full, buildings: [...full.buildings, market] }, carters);
  assert.equal(withMarket.carriedOut, 8, "one carter carries one load out to sell");
});
