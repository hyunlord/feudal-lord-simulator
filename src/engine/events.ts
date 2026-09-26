/**
 * F0-B events, one tick (spec docs/design/flow-events.md EV-1…EV-9). Runs after the season step, so a season that
 * closes this tick has already been written and this tick's lines go to the new season.
 *
 * - EV-2 forecast lines: at a season's start, the occurrences whose rumour or sign begins this season are written to
 *   the season tally (`event_rumour`, `event_sign`); the forecast itself is `eventForecast` (derived).
 * - EV-5 dearth: arrives at its summer's start (saved record), ends at the next good harvest, recovers a season.
 * - EV-4 fire: on its planned summer, from a seeded offset, ignition is tried every `ignitionStepTicks` until a house
 *   meets the conditions; the summer passing without one marks the occurrence missed. The fire ends when its last
 *   house burns out, then recovers.
 * - EV-9 losses: burnt houses, households that left (stage 2) while an event arrived or recovered, and the harvest
 *   the dearth took. `event_recovered` carries them to the season ledger.
 * - B1 effect pipe: an arrived event publishes its definition's effects with source `{type: "event"}`.
 */
import { EffectRegistry, SETTLEMENT_REGION_ID, type SourceRef } from "../contracts";
import { ARABLE_CONFIG } from "../content/arableConfig";
import { BALANCE } from "../content/balanceConfig";
import { EVENT_DEF_BY_ID, FIRE_CONFIG, type EventDef } from "../content/eventConfig";
import type { GameState } from "./engine.types";
import type { EventLosses, EventRecord, EventSeasonEvent, EventState } from "./events.types";
import {
  FORECAST_LOOKAHEAD_SEASONS,
  SEASON_TICKS,
  activeEventDefs,
  dearthEndTick,
  dearthWindow,
  eraPlannedSeason,
  plannedEvents,
  recordStage,
  seasonIndexOf,
  scheduledSeason,
  eventInstanceId,
} from "./eventSchedule";
import { igniteFire, stepFires } from "./fire";
import { hashSeed } from "./prng";

export const EMPTY_EVENT_STATE: EventState = { records: [], burning: [] };
const NO_LOSSES: EventLosses = { burntHouses: 0, departures: 0, harvestLost: 0 };

function withRecord(events: EventState, record: EventRecord): EventState {
  const index = events.records.findIndex(entry => entry.id === record.id);
  if (index < 0) return { ...events, records: [...events.records, record] };
  const records = [...events.records];
  records[index] = record;
  return { ...events, records };
}

function arrive(def: EventDef, season: number, tick: number, originBuildingId?: string): EventRecord {
  return { id: eventInstanceId(def, season), defId: def.id, kind: def.kind, season, arrivalTick: tick,
    ...(originBuildingId === undefined ? {} : { originBuildingId }), losses: NO_LOSSES };
}

function ended(record: EventRecord, tick: number): EventRecord {
  const def = EVENT_DEF_BY_ID.get(record.defId);
  return { ...record, endTick: tick, recoveryUntilTick: tick + (def?.recoverySeasons ?? 0) * SEASON_TICKS };
}

/** EV-9: the start of a dearth's first reduced harvest (its arrival year's in-year `growTicks`). */
export function dearthHarvestStart(record: Pick<EventRecord, "arrivalTick" | "harvestFromYear">): number {
  const year = record.harvestFromYear ?? Math.floor(record.arrivalTick / BALANCE.TICKS_PER_YEAR);
  return year * BALANCE.TICKS_PER_YEAR + ARABLE_CONFIG.growTicks;
}

/** EV-4: the tick a planned fire's ignition attempts start: its summer's start plus a seeded offset in the first half. */
export function fireIgnitionFrom(state: Pick<GameState, "seed">, id: string, season: number): number {
  const steps = SEASON_TICKS / 2 / FIRE_CONFIG.ignitionStepTicks;
  return season * SEASON_TICKS + (hashSeed(state.seed, `fire-offset:${id}`) % steps) * FIRE_CONFIG.ignitionStepTicks;
}

/** One tick of F0-B events. Returns the state unchanged for a scenario without events. */
export function advanceEvents(state: GameState): GameState {
  if (activeEventDefs(state).length === 0) return state;
  const tick = state.tick;
  const now = seasonIndexOf(tick);
  let next = state;
  let events = state.events ?? EMPTY_EVENT_STATE;
  const lines: EventSeasonEvent[] = [];
  const known = (id: string) => events.records.some(record => record.id === id) || (events.missed ?? []).includes(id);

  // EV-2: rumour and sign lines at the season's start.
  if (tick % SEASON_TICKS === 0) {
    for (const planned of plannedEvents(state, now, now + FORECAST_LOOKAHEAD_SEASONS)) {
      if (known(planned.id)) continue;
      if (planned.season - planned.def.forecast.rumourSeasons === now) lines.push({ kind: "event_rumour", eventId: planned.id, defId: planned.def.id });
      if (planned.season - planned.def.forecast.signSeasons === now) lines.push({ kind: "event_sign", eventId: planned.id, defId: planned.def.id });
    }
    // EV-4: a planned fire whose summer ended without a house to catch is missed.
    for (const planned of plannedEvents(state, now - 1, now - 1)) {
      if (planned.def.kind === "fire" && !known(planned.id)) events = { ...events, missed: [...(events.missed ?? []), planned.id] };
    }
  }

  // EV-5: dearths arrive at their summer's start and end at the next good harvest (a game loaded mid-dearth catches up).
  for (const def of activeEventDefs(state)) {
    if (def.kind !== "dearth") continue;
    const season = scheduledSeason(state, def);
    if (season === null) continue;
    const span = dearthWindow(def, season);
    const id = eventInstanceId(def, season);
    const record = events.records.find(entry => entry.id === id);
    if (record === undefined && tick >= span.arrivalTick && tick < span.endTick) {
      events = withRecord(events, arrive(def, season, tick));
      lines.push({ kind: "event_arrived", eventId: id, defId: def.id });
    }
  }

  // FC-1: an era dearth (the Great Famine) arrives when its era enters. An era entered before events existed (a v13
  // save loaded later) is missed, not started late.
  for (const def of activeEventDefs(state)) {
    if (def.schedule.type !== "era") continue;
    const schedule = def.schedule;
    const id = eventInstanceId(def, eraPlannedSeason(state, def)!);
    const entered = state.historicalEras?.find(entry => entry.id === schedule.eraId);
    if (entered === undefined || known(id)) continue;
    if (entered.enteredTick < tick - SEASON_TICKS) {
      events = { ...events, missed: [...(events.missed ?? []), id] };
      continue;
    }
    const year = Math.floor(tick / BALANCE.TICKS_PER_YEAR);
    const counts = schedule.harvestYearCounts;
    events = withRecord(events, { ...arrive(def, seasonIndexOf(tick), tick), id,
      harvestFromYear: tick % BALANCE.TICKS_PER_YEAR < ARABLE_CONFIG.growTicks ? year : year + 1,
      harvestYears: counts[hashSeed(state.seed, `era-harvests:${def.id}`) % counts.length]!, populationAtArrival: state.population });
    lines.push({ kind: "event_arrived", eventId: id, defId: def.id });
  }

  // EV-5, FC-1: a dearth ends at the next good harvest.
  for (const record of events.records) {
    if (record.kind !== "dearth" || record.endTick !== undefined || tick < dearthEndTick(record)) continue;
    events = withRecord(events, { ...ended(record, tick), ...(record.populationAtArrival === undefined ? {} : { populationAtEnd: state.population }) });
  }

  // EV-4: ignition on a planned fire's summer.
  for (const planned of plannedEvents(state, now, now)) {
    if (planned.def.kind !== "fire" || known(planned.id)) continue;
    if (tick < fireIgnitionFrom(state, planned.id, planned.season) || tick % FIRE_CONFIG.ignitionStepTicks !== 0) continue;
    const lit = igniteFire({ ...next, events }, planned.id);
    if (lit === null) continue;
    next = lit.state;
    events = withRecord(lit.state.events ?? events, arrive(planned.def, planned.season, tick, lit.originBuildingId));
    lines.push({ kind: "event_arrived", eventId: planned.id, defId: planned.def.id });
  }

  // EV-4: spread and burn-out; a fire ends when its last house is out.
  const fires = stepFires({ ...next, events });
  next = fires.state;
  events = next.events ?? events;
  for (const out of fires.burntOut) {
    const record = events.records.find(entry => entry.id === out.eventId);
    if (record !== undefined) events = withRecord(events, { ...record, losses: { ...record.losses, burntHouses: record.losses.burntHouses + 1 } });
  }
  for (const record of events.records) {
    if (record.kind === "fire" && record.endTick === undefined && !events.burning.some(fire => fire.eventId === record.id)) {
      events = withRecord(events, ended(record, tick));
    }
  }

  // EV-9: households that left for want of food count as a dearth's loss when their shortage began after its first
  // harvest came in: stage 2 takes two seasons of shortage, so from the harvest's start + two seasons to recovery's end.
  const departed = next.houses.filter(house => house.abandonedTick === tick).length;
  if (departed > 0) {
    for (const record of events.records) {
      if (record.kind !== "dearth" || recordStage(record, tick) === "done" || tick < dearthHarvestStart(record) + 2 * SEASON_TICKS) continue;
      events = withRecord(events, { ...record, losses: { ...record.losses, departures: record.losses.departures + departed } });
    }
  }

  // EV-2: recovery ends.
  for (const record of events.records) {
    if (record.recoveryUntilTick === tick) lines.push({ kind: "event_recovered", eventId: record.id, defId: record.defId, losses: record.losses });
  }

  if (events === state.events && lines.length === 0 && next === state) return state;
  const seasons = next.seasons;
  return {
    ...next,
    events,
    ...(seasons === undefined || lines.length === 0 ? {} : {
      seasons: { ...seasons, current: { ...seasons.current, events: [...(seasons.current.events ?? []), ...lines] } },
    }),
  };
}

/** EV-9: wheat a dearth's harvest lost goes to the arriving dearth's record (production calls this on a harvest). */
export function recordHarvestLoss(state: GameState, lost: number): GameState {
  if (lost <= 0 || state.events === undefined) return state;
  const record = [...state.events.records].reverse().find(entry => entry.kind === "dearth" && recordStage(entry, state.tick) === "arrival");
  if (record === undefined) return state;
  return { ...state, events: withRecord(state.events, { ...record, losses: { ...record.losses, harvestLost: record.losses.harvestLost + lost } }) };
}

/** EV-1: the source an event's effects and causes carry. */
export function eventSource(record: Pick<EventRecord, "id" | "defId">, detail?: string): SourceRef {
  return { type: "event", id: record.id, detail: detail ?? record.defId };
}

/** EV-1 (B1 pipe): the effects of the events arriving at `state.tick`, source `{type: "event"}`, on the whole town. */
export function eventEffectRegistry(state: GameState): EffectRegistry {
  const registry = new EffectRegistry();
  for (const record of state.events?.records ?? []) {
    const def = EVENT_DEF_BY_ID.get(record.defId);
    if (def === undefined || recordStage(record, state.tick) !== "arrival") continue;
    def.effects.forEach((spec, index) => registry.register({
      id: `${record.id}#${index}`, source: eventSource(record), target: { kind: "settlement", id: SETTLEMENT_REGION_ID },
      spec, startedAt: record.arrivalTick, ...(record.endTick === undefined ? {} : { expiresAt: record.endTick }),
    }));
  }
  return registry;
}

/** EV-5: the source of a raised food price (the arriving dearth), for the ledger postings it changes; null otherwise. */
export function foodPriceSource(state: GameState): SourceRef | null {
  const record = [...(state.events?.records ?? [])].reverse().find(entry => entry.kind === "dearth" && recordStage(entry, state.tick) === "arrival");
  return record === undefined ? null : eventSource(record, "food_price");
}

/** EV-4: why a house is as it is, for the inspector — the fire that burnt it. Empty when nothing happened to it. */
export function houseEventCauses(state: GameState, buildingId: string): readonly SourceRef[] {
  const house = state.houses.find(candidate => candidate.buildingId === buildingId);
  if (house?.burntByEventId === undefined) return [];
  const record = state.events?.records.find(entry => entry.id === house.burntByEventId);
  return [eventSource(record ?? { id: house.burntByEventId, defId: house.burntByEventId.split("@")[0] ?? "fire" }, "burnt")];
}

/** EV-4 render API: the houses on fire now (building id, since when, doused or not). */
export function burningHouses(state: GameState): EventState["burning"] {
  return state.events?.burning ?? [];
}
