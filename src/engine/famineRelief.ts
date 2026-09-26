/**
 * F0-C1 FC-2 relief and what it costs (spec docs/design/flow-chapter-one.md FC-2, FC-2a). At each season's start while
 * the famine arrives, relief hands the poor households (the poorest quarter, FC-2) their season's bread: bought with
 * cash first — at the market price, at most the last season's cash income and half the treasury (FC3), into the first
 * granary's room — and the rest released from the granaries' bread. Its cost is the bread handed out at the market
 * price: the purchase in cash (`famine_relief`, cash) and the release at what that bread would fetch at market, its
 * release value (`famine_relief`, in kind: no money moves). The history ledger's prediction and actual of the famine
 * answer (HL-3) read the same split, so a town with no income still sees what its granaries give.
 */
import { BUILDING_CONFIG_BY_KIND, operationSuspended } from "../content/buildingConfig";
import { FAMINE_RESPONSE_CONFIG } from "../content/chapterConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import type { Ledger } from "../ledger/ledger.types";
import type { GameState } from "./engine.types";
import { SEASON_TICKS, dearthEndTick, famineShortHouses } from "./eventSchedule";
import type { EventRecord } from "./events.types";
import { marketSalePrice } from "./marketSettlement";

/** The town's working granaries, by id (relief buys into the first; speculation sells from each). */
export function famineGranaries(state: GameState) {
  return state.buildings.filter(building => building.kind === "granary" && !operationSuspended(building)).sort((a, b) => a.id.localeCompare(b.id));
}

/** Bread the town eats in a season at the ration (every lived-in house). */
function seasonBread(state: GameState): number {
  const ration = state.houses.reduce((sum, house) => sum + (house.residents > 0 ? houseFoodRation(house) : 0), 0);
  return Math.ceil(ration * SEASON_TICKS / HOUSE_FOOD_INTERVAL);
}

/** One relief season: the bread's market price, the poor's season of bread, and how it is found. */
export interface ReliefSeason {
  readonly price: number;
  readonly need: number;
  /** Bought with cash into the first granary. */
  readonly bought: number;
  /** Released from the granaries' bread (what purchase could not cover). */
  readonly released: number;
}

/** The numbers a relief season is split on. */
interface ReliefNumbers {
  readonly price: number;
  readonly need: number;
  readonly income: number;
  readonly treasury: number;
  /** Free room in the first granary. */
  readonly room: number;
  /** Bread in the granaries. */
  readonly stock: number;
}

function reliefNumbers(state: GameState): ReliefNumbers {
  const stores = famineGranaries(state);
  const first = stores[0];
  const poor = new Set(famineShortHouses(state, true));
  return {
    price: marketSalePrice(state, "bread"),
    need: seasonBread({ ...state, houses: state.houses.filter(house => poor.has(house.buildingId)) }),
    income: state.seasons?.history.at(-1)?.income ?? 0,
    treasury: state.treasuryCoin,
    room: first === undefined ? 0 : Math.max(0, BUILDING_CONFIG_BY_KIND.granary.storageCapacity
      - Object.values(first.inventory).reduce((sum, amount) => sum + (amount ?? 0), 0)),
    stock: stores.reduce((sum, store) => sum + Math.max(0, store.inventory.bread ?? 0), 0),
  };
}

/** FC-2a: cash first (FC3: the famine eats the earnings, not the savings), then the granaries' bread. */
function split(numbers: ReliefNumbers): ReliefSeason {
  const { price, need } = numbers;
  if (price <= 0 || need <= 0) return { price, need, bought: 0, released: 0 };
  const budget = Math.min(numbers.income, Math.floor(Math.max(0, numbers.treasury) * FAMINE_RESPONSE_CONFIG.reliefTreasuryPermille / 1000));
  const bought = Math.max(0, Math.min(need, Math.floor(budget / price), numbers.room));
  return { price, need, bought, released: Math.min(need - bought, numbers.stock) };
}

/** FC-2a: this season's relief on the town now. */
export function reliefSeason(state: GameState): ReliefSeason {
  return split(reliefNumbers(state));
}

/**
 * FC-2a, HL-3: the relief's cost predicted when it is chosen, over its seasons in (now, until] while the famine arrives:
 * each season split as `reliefSeason` splits on today's numbers, the treasury less the bread bought before it and the
 * granaries' bread less the bread released before it.
 */
export function reliefCostForecast(state: GameState, famine: EventRecord, until: number): number {
  const end = famine.endTick ?? dearthEndTick(famine);
  let numbers = reliefNumbers(state);
  let cost = 0;
  for (let tick = (Math.floor(state.tick / SEASON_TICKS) + 1) * SEASON_TICKS; tick <= until && tick < end; tick += SEASON_TICKS) {
    const season = split(numbers);
    cost += (season.bought + season.released) * season.price;
    numbers = { ...numbers, treasury: numbers.treasury - season.bought * season.price, stock: numbers.stock - season.released };
  }
  return cost;
}

/** FC-2a, HL-3: the relief's cost as posted in (from, until] — its cash purchases and in-kind releases. */
export function reliefCostPosted(ledger: Ledger | undefined, eventId: string, from: number, until: number): number {
  let cost = 0;
  for (const entry of ledger?.entries ?? []) {
    if (entry.category !== "famine_relief" || entry.tick <= from || entry.tick > until) continue;
    if (entry.sourceRefs[0].type === "event" && entry.sourceRefs[0].id === eventId) cost -= entry.amount;
  }
  return cost;
}
