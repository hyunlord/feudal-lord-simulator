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
import { calendar, scenarioOf } from "./scenarioState";

export const SEASON_TICKS = PRESSURE_BALANCE.seasonTicks;
const SEASONS_PER_YEAR = BALANCE.TICKS_PER_YEAR / SEASON_TICKS;
const SUMMER = 1;

type EventWorld = Pick<GameState, "seed" | "scenarioId">;

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

const MAX_RUMOUR_SEASONS = 4;

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
  for (const planned of plannedEvents(state, now, now + MAX_RUMOUR_SEASONS)) {
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
  for (const def of activeEventDefs(state)) {
    if (def.kind !== "dearth" || def.harvestPermille === undefined) continue;
    const season = scheduledSeason(state, def);
    if (season === null) continue;
    const arrivalYear = Math.floor(season / SEASONS_PER_YEAR);
    if ((def.harvestYears ?? [0]).some(offset => arrivalYear + offset === yearIndex)) return def.harvestPermille;
  }
  return weatherOfSeason(state, summerOfYearIndex(yearIndex)) === "wet" ? WET_SUMMER_HARVEST_PERMILLE : 1000;
}

/** EV-5: the food price (bread and wheat at market), permille of the usual price: the dearest arriving dearth. */
export function foodPricePermille(state: EventWorld, tick: number): number {
  let price = 1000;
  for (const def of activeEventDefs(state)) {
    if (def.kind !== "dearth" || def.foodPricePermille === undefined) continue;
    const season = scheduledSeason(state, def);
    if (season === null) continue;
    const span = dearthWindow(def, season);
    if (tick >= span.arrivalTick && tick < span.endTick) price = Math.max(price, def.foodPricePermille);
  }
  return price;
}
