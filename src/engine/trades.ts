/**
 * LM-E6a (spec docs/design/trades.md TR-1…TR-9): lord mode's trades — households take up a trade by their plot's
 * location score (with a receipt), make goods or services each season, pass goods along the chains, gather into named
 * streets, and the carters move stuck stock. Nothing here runs without `state.agency` (lord mode): sandbox and campaign
 * are untouched. The trade layer reads the game's resources and never takes them; only the carters' haulage moves game
 * goods (stuck stock, TR-7).
 */
import { INPUT_PULL } from "../content/recoveryConfig";
import { inputReorderPoint } from "../agents/deliverySpawn";
import { LORD_INTAKE_RULES } from "./recovery";
import { BUILDING_CONFIG_BY_KIND, type Building, operationSuspended } from "../content/buildingConfig";
import { hashSeed } from "../content/seedHash";
import type { StorableResourceType } from "../content/resourceConfig";
import { isStorableResource } from "../content/resourceConfig";
import {
  EXPORT_PER_MERCHANT, IMPORTS, TOWN_DEMAND_PER_HUNDRED, TRADE_BALANCE, TRADE_BY_ID, TRADE_CHAINS, TRADE_IDS, TRADES, WORKSHOP_PLOT,
  type LocationFactor, type TradeChain, type TradeDefinition, type TradeGood, type TradeId,
} from "../content/trades";
import { acceptsResource, availableSpace, storageIntakeSpace } from "../economy/storage";
import { isFlowingWater } from "../world/river";
import { BALANCE } from "../content/balanceConfig";
import { foodReserveTicks } from "../population/foodReserve";
import { foodPricePermille } from "./eventSchedule";
import type { GameState } from "./engine.types";
import { createDeliveryInventoryPort } from "./simulationPorts";
import { stateCalendar } from "./scenarioState";
import { STUCK_STOCK_CHECK_TICKS, stuckStock } from "./stuckStock";
import { townCentre } from "./townAgency";
import type { ChainState, TradeCause, TradeHousehold, TradeReason, TradeState } from "./trades.types";
import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASONS_PER_YEAR, SEASON_TICKS, YEAR_TICKS } from "../content/packSettings";

const SEASON = SEASON_TICKS;
const MAX_QUITS = 40;
/** TR-7: the food the carters may carry out only above the reserve days (wheat and bread). */
const FOOD_RESOURCES: ReadonlySet<string> = new Set(["wheat", "bread"]);

export function initialTrades(): TradeState {
  return { households: [], stock: {}, chains: {}, streets: [], haulage: { season: 0, last: 0 }, quits: [] };
}

export function tradesOf(state: Pick<GameState, "trades">): TradeState {
  return state.trades ?? initialTrades();
}

export function tradeCounts(state: Pick<GameState, "trades">): Readonly<Partial<Record<TradeId, number>>> {
  const counts: Partial<Record<TradeId, number>> = {};
  for (const household of tradesOf(state).households) counts[household.tradeId] = (counts[household.tradeId] ?? 0) + 1;
  return counts;
}

// ---------------------------------------------------------------------------------------------------------------
// TR-3: the facts of a house's plot, gathered once a season and shared by every trade's score.

interface PlotFacts {
  readonly houseId: string;
  readonly tx: number;
  readonly ty: number;
  readonly pasture: number;
  readonly woodland: number;
  readonly waterDistance: number | null;
  readonly flowingWater: boolean;
  readonly road: boolean;
  readonly freeCells: number;
  readonly centreDistance: number;
  readonly crowd: number;
  readonly customers: number;
  readonly marketDistance: number | null;
  readonly churchDistance: number | null;
  /** Buildings within the raw radius holding each resource (count). */
  readonly resourceHolders: Readonly<Record<string, number>>;
  readonly surname: string | null;
}

interface TownFacts {
  readonly plots: ReadonlyMap<string, PlotFacts>;
  readonly pastureCells: number;
  readonly woodlandCells: number;
  readonly water: boolean;
  readonly flowingWater: boolean;
  readonly kinds: ReadonlySet<string>;
}

const chebyshev = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

function zoneCells(state: GameState, kind: string): ReadonlySet<number> {
  const cells = new Set<number>();
  for (const zone of state.zones ?? []) if (zone.kind === kind) for (const cell of zone.membership) cells.add(cell);
  return cells;
}

function townFacts(state: GameState): TownFacts {
  const { width, height, tiles } = state;
  const pasture = zoneCells(state, "pasture");
  const woodlandZone = zoneCells(state, "woodland_common");
  const centre = townCentre(state) ?? { tx: Math.floor(width / 2), ty: Math.floor(height / 2) };
  const isWoodland = (index: number) => woodlandZone.has(index) || tiles[index]?.terrain === "forest";
  let woodlandCells = 0;
  const r = TRADE_BALANCE.woodlandRadius;
  for (let ty = Math.max(0, centre.ty - r); ty <= Math.min(height - 1, centre.ty + r); ty += 1) {
    for (let tx = Math.max(0, centre.tx - r); tx <= Math.min(width - 1, centre.tx + r); tx += 1) if (isWoodland(ty * width + tx)) woodlandCells += 1;
  }
  const lived = state.houses.filter(house => house.residents > 0 && house.abandonedTick === undefined);
  const buildingById = new Map(state.buildings.map(building => [building.id, building]));
  const houseSpots = lived.map(house => buildingById.get(house.buildingId)).filter((building): building is Building => building !== undefined);
  const markets = state.buildings.filter(building => building.kind === "market");
  const churches = state.buildings.filter(building => building.kind === "church" || building.kind === "chapel");
  const heads = new Map<string, string>();
  for (const person of state.persons?.people ?? []) if (person.role === "head" && person.surname !== undefined) heads.set(person.householdId, person.surname);
  const plots = new Map<string, PlotFacts>();
  const raw = TRADE_BALANCE.rawRadius;
  for (const building of houseSpots) {
    const { tx, ty } = building;
    let pastureNear = 0, woodlandNear = 0, freeCells = 0;
    let waterDistance: number | null = null, flowingWater = false, road = false;
    for (let y = Math.max(0, ty - raw); y <= Math.min(height - 1, ty + raw); y += 1) {
      for (let x = Math.max(0, tx - raw); x <= Math.min(width - 1, tx + raw); x += 1) {
        const index = y * width + x;
        const tile = tiles[index];
        if (tile === undefined) continue;
        const distance = chebyshev(tx, ty, x, y);
        if (pasture.has(index)) pastureNear += 1;
        if (isWoodland(index)) woodlandNear += 1;
        if (tile.terrain === "water" && distance <= 3) {
          waterDistance = waterDistance === null ? distance : Math.min(waterDistance, distance);
          if (isFlowingWater(state, index)) flowingWater = true;
        }
        if (distance === 1 && tile.hasRoad) road = true;
        if (distance <= 2 && tile.terrain === "grass" && tile.buildingId === null && !tile.hasRoad) freeCells += 1;
      }
    }
    const resourceHolders: Record<string, number> = {};
    for (const other of state.buildings) {
      if (chebyshev(tx, ty, other.tx, other.ty) > raw) continue;
      for (const [resource, amount] of Object.entries(other.inventory)) if ((amount ?? 0) > 0) resourceHolders[resource] = (resourceHolders[resource] ?? 0) + 1;
    }
    const nearest = (list: readonly Building[]) => list.length === 0 ? null : Math.min(...list.map(other => chebyshev(tx, ty, other.tx, other.ty)));
    plots.set(building.id, {
      houseId: building.id, tx, ty, pasture: pastureNear, woodland: woodlandNear, waterDistance, flowingWater, road, freeCells,
      centreDistance: chebyshev(tx, ty, centre.tx, centre.ty),
      crowd: houseSpots.filter(other => other.id !== building.id && chebyshev(tx, ty, other.tx, other.ty) <= TRADE_BALANCE.crowdRadius).length,
      customers: houseSpots.filter(other => other.id !== building.id && chebyshev(tx, ty, other.tx, other.ty) <= TRADE_BALANCE.customerRadius).length,
      marketDistance: nearest(markets), churchDistance: nearest(churches), resourceHolders, surname: heads.get(building.id) ?? null,
    });
  }
  let water = false, flowing = false;
  for (const plot of plots.values()) { if (plot.waterDistance !== null) water = true; if (plot.flowingWater) flowing = true; }
  return { plots, pastureCells: pasture.size, woodlandCells, water, flowingWater: flowing, kinds: new Set(state.buildings.map(building => building.kind)) };
}

/** TR-2: the plot can hold the trade's workshop. */
export function plotFits(trade: TradeDefinition, plot: PlotFacts): boolean {
  const need = WORKSHOP_PLOT[trade.workshop];
  if (need.road === true && !plot.road) return false;
  if (need.freeCells !== undefined && plot.freeCells < need.freeCells) return false;
  if (need.water === true && plot.waterDistance === null) return false;
  if (need.flowingWater === true && !plot.flowingWater) return false;
  if (need.edge !== undefined && plot.centreDistance < need.edge) return false;
  if (need.market === true && (plot.marketDistance === null || plot.marketDistance > 8)) return false;
  if (need.church === true && (plot.churchDistance === null || plot.churchDistance > 6)) return false;
  return true;
}

/** TR-3: the raw item — the trade's first input's sources near the house, and the input it names. */
function rawValue(trade: TradeDefinition, plot: PlotFacts, households: readonly TradeHousehold[], plots: ReadonlyMap<string, PlotFacts>): { value: number; subject: string } {
  const input = trade.inputs[0];
  if (trade.id === "carter") {
    const stores = (plot.resourceHolders.wheat ?? 0) + (plot.resourceHolders.timber ?? 0);
    return { value: Math.min(30, stores * 4), subject: "stores" };
  }
  if (input === undefined) return { value: 0, subject: "none" };
  if (input.kind === "land") {
    const cells = input.land === "pasture" ? plot.pasture : plot.woodland;
    return { value: Math.min(30, Math.round(cells / 2)), subject: input.land === "pasture" ? "livestock" : "bark" };
  }
  if (input.kind === "resource") return { value: Math.min(30, (plot.resourceHolders[input.resource] ?? 0) * 8), subject: input.resource };
  // A good: the trades near the house that make it (each worth 10), else what merchants bring (a little).
  const makers = households.filter(household => TRADE_BY_ID.get(household.tradeId)?.outputs?.[input.good] !== undefined)
    .filter(household => { const other = plots.get(household.houseId); return other !== undefined && chebyshev(plot.tx, plot.ty, other.tx, other.ty) <= TRADE_BALANCE.rawRadius; });
  return { value: Math.min(30, makers.length * 10 + (IMPORTS[input.good] !== undefined ? 4 : 0)), subject: input.good };
}

/** TR-3: the location score's items for one trade on one plot (only the items the trade counts, weighted). */
export function locationReasons(trade: TradeDefinition, plot: PlotFacts, households: readonly TradeHousehold[], plots: ReadonlyMap<string, PlotFacts>): readonly TradeReason[] {
  const reasons: TradeReason[] = [];
  const add = (factor: LocationFactor, value: number, subject?: string) => {
    const weight = trade.factors[factor];
    if (weight === undefined) return;
    const weighted = Math.round(value * weight / 1000);
    if (weighted !== 0) reasons.push({ factor, value: weighted, ...(subject === undefined ? {} : { subject }) });
  };
  const raw = rawValue(trade, plot, households, plots);
  add("raw", raw.value, raw.subject);
  add("customers", Math.min(30, plot.customers + (plot.marketDistance !== null && plot.marketDistance <= 10 ? 5 : 0)));
  // Kin: a household whose head shares this head's surname already follows the trade.
  if (plot.surname !== null) {
    const kin = households.filter(household => household.tradeId === trade.id && household.houseId !== plot.houseId && plots.get(household.houseId)?.surname === plot.surname);
    if (kin.length > 0) {
      const near = kin.some(household => { const other = plots.get(household.houseId)!; return chebyshev(plot.tx, plot.ty, other.tx, other.ty) <= 4; });
      add("kin", near ? 20 : 15);
    }
  }
  if (plot.waterDistance !== null) add("water", 30 - plot.waterDistance * 7);
  if (plot.road) add("road", 10);
  add("plot", plotFits(trade, plot) ? 17 : -10);
  add("rent", -Math.max(0, 12 - plot.centreDistance));
  if (trade.nuisance !== undefined) add("nuisance", -Math.min(20, plot.crowd * (trade.nuisance === "stink" ? 3 : 2)));
  const rivals = households.filter(household => household.tradeId === trade.id && household.houseId !== plot.houseId)
    .filter(household => { const other = plots.get(household.houseId); return other !== undefined && chebyshev(plot.tx, plot.ty, other.tx, other.ty) <= TRADE_BALANCE.competitionRadius; });
  add("competition", -6 * rivals.length);
  return reasons;
}

const scoreOf = (reasons: readonly TradeReason[]) => reasons.reduce((sum, reason) => sum + reason.value, 0);

// ---------------------------------------------------------------------------------------------------------------
// TR-1/TR-4: which trades may open, and how many households each wants.

function conditionMet(trade: TradeDefinition, facts: TownFacts, counts: Readonly<Partial<Record<TradeId, number>>>, population: number, year: number): boolean {
  const condition = trade.condition;
  if (condition.building !== undefined && !condition.building.some(kind => facts.kinds.has(kind))) return false;
  if (condition.pastureCells !== undefined && facts.pastureCells < condition.pastureCells) return false;
  if (condition.water === true && !facts.water) return false;
  if (condition.flowingWater === true && !facts.flowingWater) return false;
  if (condition.population !== undefined && population < condition.population) return false;
  if (condition.year !== undefined && year < condition.year) return false;
  for (const [id, needed] of Object.entries(condition.trades ?? {})) if ((counts[id as TradeId] ?? 0) < (needed ?? 0)) return false;
  return true;
}

/** TR-4: households the trade wants in a town of this size (the research's range). */
export function tradeTarget(trade: TradeDefinition, population: number): number {
  return Math.max(trade.min, Math.min(trade.max, Math.round(population * trade.perThousand / 1000)));
}

function chooseTrades(state: GameState, trades: TradeState, facts: TownFacts, year: number): TradeState {
  const counts = { ...tradeCounts({ trades }) };
  const taken = new Set(trades.households.map(household => household.houseId));
  // Free households: lived, not leaving, with an adult head, without a trade.
  const adultHead = new Set((state.persons?.people ?? []).filter(person => person.role === "head" && year - person.birthYear >= 16).map(person => person.householdId));
  const free = [...facts.plots.values()].filter(plot => !taken.has(plot.houseId) && adultHead.has(plot.houseId)
    && state.houses.some(house => house.buildingId === plot.houseId && house.leavingSinceTick === undefined));
  let households = trades.households;
  for (let pick = 0; pick < TRADE_BALANCE.choicesPerSeason; pick += 1) {
    // A trade a household gave up within the last four seasons stays shut (it had no input; TR-4).
    const shut = new Set(trades.quits.filter(quit => state.tick - quit.tick < TRADE_BALANCE.idleSeasonsToQuit * SEASON).map(quit => quit.tradeId));
    const open = TRADES.filter(trade => !shut.has(trade.id) && conditionMet(trade, facts, counts, state.population, year) && (counts[trade.id] ?? 0) < tradeTarget(trade, state.population));
    const pairs: { trade: TradeDefinition; plot: PlotFacts; reasons: readonly TradeReason[]; score: number }[] = [];
    for (const trade of open) {
      for (const plot of free) {
        if (taken.has(plot.houseId)) continue;
        const reasons = locationReasons(trade, plot, households, facts.plots);
        pairs.push({ trade, plot, reasons, score: scoreOf(reasons) });
      }
    }
    if (pairs.length === 0) break;
    // Best first; ties by house then trade so the order is the state's.
    pairs.sort((left, right) => right.score - left.score || left.plot.houseId.localeCompare(right.plot.houseId) || left.trade.id.localeCompare(right.trade.id));
    // LM-E5's draw: each pair weighted exp((score − best) / 6) among those within 20 of the best.
    const best = pairs[0]!.score;
    const near = pairs.filter(pair => best - pair.score <= 20).slice(0, 12);
    const weights = near.map(pair => Math.exp((pair.score - best) / 6));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let draw = (hashSeed(state.seed, "trade-choice", state.tick, pick) % 1_000_000) / 1_000_000 * total;
    let index = 0;
    while (index < near.length - 1 && draw >= weights[index]!) { draw -= weights[index]!; index += 1; }
    const chosen = near[index]!;
    taken.add(chosen.plot.houseId);
    counts[chosen.trade.id] = (counts[chosen.trade.id] ?? 0) + 1;
    households = [...households, {
      houseId: chosen.plot.houseId, tradeId: chosen.trade.id, sinceTick: state.tick, workshop: chosen.trade.workshop,
      receipt: { tick: state.tick, reasons: chosen.reasons, score: chosen.score, chancePermille: Math.round(weights[index]! / total * 1000), of: near.length },
      productivityPermille: 0, idleSeasons: 0,
    }].sort((left, right) => left.houseId.localeCompare(right.houseId));
  }
  return households === trades.households ? trades : { ...trades, households };
}

// ---------------------------------------------------------------------------------------------------------------
// TR-5/TR-6: a season's production, along the chains (upstream trades first), and each chain's one bottleneck.

/** Trades in chain order: every trade after the trades whose goods it takes. */
const PRODUCTION_ORDER: readonly TradeId[] = (() => {
  const order: TradeId[] = [];
  const visit = (id: TradeId, stack: Set<TradeId>) => {
    if (order.includes(id) || stack.has(id)) return;
    stack.add(id);
    const trade = TRADE_BY_ID.get(id)!;
    for (const input of trade.inputs) if (input.kind === "good") for (const maker of TRADES) if (maker.outputs?.[input.good] !== undefined) visit(maker.id, stack);
    order.push(id);
  };
  for (const id of TRADE_IDS) visit(id, new Set());
  return order;
})();

function townResource(state: GameState, resource: string): number {
  return state.buildings.reduce((sum, building) => sum + Math.max(0, building.inventory[resource as keyof Building["inventory"]] ?? 0), 0);
}

function produceSeason(state: GameState, trades: TradeState, facts: TownFacts, seasonIndex: number): TradeState {
  const counts = tradeCounts({ trades });
  const merchants = counts.merchant ?? 0;
  const stock: Partial<Record<TradeGood, number>> = { ...trades.stock };
  // Imports arrive first (TR-5).
  for (const [good, rate] of Object.entries(IMPORTS)) stock[good as TradeGood] = (stock[good as TradeGood] ?? 0) + rate!.base + rate!.perMerchant * merchants;
  // Land supply, shared by the households that use it.
  const farmsteads = state.buildings.filter(building => building.kind === "farmstead").length;
  const livestock = facts.pastureCells * TRADE_BALANCE.pastureLivestockPerCell + farmsteads * TRADE_BALANCE.farmsteadLivestock
    + (facts.kinds.has("market") ? TRADE_BALANCE.marketLivestock : 0);
  const landSupply = { pasture: livestock, woodland: facts.woodlandCells * TRADE_BALANCE.woodlandBarkPerCell };
  const landUsers = { pasture: 0, woodland: 0 };
  for (const household of trades.households) for (const input of TRADE_BY_ID.get(household.tradeId)!.inputs) if (input.kind === "land") landUsers[input.land] += 1;
  const people = state.population;
  const results = new Map<string, { produced: number; capacity: number; cause: TradeCause }>();
  for (const tradeId of PRODUCTION_ORDER) {
    const trade = TRADE_BY_ID.get(tradeId)!;
    const members = trades.households.filter(household => household.tradeId === tradeId);
    if (members.length === 0) continue;
    const capacity = members.length * trade.capacity * trade.seasons[seasonIndex]! / 1000;
    // Each input's share of the need it can meet; the smallest limits the trade.
    let ratio = 1;
    let cause: TradeCause = { kind: "none" };
    for (const input of trade.inputs) {
      let supply: number, need: number, subject: string;
      if (input.kind === "land") {
        supply = landSupply[input.land] * members.length / Math.max(1, landUsers[input.land]);
        need = capacity * input.per;
        subject = input.land === "pasture" ? "livestock" : "bark";
      } else if (input.kind === "good") {
        supply = stock[input.good] ?? 0;
        need = capacity * input.per;
        subject = input.good;
      } else {
        supply = townResource(state, input.resource);
        need = input.threshold;
        subject = input.resource;
      }
      const share = need <= 0 ? 1 : Math.min(1, supply / need);
      if (share < ratio) {
        ratio = share;
        cause = { kind: "input", subject, days: need <= 0 ? 0 : Math.floor(supply / (need / DAYS_PER_SEASON)) };
      }
    }
    // Demand: a service sells what the town buys; a final good stops when its stock holds enough seasons.
    const outputs = trade.outputs;
    if (outputs === undefined) {
      const demand = (TOWN_DEMAND_PER_HUNDRED[tradeId] ?? 0) * people / 100;
      if (demand < capacity * ratio) { ratio = capacity <= 0 ? 0 : demand / capacity; cause = { kind: "demand" }; }
    } else {
      for (const [good, per] of Object.entries(outputs)) {
        const seasonDemand = (TOWN_DEMAND_PER_HUNDRED[good as TradeGood] ?? 0) * people / 100 + (EXPORT_PER_MERCHANT[good as TradeGood] ?? 0) * merchants;
        const consumers = TRADES.some(other => other.inputs.some(input => input.kind === "good" && input.good === good));
        if (seasonDemand <= 0 && consumers) continue;
        const room = Math.max(0, seasonDemand * (TRADE_BALANCE.demandStockSeasons + 1) - (stock[good as TradeGood] ?? 0));
        const allowed = per! <= 0 ? capacity : room / per!;
        if (!consumers && allowed < capacity * ratio) { ratio = capacity <= 0 ? 0 : allowed / capacity; cause = { kind: "demand" }; }
      }
    }
    const produced = capacity * Math.max(0, ratio);
    for (const input of trade.inputs) if (input.kind === "good") stock[input.good] = Math.max(0, (stock[input.good] ?? 0) - produced * input.per);
    for (const [good, per] of Object.entries(outputs ?? {})) stock[good as TradeGood] = (stock[good as TradeGood] ?? 0) + produced * per!;
    results.set(tradeId, { produced, capacity, cause });
  }
  // The town buys its season's final goods; the merchants carry out the cloth and leather they sell. A good no
  // household takes and no one buys (hides without a tanner) is sold off cheap: half of it goes each season.
  for (const good of Object.keys(stock) as TradeGood[]) {
    const bought = (TOWN_DEMAND_PER_HUNDRED[good] ?? 0) * people / 100 + (EXPORT_PER_MERCHANT[good] ?? 0) * merchants;
    const taken = TRADES.some(trade => (counts[trade.id] ?? 0) > 0 && trade.inputs.some(input => input.kind === "good" && input.good === good));
    const left = Math.max(0, (stock[good] ?? 0) - bought);
    // A good the trades take is kept to four seasons of what they take; the rest is sold off cheap.
    const use = TRADES.reduce((sum, trade) => sum + trade.inputs.reduce((need, input) => need
      + (input.kind === "good" && input.good === good ? (counts[trade.id] ?? 0) * trade.capacity * input.per : 0), 0), 0);
    stock[good] = bought <= 0 && !taken ? left / 2 : taken ? Math.min(left, use * TRADE_BALANCE.inputStockSeasons) : left;
  }
  // Households: productivity and idle seasons (TR-4: four idle seasons and the trade is given up).
  const quits = [...trades.quits];
  const households: TradeHousehold[] = [];
  for (const household of trades.households) {
    const result = results.get(household.tradeId);
    const permille = result === undefined || result.capacity <= 0 ? 0 : Math.round(result.produced / result.capacity * 1000);
    const idleSeasons = permille === 0 ? household.idleSeasons + 1 : 0;
    if (idleSeasons >= TRADE_BALANCE.idleSeasonsToQuit) { quits.push({ houseId: household.houseId, tradeId: household.tradeId, tick: state.tick }); continue; }
    households.push({ ...household, productivityPermille: permille, idleSeasons });
  }
  // TR-6: each chain's productivity (output over capacity) and its weakest trade's cause.
  const chains: Partial<Record<TradeChain, ChainState>> = {};
  for (const chain of TRADE_CHAINS) {
    const members = [...results.entries()].filter(([id]) => TRADE_BY_ID.get(id as TradeId)!.chain === chain);
    if (members.length === 0) continue;
    const produced = members.reduce((sum, [, result]) => sum + result.produced, 0);
    const capacity = members.reduce((sum, [, result]) => sum + result.capacity, 0);
    const weakest = [...members].sort((left, right) => left[1].produced / Math.max(1, left[1].capacity) - right[1].produced / Math.max(1, right[1].capacity) || left[0].localeCompare(right[0]))[0]!;
    chains[chain] = { productivityPermille: capacity <= 0 ? 0 : Math.round(produced / capacity * 1000), tradeId: weakest[0] as TradeId, cause: weakest[1].cause };
  }
  for (const good of Object.keys(stock) as TradeGood[]) stock[good] = Math.round((stock[good] ?? 0) * 10) / 10;
  return { ...trades, households, stock, chains, quits: quits.slice(-MAX_QUITS), haulage: { season: 0, last: trades.haulage.season } };
}

// ---------------------------------------------------------------------------------------------------------------
// TR-8: streets — households of one trade, each within a few cells of another, three or more.

function nameStreets(trades: TradeState, facts: TownFacts, tick: number): TradeState {
  const streets: { tradeId: TradeId; houseIds: string[]; namedTick: number }[] = [];
  for (const tradeId of TRADE_IDS) {
    const members = trades.households.filter(household => household.tradeId === tradeId && facts.plots.has(household.houseId)).map(household => facts.plots.get(household.houseId)!);
    const seen = new Set<string>();
    for (const start of members) {
      if (seen.has(start.houseId)) continue;
      const group: PlotFacts[] = [start];
      seen.add(start.houseId);
      for (let at = 0; at < group.length; at += 1) {
        for (const other of members) {
          if (seen.has(other.houseId) || chebyshev(group[at]!.tx, group[at]!.ty, other.tx, other.ty) > TRADE_BALANCE.streetLink) continue;
          seen.add(other.houseId);
          group.push(other);
        }
      }
      if (group.length < TRADE_BALANCE.streetHouseholds) continue;
      const houseIds = group.map(plot => plot.houseId).sort();
      // A street keeps the tick it was first named while it shares a house with its earlier self.
      const earlier = trades.streets.find(street => street.tradeId === tradeId && street.houseIds.some(id => houseIds.includes(id)));
      streets.push({ tradeId, houseIds, namedTick: earlier?.namedTick ?? tick });
    }
  }
  return { ...trades, streets };
}

// ---------------------------------------------------------------------------------------------------------------
// TR-7: the carters move stuck stock — a load each per stuck-stock check, to the nearest building with room.

export function haulStuckStock(state: GameState, trades: TradeState): { readonly state: GameState; readonly moved: number; readonly carriedOut: number } {
  const carters = trades.households.filter(household => household.tradeId === "carter").length;
  if (carters === 0) return { state, moved: 0, carriedOut: 0 };
  let capacity = carters * TRADE_BALANCE.carterLoadsPerCheck * TRADE_BALANCE.carterLoad;
  const stuck = stuckStock(state).filter(entry => entry.source === "stock" && isStorableResource(entry.resource));
  const entries = stuck.filter(entry => entry.reason === "no_carrier")
    .sort((left, right) => right.amount - left.amount || left.buildingId.localeCompare(right.buildingId));
  const inventory = createDeliveryInventoryPort(LORD_INTAKE_RULES);
  let buildings = state.buildings;
  let moved = 0;
  for (const entry of entries) {
    while (capacity > 0) {
      const source = buildings.find(building => building.id === entry.buildingId)!;
      const resource = entry.resource as StorableResourceType;
      const available = Math.min(TRADE_BALANCE.carterLoad, capacity, inventory.availableStock(source, resource));
      if (available <= 0) break;
      const receivers = buildings.filter(building => building.id !== source.id && acceptsResource(building.kind, resource))
        .map(building => ({ building, room: storageIntakeSpace(building, resource, availableSpace(building, BUILDING_CONFIG_BY_KIND[building.kind]), LORD_INTAKE_RULES) }))
        .filter(candidate => candidate.room > 0)
        .sort((left, right) => chebyshev(source.tx, source.ty, left.building.tx, left.building.ty) - chebyshev(source.tx, source.ty, right.building.tx, right.building.ty)
          || left.building.id.localeCompare(right.building.id));
      const target = receivers[0];
      if (target === undefined) break;
      const amount = Math.min(available, target.room);
      buildings = buildings.map(building => building.id === source.id ? { ...building, inventory: { ...building.inventory, [resource]: (building.inventory[resource] ?? 0) - amount } }
        : building.id === target.building.id ? { ...building, inventory: { ...building.inventory, [resource]: (building.inventory[resource] ?? 0) + amount } } : building);
      capacity -= amount;
      moved += amount;
    }
    if (capacity <= 0) break;
  }
  // RECOVER-1 (RC-5): the short side pulls — for each `INPUT_PULL` chain, what the loads have left brings the input from
  // the nearest source to the converters under their reorder point (by the distance to the nearest source holding it)
  // and the stores under their target, the largest shortfall first.
  for (const chain of INPUT_PULL.chains) {
    if (capacity <= 0) break;
    const sources = () => buildings.filter(building => chain.sources.includes(building.kind) && inventory.availableStock(building, chain.input) > 0);
    const nearestSource = (target: Building) => sources().sort((left, right) =>
      chebyshev(target.tx, target.ty, left.tx, left.ty) - chebyshev(target.tx, target.ty, right.tx, right.ty) || left.id.localeCompare(right.id))[0];
    const shortfall = (target: Building): number => {
      const held = (target.inventory[chain.input] ?? 0) + (target.reserved[chain.input] ?? 0);
      const store = chain.stores.find(line => line.kind === target.kind);
      if (store !== undefined) return store.target - held;
      const source = nearestSource(target);
      return source === undefined ? 0 : inputReorderPoint(chain, chebyshev(target.tx, target.ty, source.tx, source.ty)) - held;
    };
    const short = buildings.filter(building => (building.kind === chain.converter || chain.stores.some(line => line.kind === building.kind)) && !operationSuspended(building))
      .map(building => ({ id: building.id, want: shortfall(building) })).filter(entry => entry.want > 0)
      .sort((left, right) => right.want - left.want || left.id.localeCompare(right.id));
    for (const entry of short) {
      if (capacity <= 0) break;
      const target = buildings.find(building => building.id === entry.id)!;
      const source = nearestSource(target);
      if (source === undefined) break;
      const room = storageIntakeSpace(target, chain.input, availableSpace(target, BUILDING_CONFIG_BY_KIND[target.kind]), LORD_INTAKE_RULES);
      const amount = Math.min(TRADE_BALANCE.carterLoad, capacity, entry.want, inventory.availableStock(source, chain.input), room);
      if (amount <= 0) continue;
      buildings = buildings.map(building => building.id === source.id ? { ...building, inventory: { ...building.inventory, [chain.input]: (building.inventory[chain.input] ?? 0) - amount } }
        : building.id === target.id ? { ...building, inventory: { ...building.inventory, [chain.input]: (building.inventory[chain.input] ?? 0) + amount } } : building);
      capacity -= amount;
      moved += amount;
    }
  }
  // TR-7 (b): with a market, what is left of the loads carries surplus no building can take out of town to sell —
  // only what lies above the town's reserve (LM6A-3, the user's judgement 2026-10-03): food only while the town holds
  // more than `carryOutFoodDays` of it and never in a dearth or famine; other goods above `carryOutReserve`.
  let carriedOut = 0;
  if (capacity > 0 && state.buildings.some(building => building.kind === "market")) {
    const full = stuck.filter(entry => entry.reason === "receiver_full")
      .sort((left, right) => right.amount - left.amount || left.buildingId.localeCompare(right.buildingId));
    const reserveTicks = foodReserveTicks(state);
    const foodDays = reserveTicks === null ? Infinity : reserveTicks * DAYS_PER_YEAR / BALANCE.TICKS_PER_YEAR;
    const foodMayLeave = foodDays > TRADE_BALANCE.carryOutFoodDays && foodPricePermille(state, state.tick) < TRADE_BALANCE.carryOutDearthPricePermille;
    const above = new Map<string, number>();
    for (const entry of full) {
      if (above.has(entry.resource)) continue;
      const total = state.buildings.reduce((sum, building) => sum + Math.max(0, building.inventory[entry.resource as StorableResourceType] ?? 0), 0);
      above.set(entry.resource, Math.max(0, total - (TRADE_BALANCE.carryOutReserve[entry.resource as keyof typeof TRADE_BALANCE.carryOutReserve] ?? TRADE_BALANCE.carryOutReserveOther)));
    }
    for (const entry of full) {
      if (capacity <= 0) break;
      if (FOOD_RESOURCES.has(entry.resource) && !foodMayLeave) continue;
      const source = buildings.find(building => building.id === entry.buildingId)!;
      const resource = entry.resource as StorableResourceType;
      const amount = Math.min(capacity, above.get(resource) ?? 0, inventory.availableStock(source, resource));
      if (amount <= 0) continue;
      above.set(resource, (above.get(resource) ?? 0) - amount);
      buildings = buildings.map(building => building.id === source.id ? { ...building, inventory: { ...building.inventory, [resource]: (building.inventory[resource] ?? 0) - amount } } : building);
      capacity -= amount;
      carriedOut += amount;
    }
  }
  return moved + carriedOut === 0 ? { state, moved: 0, carriedOut: 0 } : { state: { ...state, buildings }, moved, carriedOut };
}

// ---------------------------------------------------------------------------------------------------------------

/** LM-E6a: the trades' step, after the town agency (lord mode only). */
export function advanceTrades(state: GameState): GameState {
  if (state.agency === undefined) return state;
  const seasonStart = state.tick > 0 && state.tick % SEASON === 0;
  const haulDay = state.tick > 0 && state.tick % STUCK_STOCK_CHECK_TICKS === 0;
  if (!seasonStart && !haulDay) return state;
  let trades = tradesOf(state);
  let next = state;
  if (haulDay) {
    const hauled = haulStuckStock(next, trades);
    next = hauled.state;
    if (hauled.moved + hauled.carriedOut > 0) trades = { ...trades, haulage: { ...trades.haulage, season: trades.haulage.season + hauled.moved + hauled.carriedOut } };
  }
  if (seasonStart) {
    const facts = townFacts(next);
    const year = stateCalendar(state).year;
    const seasonIndex = Math.floor((state.tick % YEAR_TICKS) / SEASON);
    // The season just ended is the one produced (seasonIndex − 1); a household lost with its house leaves the trades.
    const lived = new Set(facts.plots.keys());
    if (trades.households.some(household => !lived.has(household.houseId))) trades = { ...trades, households: trades.households.filter(household => lived.has(household.houseId)) };
    trades = produceSeason(next, trades, facts, (seasonIndex + SEASONS_PER_YEAR - 1) % SEASONS_PER_YEAR);
    trades = chooseTrades(next, trades, facts, year);
    trades = nameStreets(trades, facts, state.tick);
  }
  return trades === state.trades && next === state ? state : { ...next, trades };
}
