import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import { MONEY_BALANCE } from "../src/content/balanceConfig";
import type { Building } from "../src/content/buildingConfig";
import { canProclaimStoneTownEra, confirmStoneTownProclamation } from "../src/engine/era";
import type { GameState, PalisadeState } from "../src/engine/engine.types";
import {
  accrueMilledWheat,
  accrueTollCrossings,
  marketStalls,
  moneyOf,
  settleMoneyPeriod,
  upkeepCharges,
} from "../src/engine/moneyRules";
import { settleMarkets } from "../src/engine/marketSettlement";
import { advanceTick } from "../src/engine/tick";
import { carterCrossings } from "../src/engine/tollCrossings";
import { accountBalance, LEDGER_PERIOD_TICKS, treasuryBalance } from "../src/ledger/ledger";
import type { LedgerEntry } from "../src/ledger/ledger.types";
import { allocateBuildingAndConstructionLabour } from "../src/population/labour";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { stoneProjectPredictionLines } from "../src/ui/moneyPrediction";
import type { Tile } from "../src/world/world.types";

const PERIOD = LEDGER_PERIOD_TICKS;

function building(id: string, kind: Building["kind"], patch: Partial<Building> = {}): Building {
  return { id, kind, tx: 0, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...patch };
}

function base(patch: Partial<GameState> = {}): GameState {
  return { ...structuredClone(DEFAULT_GAME_STATE), buildings: [], houses: [], tick: PERIOD, ...patch };
}

function postedAt(state: GameState, category: LedgerEntry["category"], account: LedgerEntry["account"] = "cash"): readonly LedgerEntry[] {
  return (state.ledger?.entries ?? []).filter(entry => entry.tick === state.tick && entry.category === category && entry.account === account);
}

const sum = (entries: readonly LedgerEntry[]) => entries.reduce((total, entry) => total + entry.amount, 0);

function cityFixture(): GameState {
  return JSON.parse(readFileSync("fixtures/determinism/seed1/final-state.json", "utf8")) as GameState;
}

/** A tick before the next period close, so a test run ends exactly on closes. */
function advanceToPeriodClose(state: GameState): GameState {
  let next = state;
  do next = advanceTick(next); while (next.tick % PERIOD !== 0);
  return next;
}

test("M-1 the market still trades surplus wheat out of storage but pays the treasury nothing", () => {
  const city = cityFixture();
  const tradeTick = Math.ceil((city.tick + 1) / 80) * 80;
  const traded = settleMarkets({ ...city, tick: tradeTick });
  const stock = (state: GameState) => state.buildings.reduce((total, candidate) =>
    total + Object.values(candidate.inventory).reduce((sub, amount) => sub + (amount ?? 0), 0), 0);
  assert.ok(stock(traded) < stock(city), "a market trade still moves one unit out of storage");
  assert.equal(treasuryBalance(traded), treasuryBalance(city));
  assert.equal(traded.ledger, city.ledger);

  let running = city;
  for (let tick = 0; tick < PERIOD; tick += 1) running = advanceTick(running);
  const sales = (running.ledger?.entries ?? []).filter(entry => entry.category === "market_sale" && entry.tick > city.tick);
  assert.deepEqual(sales, []);
});

test("M-2 twenty-four occupied homes pay rent by level, each sourced to its home", () => {
  const levels = [0, 1, 2, 3, 4, 4];
  const houses = Array.from({ length: 24 }, (_, index) => ({
    buildingId: `house-${String(index).padStart(2, "0")}`, level: levels[index % levels.length]!, residents: 4, hasWater: true,
    breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0,
  }));
  const empty = { ...houses[0]!, buildingId: "house-empty", residents: 0 };
  const settled = settleMoneyPeriod(base({ houses: [...houses, empty] }));
  const rent = postedAt(settled, "rent");
  const expected = houses.reduce((total, house) => total + MONEY_BALANCE.rentByLevel[house.level]!, 0);
  assert.equal(rent.length, 24);
  assert.equal(sum(rent), expected);
  assert.deepEqual(rent.map(entry => entry.sourceRefs[0]), houses.map(house => ({ type: "building", id: house.buildingId, detail: `level:${house.level}` })));
  assert.equal(treasuryBalance(settled), expected);
});

test("M-3 a mill that grinds 100 wheat pays 10; the remainder carries to the next period", () => {
  const mill = building("mill-1", "mill");
  let state = accrueMilledWheat(base({ buildings: [mill] }), new Map([["mill-1", 100]]));
  state = settleMoneyPeriod(state);
  assert.equal(sum(postedAt(state, "mill_toll")), 10);
  assert.deepEqual(postedAt(state, "mill_toll")[0]?.sourceRefs[0], { type: "building", id: "mill-1", detail: "wheat:100" });

  state = settleMoneyPeriod(accrueMilledWheat({ ...state, tick: PERIOD * 2 }, new Map([["mill-1", 17]])));
  assert.equal(sum(postedAt(state, "mill_toll")), 1);
  assert.deepEqual(moneyOf(state).millWheat, { "mill-1": 7 });

  for (const scenarioId of ["core:campaign_market_town", "core:sandbox"]) {
    const core = { ...base({ buildings: [mill] }), scenarioId };
    assert.notEqual(accrueMilledWheat(core, new Map([["mill-1", 10]])), core, `${scenarioId} keeps the lord's mill monopoly`);
  }
});

test("M-3 grinding in the tick accrues the wheat each mill used", () => {
  const city = cityFixture();
  const next = advanceToPeriodClose(city);
  const tolls = postedAt(next, "mill_toll");
  assert.ok(tolls.length > 0, "the stable city's mills pay mill toll");
  for (const entry of tolls) assert.equal(next.buildings.find(candidate => candidate.id === entry.sourceRefs[0].id)?.kind, "mill");
});

/** A 20×20 grass field with a vertical wall on x = 10 and one gate opening on the row y = 5. */
function walledField(completed: boolean): GameState {
  const tiles: Tile[] = [];
  for (let ty = 0; ty < 20; ty += 1) for (let tx = 0; tx < 20; tx += 1) tiles.push({ tx, ty, terrain: "grass", buildingId: null, hasRoad: ty === 5 });
  const palisade: PalisadeState = {
    id: "palisade-1", polygon: [{ x: 10, y: 0 }, { x: 10, y: 20 }], gate: { x: 10, y: 5.5 },
    segments: [{ id: "segment-1", order: 0, edgePath: [{ x: 10, y: 0 }, { x: 10, y: 20 }], tileCount: 20, completed, constructionSiteId: null }],
  };
  return base({ tiles, width: 20, height: 20, palisade });
}

function carter(id: string, pathIndex: number, path: readonly { tx: number; ty: number }[]): Walker {
  return {
    id, kind: "carter", homeBuildingId: "store", position: path[pathIndex]!, path, pathIndex, previousTile: null, cargo: null, spawnedTick: 0,
    mission: "deliver", phase: "outbound", destination: { kind: "building", buildingId: "store" },
    reservation: { destination: { kind: "building", buildingId: "store" }, resource: "timber", amount: 1, sourceStockClaim: null, homeCapacityClaim: null },
    cancellation: null,
  } as Walker;
}

test("M-4 ten carter passes through a gate pay 10; no gate or an unbuilt stretch pays nothing", () => {
  const road = [{ tx: 8, ty: 5 }, { tx: 9, ty: 5 }, { tx: 10, ty: 5 }, { tx: 11, ty: 5 }];
  const passes = (state: GameState) => {
    let accrued = state;
    for (let index = 0; index < 10; index += 1) {
      const before = [carter(`carter-${index}`, 1, road)];
      const after = [carter(`carter-${index}`, 2, road)];
      accrued = accrueTollCrossings(accrued, carterCrossings(accrued, before, after));
    }
    return settleMoneyPeriod(accrued);
  };
  const walled = passes(walledField(true));
  assert.equal(sum(postedAt(walled, "toll")), 10);
  assert.deepEqual(postedAt(walled, "toll")[0]?.sourceRefs[0], { type: "right", id: "gate:10,5.5", detail: "gate" });
  assert.equal(postedAt(passes({ ...walledField(true), palisade: null }), "toll").length, 0, "no gate");
  assert.equal(postedAt(passes(walledField(false)), "toll").length, 0, "the gate's stretch is not built");

  const alongWall = [{ tx: 9, ty: 4 }, { tx: 9, ty: 5 }, { tx: 9, ty: 6 }];
  assert.equal(carterCrossings(walledField(true), [carter("c", 0, alongWall)], [carter("c", 2, alongWall)]).size, 0, "walking beside the wall is no pass");
  const distributor = { ...carter("d", 1, road), kind: "distributor" } as unknown as Walker;
  assert.equal(carterCrossings(walledField(true), [distributor], [{ ...distributor, pathIndex: 2 } as Walker]).size, 0, "residents' walkers pay nothing");
});

test("M-4 stepping from a bank onto a bridge pays once per crossing", () => {
  const tiles: Tile[] = [];
  for (let ty = 0; ty < 10; ty += 1) for (let tx = 0; tx < 10; tx += 1) {
    const water = tx === 4 || tx === 5;
    tiles.push({ tx, ty, terrain: water ? "water" : "grass", buildingId: null, hasRoad: ty === 3 });
  }
  const state = base({ tiles, width: 10, height: 10 });
  const path = [{ tx: 2, ty: 3 }, { tx: 3, ty: 3 }, { tx: 4, ty: 3 }, { tx: 5, ty: 3 }, { tx: 6, ty: 3 }, { tx: 7, ty: 3 }];
  const counts = carterCrossings(state, [carter("c", 0, path)], [carter("c", 5, path)]);
  assert.deepEqual([...counts], [["bridge:4,3", 1]]);
});

test("M-5 an operating market with five stalls pays 20; a paused market pays nothing", () => {
  assert.equal(5 * MONEY_BALANCE.stallFeePerStall, 20);
  const city = { ...cityFixture(), tick: Math.ceil(cityFixture().tick / PERIOD) * PERIOD };
  const markets = city.buildings.filter(candidate => candidate.kind === "market");
  const stalls = new Map(markets.map(market => [market.id, marketStalls(city, market)]));
  assert.ok([...stalls.values()].some(count => count > 0));
  const settled = settleMoneyPeriod(city);
  for (const entry of postedAt(settled, "stall_fee")) {
    assert.equal(entry.amount, (stalls.get(entry.sourceRefs[0].id) ?? 0) * MONEY_BALANCE.stallFeePerStall);
  }
  const paused = { ...city, buildings: city.buildings.map(candidate => candidate.kind === "market" ? { ...candidate, operationPaused: true } : candidate) };
  assert.equal(postedAt(settleMoneyPeriod(paused), "stall_fee").length, 0);
  assert.ok(upkeepCharges(paused).every(charge => !markets.some(market => market.id === charge.facility.id)), "a paused market owes no upkeep");
});

test("M-6 upkeep beyond the balance goes to arrears, idles the facility and is repaid oldest first", () => {
  const facilities = [building("a-church", "church", { workers: 3 }), building("b-well", "well"), building("c-mill", "mill", { workers: 2 })];
  const { church, well, mill } = MONEY_BALANCE.upkeep;
  let state = settleMoneyPeriod(base({ buildings: facilities, treasuryCoin: 0 }));
  assert.equal(treasuryBalance(state), 0);
  assert.equal(accountBalance(state.ledger!, "arrears"), church + well + mill);
  assert.deepEqual(moneyOf(state).arrears.map(arrear => arrear.facility.id), ["a-church", "b-well", "c-mill"]);
  assert.ok(state.buildings.every(candidate => candidate.upkeepUnpaid === true && candidate.workers === 0));
  const labour = allocateBuildingAndConstructionLabour(state.buildings, [], 100, { era: "hamlet", tick: state.tick, eraProclaimedTick: null }, () => true);
  assert.ok(labour.buildings.every(candidate => candidate.workers === 0), "an unpaid facility takes no workers, like a paused one");

  // Rent covers this period's upkeep plus the church's old charge: this period is paid first, then the oldest
  // arrear (the church); the queue stops at the well's old charge, so the well and the mill stay idle.
  const home = { buildingId: "home", level: 0, residents: 3, hasWater: true, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 };
  const homes = (count: number) => Array.from({ length: count }, (_, index) => ({ ...home, buildingId: `home-${index}` }));
  const income = (church + well + mill) + church;
  state = settleMoneyPeriod({ ...state, tick: PERIOD * 2, houses: homes(income / MONEY_BALANCE.rentByLevel[0]) });
  const upkeep = postedAt(state, "upkeep");
  assert.deepEqual(upkeep.filter(entry => entry.sourceRefs.length === 1).map(entry => entry.sourceRefs[0].id), ["a-church", "b-well", "c-mill"]);
  assert.deepEqual(upkeep.filter(entry => entry.sourceRefs[1]?.detail === "arrears_paid").map(entry => entry.sourceRefs[0].id), ["a-church"]);
  assert.deepEqual(moneyOf(state).arrears.map(arrear => [arrear.facility.id, arrear.tick]), [["b-well", PERIOD], ["c-mill", PERIOD]]);
  assert.deepEqual(state.buildings.filter(candidate => candidate.upkeepUnpaid === true).map(candidate => candidate.id), ["b-well", "c-mill"]);

  // A large balance clears every old charge oldest first after this period's upkeep.
  const withCash = settleMoneyPeriod({ ...state, tick: PERIOD * 3, houses: homes(200) });
  assert.equal(accountBalance(withCash.ledger!, "arrears"), 0);
  assert.deepEqual(moneyOf(withCash).arrears, []);
  assert.ok(withCash.buildings.every(candidate => candidate.upkeepUnpaid === undefined), "paid facilities work again");
  assert.deepEqual(postedAt(withCash, "upkeep").filter(entry => entry.sourceRefs[1]?.detail === "arrears_paid").map(entry => entry.sourceRefs[0].id), ["b-well", "c-mill"]);
});

function stoneReady(patch: Partial<GameState> = {}): GameState {
  return {
    ...structuredClone(DEFAULT_GAME_STATE), era: "palisade", population: 140, treasuryTimber: 0, treasuryCoin: 250, constructionSites: [],
    buildings: [building("market", "market"), building("masonry", "masonry"), building("store", "storehouse", { inventory: { stone: 400 } })],
    ...patch,
  };
}

test("M-7 proclaiming the stone-wall project spends 200; short of it the proclamation is blocked with a prediction line", () => {
  const ready = stoneReady();
  const proclaimed = confirmStoneTownProclamation(ready);
  assert.equal(proclaimed.era, "stone_town");
  assert.equal(treasuryBalance(proclaimed), 50);
  const project = (proclaimed.ledger?.entries ?? []).filter(entry => entry.category === "project");
  assert.deepEqual(project.map(entry => [entry.amount, entry.sourceRefs[0]]), [[-200, { type: "policy", id: "stone_wall_project", detail: "proclaimed" }]]);
  assert.equal(stoneProjectPredictionLines(ready)[0]?.severity, "info");

  const short = stoneReady({ treasuryCoin: 199 });
  assert.equal(canProclaimStoneTownEra(short), false);
  assert.equal(confirmStoneTownProclamation(short), short);
  const line = stoneProjectPredictionLines(short)[0];
  assert.equal(line?.severity, "block");
  assert.deepEqual(line?.sources, [{ type: "policy", id: "stone_wall_project" }]);
});

test("M-8 a 24-lot stable city over ten periods: every entry sourced, no arrears, each close within ±10% of its balance", () => {
  let state = cityFixture();
  const firstClose = Math.ceil(state.tick / PERIOD) * PERIOD;
  while (state.tick < firstClose) state = advanceTick(state);
  const periods: { income: number; spending: number; start: number }[] = [];
  for (let period = 0; period < 10; period += 1) {
    const start = treasuryBalance(state);
    state = advanceToPeriodClose(state);
    const posted = (state.ledger?.entries ?? []).filter(entry => entry.tick === state.tick && entry.account === "cash");
    periods.push({ start, income: sum(posted.filter(entry => entry.amount > 0)), spending: -sum(posted.filter(entry => entry.amount < 0)) });
  }
  assert.ok((state.ledger?.entries ?? []).every(entry => entry.sourceRefs.length > 0));
  assert.deepEqual(moneyOf(state).arrears, []);
  for (const period of periods) {
    const net = period.income - period.spending;
    assert.ok(net >= 0, `net ${net} is not negative`);
    assert.ok(Math.abs(net) <= period.start * 0.1, `net ${net} is within 10% of ${period.start}`);
    assert.ok(period.income >= period.spending * 1.2, `income ${period.income} is at least 1.2 × upkeep ${period.spending}`);
  }
});

test("M-9 save v8 round-trips the money state; a v7 save loads with none; a broken arrears queue is refused", () => {
  assert.equal(SAVE_SCHEMA_VERSION, 8);
  const bytes = readFileSync("fixtures/saves/v8/money-arrears.save.json");
  const { envelope } = decodeSave(new Uint8Array(bytes));
  assert.deepEqual(moneyOf(envelope.state).arrears.map(arrear => arrear.facility.id), ["storehouse-41-40-0", "well-45-41-0"]);
  assert.equal(envelope.state.buildings.filter(candidate => candidate.upkeepUnpaid === true).length, 2);
  const again = decodeSave(encodeSave({ state: envelope.state, createdAt: envelope.createdAt, savedAt: envelope.savedAt, gameVersion: envelope.gameVersion }).bytes);
  assert.deepEqual(again.envelope.state.money, envelope.state.money);

  const v7 = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v7/ledger-rollup.save.json")));
  assert.equal(v7.migratedFrom, 7);
  assert.equal(v7.envelope.state.money, undefined);
  assert.ok(v7.envelope.state.ledger!.entries.some(entry => entry.category === "market_sale"), "old market sales stay as history");

  const corrupt = (state: GameState) => encodeSave({ state, createdAt: envelope.createdAt, savedAt: envelope.savedAt, gameVersion: envelope.gameVersion }).bytes;
  const state = envelope.state;
  assert.throws(() => decodeSave(corrupt({ ...state, money: { ...moneyOf(state), arrears: moneyOf(state).arrears.slice(1) } })), /arrears|unpaid/);
  assert.throws(() => decodeSave(corrupt({ ...state, buildings: state.buildings.map(candidate => {
    const { upkeepUnpaid: _unpaid, ...rest } = candidate;
    return rest;
  }) })), /unpaid buildings do not match/);
  assert.throws(() => decodeSave(corrupt({ ...state, money: { ...moneyOf(state), crossings: { "gate:1,1": -1 } } })), /money must hold/);
});
