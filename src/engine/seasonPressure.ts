/**
 * F0-A pressure (spec docs/design/flow-pressure.md): the season ledger (FP-1), the failure ladder's stages 1–2 (FP-3),
 * the first-winter warning (FP-4) and the historical eras' readiness (FP-5). Runs once per tick after the money
 * period close, so a season that ends on a period close counts that close's postings.
 *
 * - Every `sampleTicks` ticks a household that is short of food (empty larder, or the town's stored food will not last
 *   a season at this season's consumption) keeps its `foodShortSinceTick`; one without a shortage loses it and any
 *   stage 1.
 * - Stage 1 (`leavingSinceTick`, 떠날 준비): the shortage lasted a season.
 * - Stage 2 (`abandonedTick`, 이탈·황폐): stage 1 lasted another season. The household leaves; the house stays standing,
 *   empty and rent-free. At most `maxDeparturesPerSeason` households leave per calendar season, the worst fed first, and
 *   never so many that fewer than `minOccupiedHouses` homes stay lived in. A house that starves empty (the old rule)
 *   is an ordinary empty house, not an abandoned one.
 * - Recovery: stage 1 clears when the shortage ends. An abandoned house takes a new household (one lot's worth of
 *   residents) once it has stood empty a season, has water and the town's stored food lasts a season; one per sample.
 */
import { ARABLE_CONFIG } from "../content/arableConfig";
import { BALANCE, PRESSURE_BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import { arableLayouts, stripTending, stripYield } from "../zones/arableFields";
import { EMPTY_LEDGER } from "../ledger/ledger";
import { houseLotArea } from "../geometry/buildingFootprint";
import { foodReserveTicks, seasonalFoodReserveShort } from "../population/foodReserve";
import { householdShortOfFood } from "../population/housePressure";
import { withHouseholdMembers } from "../population/householdMembers";
import type { House } from "../population/population.types";
import type { GameState } from "./engine.types";
import { advanceHistoricalEras, calendar, scenarioOf } from "./scenarioState";
import { departureCapPerSeason, eventForecast, famineShortHouses } from "./eventSchedule";
import {
  SEASON_STOCK_KEYS,
  type NextObjectiveHint,
  type SeasonEvent,
  type SeasonLedger,
  type SeasonState,
  type SeasonStock,
  type SeasonTally,
} from "./season.types";

const SEASON = PRESSURE_BALANCE.seasonTicks;
/** FP-4: a winter's consumption, in ticks of stored food at the normal ration (the bot's autumn check, FP-6). */
export const WINTER_NEED_TICKS = SEASON * PRESSURE_BALANCE.winterRationPermille / 1000;

const nonNegative = (amount: number | undefined): number => (Number.isFinite(amount) ? Math.max(0, amount ?? 0) : 0);

/** FP-1 stock: bread, wheat, timber and stone in buildings, on carts and (timber) in the treasury, as the resource bar counts. */
export function seasonStock(state: Pick<GameState, "buildings" | "walkers" | "treasuryTimber">): SeasonStock {
  const totals: Record<(typeof SEASON_STOCK_KEYS)[number], number> = { bread: 0, wheat: 0, timber: nonNegative(state.treasuryTimber), stone: 0 };
  for (const building of state.buildings) for (const key of SEASON_STOCK_KEYS) totals[key] += nonNegative(building.inventory[key]);
  for (const walker of state.walkers) {
    const cargo = walker.cargo;
    if (cargo !== null && (SEASON_STOCK_KEYS as readonly string[]).includes(cargo.resource)) totals[cargo.resource as keyof typeof totals] += nonNegative(cargo.amount);
  }
  return totals;
}

function seasonStart(tick: number): number {
  return Math.floor(tick / SEASON) * SEASON;
}

function openTally(state: GameState, startTick: number): SeasonTally {
  return { startTick, population: state.population, stock: seasonStock(state), leaving: 0, abandoned: 0, departures: 0, resettled: 0,
    eras: [], firstWinterWarning: false };
}

/** FP-1: the season state of a town that has none yet (new game, a v11 save): the current season opens now. */
export function initialSeasonState(state: GameState): SeasonState {
  return { current: openTally(state, seasonStart(state.tick)), history: [] };
}

function seasonsOf(state: GameState): SeasonState {
  return state.seasons ?? initialSeasonState(state);
}

/** FP-1: cash income and expense posted in (start, end]; the opening balance is neither. */
function cashFlow(state: GameState, start: number, end: number): { readonly income: number; readonly expense: number } {
  let income = 0;
  let expense = 0;
  for (const entry of (state.ledger ?? EMPTY_LEDGER).entries) {
    if (entry.account !== "cash" || entry.category === "opening_balance" || entry.tick <= start || entry.tick > end) continue;
    if (entry.amount > 0) income += entry.amount; else expense -= entry.amount;
  }
  return { income, expense };
}

function nextObjectiveHint(state: GameState): NextObjectiveHint {
  if (state.houses.some(house => house.leavingSinceTick !== undefined) || seasonalFoodReserveShort(state, state.tick)) return "food_reserve";
  const reserve = harvestOutlookTicks(state);
  if (reserve !== null && reserve < ticksUntilNextHarvest(state.tick)) return "harvest_reserve";
  // F0-B (EV-2): a rumoured or signed event asks for its preparation; burnt houses wait for rebuilding.
  const coming = eventForecast(state).filter(entry => entry.stage === "rumour" || entry.stage === "sign");
  if (coming.some(entry => entry.kind === "dearth")) return "dearth_reserve";
  if (coming.some(entry => entry.kind === "fire")) return "fire_break";
  if (state.houses.some(house => house.burntTick !== undefined)) return "rebuild";
  return state.houses.some(house => house.abandonedTick !== undefined) ? "resettle" : null;
}

function closedEvents(tally: SeasonTally): SeasonEvent[] {
  const events: SeasonEvent[] = [];
  if (tally.firstWinterWarning) events.push({ kind: "first_winter_warning" });
  if (tally.leaving > 0) events.push({ kind: "households_leaving", count: tally.leaving });
  if (tally.abandoned > 0) events.push({ kind: "households_abandoned", count: tally.abandoned });
  if (tally.resettled > 0) events.push({ kind: "households_resettled", count: tally.resettled });
  for (const era of tally.eras) events.push({ kind: "era_entered", eraId: era.eraId, forced: era.forced });
  // F0-B (EV-9): the season's event lines — forecasts, arrivals and recoveries with their losses.
  events.push(...(tally.events ?? []));
  return events;
}

/** FP-1: closes the season that ends at `state.tick` and opens the next. */
function closeSeason(state: GameState, seasons: SeasonState): SeasonState {
  const tally = seasons.current;
  const date = calendar(tally.startTick, scenarioOf(state).startYear);
  const stock = seasonStock(state);
  const ledger: SeasonLedger = {
    season: date.season, year: date.year, startTick: tally.startTick, endTick: state.tick,
    ...cashFlow(state, tally.startTick, state.tick),
    stockDelta: { bread: stock.bread - tally.stock.bread, wheat: stock.wheat - tally.stock.wheat,
      timber: stock.timber - tally.stock.timber, stone: stock.stone - tally.stock.stone },
    popDelta: state.population - tally.population,
    notableEvents: closedEvents(tally),
    nextObjectiveHint: nextObjectiveHint(state),
  };
  const history = [...seasons.history, ledger].slice(-PRESSURE_BALANCE.seasonLedgerHistory);
  return { ...seasons, current: openTally(state, state.tick), history };
}

function withoutPressure(house: House): House {
  const { foodShortSinceTick: _short, leavingSinceTick: _leaving, ...rest } = house;
  return rest;
}

function abandon(house: House, tick: number): House {
  return { ...withoutPressure(house), residents: 0, breadStock: 0, emptyFoodTicks: 0, promotionTicks: 0, abandonedTick: tick };
}

type LadderResult = { readonly houses: House[]; readonly tally: SeasonTally; readonly changed: boolean };

/** FP-3: one sample of the ladder over every house. */
function stepLadder(state: GameState, tally: SeasonTally): LadderResult {
  const tick = state.tick;
  const reserveShort = seasonalFoodReserveShort(state, tick);
  // FC-2: in the famine the poorest households cannot buy bread at its price (relief or price control feeds them).
  const famineShort = new Set(famineShortHouses(state));
  let changed = false;
  let leaving = 0;
  let abandoned = 0;
  const houses = state.houses.map(house => {
    if (house.abandonedTick !== undefined) return house;
    // A house that starved empty is an ordinary empty house (the old rule): it has no household to be short or leave.
    if (!householdShortOfFood(house, reserveShort, tick) && !(famineShort.has(house.buildingId) && house.residents > 0)) {
      if (house.foodShortSinceTick === undefined && house.leavingSinceTick === undefined) return house;
      changed = true;
      return withoutPressure(house);
    }
    const since = house.foodShortSinceTick ?? tick;
    if (house.leavingSinceTick === undefined && tick - since >= SEASON) {
      changed = true; leaving += 1;
      return { ...house, foodShortSinceTick: since, leavingSinceTick: tick };
    }
    if (house.foodShortSinceTick === undefined) { changed = true; return { ...house, foodShortSinceTick: since }; }
    return house;
  });
  // Stage 2: households a season into stage 1 leave, the worst fed first, up to the season's cap and never leaving
  // fewer than `minOccupiedHouses` homes lived in (stage 2 is a loss, not the end of the town).
  const occupied = houses.filter(house => house.residents > 0).length;
  // FC-2: the famine answer moves the season's cap (relief 1, speculation 3).
  const cap = departureCapPerSeason(state, PRESSURE_BALANCE.maxDeparturesPerSeason);
  const room = Math.max(0, Math.min(cap - tally.departures, occupied - PRESSURE_BALANCE.minOccupiedHouses));
  const due = houses
    .map((house, index) => ({ house, index }))
    .filter(({ house }) => house.leavingSinceTick !== undefined && house.abandonedTick === undefined && tick - house.leavingSinceTick >= SEASON)
    .sort((a, b) => a.house.breadStock - b.house.breadStock || a.house.level - b.house.level || a.house.buildingId.localeCompare(b.house.buildingId))
    .slice(0, room);
  for (const { house, index } of due) houses[index] = abandon(house, tick);
  let resettled = 0;
  if (!reserveShort) {
    const lots = new Map(state.buildings.map(building => [building.id, building]));
    const index = houses.findIndex(house => house.abandonedTick !== undefined && house.hasWater && tick - house.abandonedTick >= PRESSURE_BALANCE.resettleAfterTicks);
    const house = houses[index];
    if (house !== undefined) {
      const { abandonedTick: _abandoned, ...rest } = house;
      houses[index] = { ...rest, residents: houseLotArea(lots.get(house.buildingId)) };
      resettled = 1;
    }
  }
  if (due.length > 0 || resettled > 0) changed = true;
  return {
    houses, changed,
    tally: leaving + abandoned + due.length + resettled === 0 ? tally : { ...tally, leaving: tally.leaving + leaving,
      abandoned: tally.abandoned + abandoned + due.length, departures: tally.departures + due.length, resettled: tally.resettled + resettled },
  };
}

/**
 * FP-4 (decision FP9): ticks at the normal ration from `tick` until the next harvest begins (in-year `growTicks`, the
 * AF-11 reserve outlook's harvest), a winter tick counting × 1.2. From the start of autumn: 1,000 + 1,200 + 1,500 = 3,700.
 */
export function ticksUntilNextHarvest(tick: number): number {
  const year = BALANCE.TICKS_PER_YEAR;
  const harvest = ARABLE_CONFIG.growTicks;
  const from = ((tick % year) + year) % year;
  const span = from < harvest ? harvest - from : year - from + harvest;
  let need = 0;
  for (let at = from, left = span; left > 0;) {
    const inYear = at % year;
    const segmentEnd = inYear < PRESSURE_BALANCE.winterFrom ? PRESSURE_BALANCE.winterFrom : year;
    const length = Math.min(left, segmentEnd - inYear);
    need += inYear >= PRESSURE_BALANCE.winterFrom ? length * PRESSURE_BALANCE.winterRationPermille / 1000 : length;
    at += length;
    left -= length;
  }
  return Math.ceil(need);
}

/**
 * FP-4 (FP9): the town's food until the next harvest, in ticks at the normal ration: stored food (FIX-1 reserve: bread
 * and wheat ÷ 2 in buildings and on carts) plus the crop still standing in tended strips (sown, growing and ripe; a
 * growing crop counted at full growth, a ripe one at what it grew). Null when no house eats.
 */
export function harvestOutlookTicks(state: GameState): number | null {
  const ration = state.houses.reduce((sum, house) => sum + (house.residents > 0 ? houseFoodRation(house) : 0), 0);
  if (ration <= 0) return null;
  const stored = foodReserveTicks(state) ?? 0;
  const layouts = arableLayouts(state);
  const tending = stripTending(state, layouts);
  const strips = new Map(layouts.flatMap(layout => layout.strips).map(strip => [strip.id, strip]));
  let standing = 0;
  for (const field of state.arableFields ?? []) {
    for (const record of field.strips) {
      const strip = strips.get(record.id);
      if (strip === undefined || tending.get(record.id)?.status !== "tended") continue;
      if (record.stage === "sown" || record.stage === "growing") standing += stripYield(strip, record, 1000);
      else if (record.stage === "ripe") standing += stripYield(strip, record, record.completionPermille ?? 1000);
    }
  }
  const wheatPerBread = BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 2;
  return stored + Math.floor(Math.floor(standing / wheatPerBread) * HOUSE_FOOD_INTERVAL / ration);
}

/** FP-4 (FP9): at the start of autumn, the first time the food in store and in the fields will not last to the next harvest. */
function firstWinterWarning(state: GameState, seasons: SeasonState): SeasonState {
  if (seasons.firstWinterWarning !== undefined) return seasons;
  if (calendar(state.tick, scenarioOf(state).startYear).season !== 2 || state.tick % SEASON !== 0) return seasons;
  const reserve = harvestOutlookTicks(state);
  const need = ticksUntilNextHarvest(state.tick);
  if (reserve === null || reserve >= need) return seasons;
  return { ...seasons, firstWinterWarning: { tick: state.tick, reserveTicks: reserve, untilHarvestTicks: need },
    current: { ...seasons.current, firstWinterWarning: true } };
}

/** FP-4 goal-card hook `first_winter_warning`: raised in autumn, standing through that winter (the lean spring is the card's next step). */
export function firstWinterWarningActive(state: Pick<GameState, "tick" | "seasons">): boolean {
  const warning = state.seasons?.firstWinterWarning;
  return warning !== undefined && state.tick >= warning.tick && state.tick < warning.tick + 2 * SEASON;
}

/** One tick of F0-A pressure. Returns the state unchanged between samples. */
export function advanceSeasons(state: GameState): GameState {
  if (state.tick % PRESSURE_BALANCE.sampleTicks !== 0 && state.seasons !== undefined) return state;
  let seasons = seasonsOf(state);
  let next = state;
  if (state.tick > 0 && state.tick % SEASON === 0 && state.tick > seasons.current.startTick) {
    seasons = closeSeason(state, seasons);
  }
  const eras = advanceHistoricalEras(next);
  if (eras !== next) {
    const added = (eras.historicalEras ?? []).slice(next.historicalEras?.length ?? 0);
    if (state.historicalEras !== undefined && added.length > 0) {
      seasons = { ...seasons, current: { ...seasons.current, eras: [...seasons.current.eras, ...added.map(entry => ({ eraId: entry.id, forced: entry.forced }))] } };
    }
    next = eras;
  }
  seasons = firstWinterWarning(next, seasons);
  const ladder = stepLadder(next, seasons.current);
  if (ladder.changed) {
    const houses = [...withHouseholdMembers(ladder.houses, next.seed)];
    next = { ...next, houses, population: houses.reduce((total, house) => total + Math.max(0, house.residents), 0) };
  }
  return { ...next, seasons: ladder.tally === seasons.current ? seasons : { ...seasons, current: ladder.tally } };
}
