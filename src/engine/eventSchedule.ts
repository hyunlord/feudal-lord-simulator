/**
 * F0-B event schedule and weather (spec docs/design/flow-events.md EV-1…EV-3, EV-5). Pure functions of the state seed,
 * the scenario and the tick: the schedule and the weather are never saved, so a loaded game sees the same future.
 *
 * - EV-1: a scenario's `activeEvents` names the event definitions it runs (and `weather`). A scheduled event takes one
 *   summer in its span, picked by the seed; a chance fire takes a dry summer after the first fire's summer when the
 *   seed's roll for that summer is under its chance.
 * - EV-2: the forecast ladder. Before arrival: rumour (from `rumourSeasons` before) and sign (from `signSeasons`
 *   before, through the planned summer until the event arrives). After: arrival, recovery, done (saved records).
 * - EV-3: the weather of each season, by the seed's roll on the season's table. A scheduled fire makes its summer and
 *   the spring before it dry; a dearth makes its harvest summers and the spring before the first wet (the sign).
 */
import { ARABLE_CONFIG } from "../content/arableConfig";
import { PRESSURE_BALANCE, BALANCE } from "../content/balanceConfig";
import {
  EVENT_DEF_BY_ID,
  WEATHER_TABLE,
  WEATHER_EVENT_ID,
  WET_SUMMER_HARVEST_PERMILLE,
  type EventDef,
  type WeatherKind,
} from "../content/eventConfig";
import type { GameState } from "./engine.types";
import type { EventForecastEntry, EventRecord, EventStage, WeatherReport } from "./events.types";
import { rollPermille, hashSeed } from "./prng";
import { FAMINE_RESPONSE_CONFIG } from "../content/chapterConfig";
import { calendar, scenarioOf } from "./scenarioState";

export const SEASON_TICKS = PRESSURE_BALANCE.seasonTicks;
const SEASONS_PER_YEAR = BALANCE.TICKS_PER_YEAR / SEASON_TICKS;
const SUMMER = 1;

/** The schedule reads the seed and scenario; F0-C1's era events also read what arrived and the eras entered. */
type EventWorld = Pick<GameState, "seed" | "scenarioId"> & Partial<Pick<GameState, "events" | "historicalEras">>;

export function seasonIndexOf(tick: number): number {
  return Math.floor(tick / SEASON_TICKS);
}

/** EV-1: the scenario's event definitions, in scenario order. */
export function activeEventDefs(state: Pick<GameState, "scenarioId">): readonly EventDef[] {
  return scenarioOf(state).activeEvents.flatMap(id => {
    const def = EVENT_DEF_BY_ID.get(id);
    return def === undefined ? [] : [def];
  });
}

export function weatherActive(state: Pick<GameState, "scenarioId">): boolean {
  return scenarioOf(state).activeEvents.includes(WEATHER_EVENT_ID);
}

function summerOfYearIndex(yearIndex: number): number {
  return yearIndex * SEASONS_PER_YEAR + SUMMER;
}

/** EV-1: the calendar year a scheduled definition takes (null for chance events). */
export function scheduledYear(state: EventWorld, def: EventDef): number | null {
  if (def.schedule.type !== "scheduled") return null;
  const schedule = def.schedule;
  let years = schedule.yearOffsets.map(offset => schedule.centreYear + offset);
  const afterDef = schedule.afterEventId === undefined ? undefined : EVENT_DEF_BY_ID.get(schedule.afterEventId);
  const after = afterDef === undefined ? null : scheduledYear(state, afterDef);
  if (after !== null) {
    const permitted = years.filter(year => year >= after + (schedule.minYearsAfter ?? 0));
    years = permitted.length > 0 ? permitted : [Math.max(...years)];
  }
  return years[hashSeed(state.seed, `event-year:${def.id}`) % years.length]!;
}

/** EV-1: the absolute season index (summer) a scheduled definition is placed on. */
export function scheduledSeason(state: EventWorld, def: EventDef): number | null {
  const year = scheduledYear(state, def);
  return year === null ? null : summerOfYearIndex(year - scenarioOf(state).startYear);
}

/** FC-1: the summer an era event's forecast counts back from (its era's year). */
export function eraPlannedSeason(state: Pick<GameState, "scenarioId">, def: EventDef): number | null {
  return def.schedule.type === "era" ? summerOfYearIndex(def.schedule.plannedYear - scenarioOf(state).startYear) : null;
}

/** FC-1: the record of an event definition that arrived (era events arrive once). */
function recordOf(state: EventWorld, def: EventDef): EventRecord | undefined {
  return state.events?.records.find(record => record.defId === def.id);
}

/** FC-1: the summers a dearth record's harvests fall in (absolute season indices). */
function recordHarvestSummers(record: EventRecord): readonly number[] {
  if (record.harvestFromYear === undefined) return [];
  return Array.from({ length: record.harvestYears ?? 1 }, (_, index) => summerOfYearIndex(record.harvestFromYear! + index));
}

/** EV-3: the weather a scheduled event forces on a season, or null. */
function forcedWeather(state: EventWorld, seasonIndex: number): WeatherKind | null {
  for (const def of activeEventDefs(state)) {
    const season = scheduledSeason(state, def);
    if (season === null) continue;
    if (def.kind === "fire" && (seasonIndex === season || seasonIndex === season - def.forecast.signSeasons)) return "dry";
    if (def.kind === "dearth") {
      const summers = (def.harvestYears ?? [0]).map(offset => season + offset * SEASONS_PER_YEAR);
      if (summers.includes(seasonIndex) || seasonIndex === season - def.forecast.signSeasons) return "wet";
    }
  }
  // FC-1: the famine's two wet summers before its year (the sign), and its own harvest summers once it arrived.
  for (const def of activeEventDefs(state)) {
    const planned = eraPlannedSeason(state, def);
    if (planned === null) continue;
    if (seasonIndex === planned - SEASONS_PER_YEAR || seasonIndex === planned - 2 * SEASONS_PER_YEAR) return "wet";
    const record = recordOf(state, def);
    if (record !== undefined && recordHarvestSummers(record).includes(seasonIndex)) return "wet";
  }
  return null;
}

/** EV-3: the weather of an absolute season. `normal` when the scenario has no weather. */
export function weatherOfSeason(state: EventWorld, seasonIndex: number): WeatherKind {
  if (!weatherActive(state) || seasonIndex < 0) return "normal";
  const forced = forcedWeather(state, seasonIndex);
  if (forced !== null) return forced;
  const table = WEATHER_TABLE[seasonIndex % SEASONS_PER_YEAR]!;
  let roll = rollPermille(state.seed, "weather", seasonIndex);
  for (const [kind, chance] of table) {
    if (roll < chance) return kind;
    roll -= chance;
  }
  return "normal";
}

/** EV-3 API: the weather now. */
export function weatherAt(state: EventWorld & Pick<GameState, "tick">, tick: number = state.tick): WeatherReport {
  const seasonIndex = seasonIndexOf(tick);
  return { kind: weatherOfSeason(state, seasonIndex), seasonIndex };
}

/** One planned occurrence: the season it is placed on (a summer). */
export interface PlannedEvent {
  readonly id: string;
  readonly def: EventDef;
  readonly season: number;
}

export function eventInstanceId(def: EventDef, season: number): string {
  return `${def.id}@${season}`;
}

/** EV-1: occurrences placed on summers in [fromSeason, toSeason], in season order. */
export function plannedEvents(state: EventWorld, fromSeason: number, toSeason: number): readonly PlannedEvent[] {
  const planned: PlannedEvent[] = [];
  for (const def of activeEventDefs(state)) {
    if (def.schedule.type === "scheduled") {
      const season = scheduledSeason(state, def);
      if (season !== null && season >= fromSeason && season <= toSeason) planned.push({ id: eventInstanceId(def, season), def, season });
      continue;
    }
    if (def.schedule.type === "era") {
      // FC-1: planned on its era's summer; waiting past it (the town not ready), it is due any season now.
      // The id stays the planned summer's, so the forecast, the ledger lines and the record agree.
      // Not pending once its era has entered (it arrived, or came with an old save) or its last year has passed.
      const plannedSeason = eraPlannedSeason(state, def)!;
      const season = Math.max(plannedSeason, fromSeason);
      const lastSeason = summerOfYearIndex(def.schedule.lastYear - scenarioOf(state).startYear) + SEASONS_PER_YEAR;
      const eraId = def.schedule.eraId;
      const entered = (state.historicalEras ?? []).some(entry => entry.id === eraId);
      if (recordOf(state, def) === undefined && !entered && season <= toSeason && fromSeason < lastSeason) {
        planned.push({ id: eventInstanceId(def, plannedSeason), def, season });
      }
      continue;
    }
    const afterDef = EVENT_DEF_BY_ID.get(def.schedule.afterEventId);
    const after = afterDef === undefined ? null : scheduledSeason(state, afterDef);
    if (after === null) continue;
    const firstYear = Math.max(Math.floor(fromSeason / SEASONS_PER_YEAR), Math.floor(after / SEASONS_PER_YEAR) + 1);
    for (let year = firstYear; summerOfYearIndex(year) <= toSeason; year += 1) {
      const season = summerOfYearIndex(year);
      if (season < fromSeason || weatherOfSeason(state, season) !== "dry") continue;
      if (rollPermille(state.seed, `event-chance:${def.id}`, season) < def.schedule.chancePermille) planned.push({ id: eventInstanceId(def, season), def, season });
    }
  }
  return planned.sort((a, b) => a.season - b.season || a.id.localeCompare(b.id));
}

/**
 * EV-5: a dearth's arrival (its summer's start) and end: the next good harvest's start, when the first sown strips
 * ripen (in-year `ARABLE_CONFIG.growTicks`, the AF-11 outlook's harvest).
 */
export function dearthWindow(def: EventDef, season: number): { readonly arrivalTick: number; readonly endTick: number } {
  const lastHarvestYear = Math.floor(season / SEASONS_PER_YEAR) + Math.max(0, ...(def.harvestYears ?? [0]));
  return { arrivalTick: season * SEASON_TICKS, endTick: (lastHarvestYear + 1) * BALANCE.TICKS_PER_YEAR + ARABLE_CONFIG.growTicks };
}

/** EV-2: the forecast looks as far ahead as the longest rumour (the famine's three years). */
export const FORECAST_LOOKAHEAD_SEASONS = Math.max(...[...EVENT_DEF_BY_ID.values()].map(def => def.forecast.rumourSeasons));

/** EV-2: the stage of a saved record at `tick`. */
export function recordStage(record: EventRecord, tick: number): EventStage {
  if (record.endTick === undefined || tick < record.endTick) return "arrival";
  return record.recoveryUntilTick !== undefined && tick < record.recoveryUntilTick ? "recovery" : "done";
}

/** EV-2: the stage of a planned occurrence that has not arrived (null = not yet rumoured, or its summer passed). */
export function plannedStage(planned: PlannedEvent, tick: number): "rumour" | "sign" | null {
  const now = seasonIndexOf(tick);
  if (now > planned.season) return null;
  if (now >= planned.season - planned.def.forecast.signSeasons) return "sign";
  return now >= planned.season - planned.def.forecast.rumourSeasons ? "rumour" : null;
}

/**
 * EV-2 API: the events the player can see now — rumoured and signed occurrences not yet arrived, and arrived events
 * still arriving or recovering — by arrival tick.
 */
export function eventForecast(state: GameState): readonly EventForecastEntry[] {
  const now = seasonIndexOf(state.tick);
  const records = state.events?.records ?? [];
  const known = new Set([...records.map(record => record.id), ...(state.events?.missed ?? [])]);
  const startYear = scenarioOf(state).startYear;
  const entry = (id: string, def: EventDef, stage: EventStage, arrivalTick: number): EventForecastEntry => {
    const date = calendar(arrivalTick, startYear);
    return { id, defId: def.id, kind: def.kind, stage, arrivalTick, year: date.year, season: date.season };
  };
  const lines: EventForecastEntry[] = [];
  for (const record of records) {
    const stage = recordStage(record, state.tick);
    const def = EVENT_DEF_BY_ID.get(record.defId);
    if (stage !== "done" && def !== undefined) lines.push(entry(record.id, def, stage, record.arrivalTick));
  }
  for (const planned of plannedEvents(state, now, now + FORECAST_LOOKAHEAD_SEASONS)) {
    if (known.has(planned.id)) continue;
    const stage = plannedStage(planned, state.tick);
    if (stage !== null) lines.push(entry(planned.id, planned.def, stage, planned.season * SEASON_TICKS));
  }
  return lines.sort((a, b) => a.arrivalTick - b.arrivalTick || a.id.localeCompare(b.id));
}

/**
 * EV-3, EV-5: the share of the grown crop a harvest at `tick` brings in, permille. A dearth's harvest years take its
 * `harvestPermille` (its wet summer included); otherwise a wet summer takes `WET_SUMMER_HARVEST_PERMILLE`.
 */
export function harvestYieldPermille(state: EventWorld, tick: number): number {
  if (!weatherActive(state)) return 1000;
  const yearIndex = Math.floor(tick / BALANCE.TICKS_PER_YEAR);
  // FC-1: an arrived era dearth's harvest years.
  for (const record of state.events?.records ?? []) {
    if (record.harvestFromYear === undefined || yearIndex < record.harvestFromYear || yearIndex >= record.harvestFromYear + (record.harvestYears ?? 1)) continue;
    const permille = EVENT_DEF_BY_ID.get(record.defId)?.harvestPermille;
    if (permille !== undefined) return permille;
  }
  for (const def of activeEventDefs(state)) {
    if (def.kind !== "dearth" || def.harvestPermille === undefined) continue;
    const season = scheduledSeason(state, def);
    if (season === null) continue;
    const arrivalYear = Math.floor(season / SEASONS_PER_YEAR);
    if ((def.harvestYears ?? [0]).some(offset => arrivalYear + offset === yearIndex)) return def.harvestPermille;
  }
  return weatherOfSeason(state, summerOfYearIndex(yearIndex)) === "wet" ? WET_SUMMER_HARVEST_PERMILLE : 1000;
}

/**
 * FC-1: when an arrived dearth ends — the start of the next good harvest after its last reduced one. Era dearths carry
 * their harvest years; a scheduled dearth's come from its definition.
 */
export function dearthEndTick(record: EventRecord): number {
  if (record.harvestFromYear !== undefined) return (record.harvestFromYear + (record.harvestYears ?? 1)) * BALANCE.TICKS_PER_YEAR + ARABLE_CONFIG.growTicks;
  const def = EVENT_DEF_BY_ID.get(record.defId);
  return def === undefined ? record.arrivalTick : dearthWindow(def, record.season).endTick;
}

/**
 * EV-5, FC-1, FC-2: the food price (bread and wheat at market), permille of the usual price: the dearest arriving
 * dearth; an era dearth signed but not arrived raises it to its sign price; a famine under price control is capped.
 */
export function foodPricePermille(state: EventWorld, tick: number): number {
  let price = 1000;
  for (const record of state.events?.records ?? []) {
    const def = EVENT_DEF_BY_ID.get(record.defId);
    if (def?.schedule.type !== "era" || def.foodPricePermille === undefined || tick < record.arrivalTick || tick >= dearthEndTick(record)) continue;
    const capped = record.response?.choice === "price_control" ? Math.min(def.foodPricePermille, FAMINE_RESPONSE_CONFIG.priceCapPermille) : def.foodPricePermille;
    price = Math.max(price, capped);
  }
  for (const def of activeEventDefs(state)) {
    if (def.schedule.type !== "era" || def.signFoodPricePermille === undefined || recordOf(state, def) !== undefined) continue;
    const planned = eraPlannedSeason(state, def)!;
    if (seasonIndexOf(tick) >= planned - def.forecast.signSeasons) price = Math.max(price, def.signFoodPricePermille);
  }
  for (const def of activeEventDefs(state)) {
    if (def.kind !== "dearth" || def.foodPricePermille === undefined) continue;
    const season = scheduledSeason(state, def);
    if (season === null) continue;
    const span = dearthWindow(def, season);
    if (tick >= span.arrivalTick && tick < span.endTick) price = Math.max(price, def.foodPricePermille);
  }
  return price;
}

/**
 * FP-3 × FC-2: households that may leave per season. While a famine arrives, relief lowers the cap and speculation
 * raises it; otherwise the pressure rules' cap.
 */
export function departureCapPerSeason(state: Pick<GameState, "events" | "tick">, usual: number): number {
  for (const record of state.events?.records ?? []) {
    if (record.response === undefined || state.tick < record.arrivalTick || state.tick >= dearthEndTick(record)) continue;
    if (record.response.choice === "relief") return FAMINE_RESPONSE_CONFIG.reliefDepartureCap;
    if (record.response.choice === "speculation") return FAMINE_RESPONSE_CONFIG.speculationDepartureCap;
  }
  return usual;
}

/**
 * FC-2 the price shock: while an arriving era dearth sells food at `poorShortPricePermille` or more, the poorest
 * `poorPermille` of the lived-in households (lowest level, then id: the same households season after season) cannot buy bread — the ladder
 * counts them short. Relief feeds them (`ignoreRelief` lists them anyway, for the relief's bill).
 */
export function famineShortHouses(state: Pick<GameState, "events" | "houses" | "tick" | "seed" | "scenarioId">, ignoreRelief = false): readonly string[] {
  const record = state.events?.records.find(entry => EVENT_DEF_BY_ID.get(entry.defId)?.schedule.type === "era"
    && state.tick >= entry.arrivalTick && state.tick < dearthEndTick(entry));
  if (record === undefined || (!ignoreRelief && record.response?.choice === "relief")) return [];
  if (foodPricePermille(state, state.tick) < FAMINE_RESPONSE_CONFIG.poorShortPricePermille) return [];
  const lived = state.houses.filter(house => house.residents > 0 && house.abandonedTick === undefined)
    .sort((a, b) => a.level - b.level || a.buildingId.localeCompare(b.buildingId));
  return lived.slice(0, Math.floor(lived.length * FAMINE_RESPONSE_CONFIG.poorPermille / 1000)).map(house => house.buildingId);
}
