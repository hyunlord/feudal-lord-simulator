/**
 * F0-C2 history ledger v0 (spec docs/design/history-ledger.md HL-1…HL-9). Append-only: records are only added; the one
 * later write is a decision's `actual` (HL-3). Nothing here changes the simulation — the ledger reads the state before
 * and after each tick and each player command.
 *
 * - HL-2 ① decisions: every player command (`gameReducer`) — the everyday ones (build, road, zone, house, cancel,
 *   operation, wall priority) counted per season and written as one record per kind at its end; the big ones (market
 *   town, stone town, famine answer, petition answer, rebuild) one record each with alternatives and a prediction.
 * - HL-2 ②–⑤ per tick: event lines (rumour, sign, arrival, recovery), eras entered and chapter ends, milestones (first
 *   of each building, market town, stone town, first L4, lots 6/12/24), the season's close with its thumbnail and big
 *   changes, and each household's life (moved in, rose, fell, preparing to leave, stayed, left, resettled, burnt,
 *   rebuilt, emptied, went hungry, fed again, reached or lost water, grew or shrank).
 * - HL-3: a prediction's `actual` is filled on the same keys two seasons later.
 * - HL-5: thumbnails 128² every season, 256² for an era or a chapter end.
 */
import { CHAPTER_ONE, PETITION_DEFS, type FamineResponseChoice, type PetitionResponse } from "../content/chapterConfig";
import { HISTORY_TEMPLATES } from "../content/historyCopy.ko";
import { MONEY_BALANCE, PRESSURE_BALANCE } from "../content/balanceConfig";
import { calendar, scenarioOf } from "./scenarioState";
import type { GameState } from "./engine.types";
import type {
  ActorRef,
  HistoryDecision,
  HistoryKind,
  HistoryQuery,
  HistoryRecord,
  HistorySeverity,
  HistoryState,
} from "./history.types";
import { decodeSnapshot, rasterizeSnapshot } from "./historySnapshot";
import { famineShortHouses } from "./eventSchedule";
import { housingLotCount } from "../population/housing";
import type { SourceRef } from "../contracts";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const TOWN: ActorRef = { type: "town", id: "town" };
/** HL-3: `actual` is read this long after the decision. */
export const ACTUAL_AFTER_TICKS = 2 * SEASON;

/** HL-2 ①: the twelve decision kinds and the commands behind them. */
export const DECISION_KINDS = ["build", "road", "zone", "house", "cancel", "operation", "wall_priority",
  "rebuild", "market_town", "stone_town", "famine_response", "petition_response"] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];
/** HL-3: the big five, one record each with alternatives, a prediction and (later) the actual. */
export const BIG_DECISION_KINDS: readonly DecisionKind[] = ["market_town", "stone_town", "famine_response", "petition_response", "rebuild"];

export const DECISION_KIND_BY_COMMAND: Readonly<Record<string, DecisionKind>> = {
  place_building: "build", place_road_line: "road", remove_road: "road",
  zone_paint: "zone", zone_erase: "zone", zone_remove: "zone", zone_undo_stroke: "zone",
  demolish_house: "house", merge_houses: "house", cancel_construction: "cancel", set_building_operation: "operation",
  set_wall_construction_priority: "wall_priority", rebuild_house: "rebuild",
  confirm_palisade_proclamation: "market_town", confirm_stone_town_proclamation: "stone_town",
  famine_response: "famine_response", petition_response: "petition_response",
};

/** HL-2 ③: buildings whose first completion is a milestone. */
const MILESTONE_BUILDINGS = ["well", "granary", "mill", "farmstead", "market", "chapel", "church", "sawmill", "quarry", "masonry"] as const;
const LOT_MILESTONES = [6, 12, 24] as const;

export const EMPTY_HISTORY: HistoryState = { records: [], snapshots: [], nextOrdinal: 1, seasonDecisions: {}, milestones: [], pendingActuals: [] };

function historyOf(state: Pick<GameState, "history">): HistoryState {
  return state.history ?? EMPTY_HISTORY;
}

type Draft = Omit<HistoryRecord, "id">;

/** Appends records (and a thumbnail for the first that asks for one) to the history; returns it unchanged if none. */
function append(history: HistoryState, drafts: readonly (Draft & { readonly thumbnail?: { state: GameState; size: 128 | 256 } })[]): HistoryState {
  if (drafts.length === 0) return history;
  let ordinal = history.nextOrdinal;
  const records = [...history.records];
  const snapshots = [...history.snapshots];
  const pending = [...history.pendingActuals];
  for (const { thumbnail, ...draft } of drafts) {
    const id = `h-${String(ordinal).padStart(6, "0")}`;
    ordinal += 1;
    let snapshotId: string | undefined;
    if (thumbnail !== undefined) {
      snapshotId = `s-${id.slice(2)}`;
      snapshots.push(rasterizeSnapshot(thumbnail.state, snapshotId, thumbnail.size));
    }
    records.push({ ...draft, id, ...(snapshotId === undefined ? {} : { snapshotId }) });
    if (draft.decision?.actualDueTick !== undefined) pending.push({ id, due: draft.decision.actualDueTick });
  }
  return { ...history, records, snapshots, nextOrdinal: ordinal, pendingActuals: pending };
}

/** The numbers a prediction and its actual are read on. */
function metrics(state: GameState): Readonly<Record<string, number>> {
  return { population: state.population, treasury: state.treasuryCoin, lots: housingLotCount(state),
    l4: state.houses.filter(house => house.level === 4).length, merchantGauge: state.politics?.merchantGauge ?? 50 };
}

function pick(values: Readonly<Record<string, number>>, keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map(key => [key, values[key] ?? 0]));
}

/** HL-3: what the big decision is expected to leave two seasons on (the actual is read on the same keys). */
function bigDecision(before: GameState, after: GameState, kind: DecisionKind, command: Readonly<Record<string, unknown>>): HistoryDecision {
  const now = metrics(before);
  const due = before.tick + ACTUAL_AFTER_TICKS;
  if (kind === "famine_response") {
    const chosen = String(command.choice) as FamineResponseChoice;
    const poor = famineShortHouses(before, true).length;
    const perHousehold = before.houses.filter(house => house.residents > 0).length === 0 ? 0
      : Math.round(before.population / before.houses.filter(house => house.residents > 0).length);
    const income = before.seasons?.history.at(-1)?.income ?? 0;
    const leaving = chosen === "laissez_faire" ? Math.min(poor, 2) : chosen === "speculation" ? Math.min(poor, 3) : 0;
    const treasury = chosen === "relief" ? -2 * income : chosen === "speculation" ? Math.round(income / 2) : 0;
    return { chosen, alternatives: (["relief", "price_control", "laissez_faire", "speculation"] as const).filter(option => option !== chosen),
      predicted: { population: now.population! - leaving * perHousehold, treasury: now.treasury! + treasury }, actualDueTick: due };
  }
  if (kind === "petition_response") {
    const chosen = String(command.response) as PetitionResponse;
    const outcome = PETITION_DEFS[0]!.outcomes[chosen];
    return { chosen, alternatives: (["accept", "accept_with_price", "refuse"] as const).filter(option => option !== chosen),
      predicted: { treasury: now.treasury! + outcome.charterFee, merchantGauge: Math.max(0, Math.min(100, now.merchantGauge! + outcome.gauge)) }, actualDueTick: due };
  }
  if (kind === "stone_town") {
    return { chosen: "proclaim", alternatives: ["wait"], predicted: { treasury: now.treasury! - MONEY_BALANCE.stoneWallProjectCost, lots: now.lots! }, actualDueTick: due };
  }
  if (kind === "market_town") {
    return { chosen: "proclaim", alternatives: ["wait"], predicted: pick(metrics(after), ["population", "lots"]), actualDueTick: due };
  }
  return { chosen: "rebuild", alternatives: ["leave"], predicted: pick(now, ["population"]), actualDueTick: due };
}

const BIG_KEYS: Readonly<Record<string, readonly string[]>> = {
  famine_response: ["population", "treasury"], petition_response: ["treasury", "merchantGauge"],
  stone_town: ["treasury", "lots"], market_town: ["population", "lots"], rebuild: ["population"],
};

/** HL-2 ①: records the player's (or the bot's) command, if it changed the state. Called by `gameReducer`. */
export function recordDecision(before: GameState, after: GameState, command: { readonly type: string } & Readonly<Record<string, unknown>>): GameState {
  const kind = DECISION_KIND_BY_COMMAND[command.type];
  if (kind === undefined || after === before) return after;
  const history = historyOf(after);
  if (!BIG_DECISION_KINDS.includes(kind)) {
    return { ...after, history: { ...history, seasonDecisions: { ...history.seasonDecisions, [kind]: (history.seasonDecisions[kind] ?? 0) + 1 } } };
  }
  const decision = bigDecision(before, after, kind, command);
  const params: Record<string, string> = { decisionKind: kind, chosen: decision.chosen };
  const place = kind === "rebuild" ? after.buildings.find(entry => entry.id === command.buildingId) : undefined;
  return { ...after, history: append(history, [{ tick: after.tick, kind: "decision", template: `decision.${kind}`, params, subject: TOWN,
    ...(place === undefined ? {} : { place: { tx: place.tx, ty: place.ty, buildingId: place.id } }), decision, severity: 1 }]) };
}

function eventCause(eventId: string, defId: string): SourceRef {
  return { type: "event", id: eventId, detail: defId };
}

/** HL-2 ⑤: a household's life between two states. */
function personDrafts(before: GameState, after: GameState): Draft[] {
  const previous = new Map(before.houses.map(house => [house.buildingId, house]));
  const buildings = new Map(after.buildings.map(building => [building.id, building]));
  const drafts: Draft[] = [];
  for (const house of after.houses) {
    const old = previous.get(house.buildingId);
    if (old === undefined) continue;
    const building = buildings.get(house.buildingId);
    const base = { tick: after.tick, kind: "person" as const, subject: { type: "household" as const, id: house.buildingId },
      ...(building === undefined ? {} : { place: { tx: building.tx, ty: building.ty, buildingId: building.id } }) };
    const push = (template: string, severity: HistorySeverity, extra: Partial<Draft> = {}) => drafts.push({ ...base, template, severity, ...extra });
    if (house.burntTick !== undefined && old.burntTick === undefined) {
      push("person.burnt", 1, house.burntByEventId === undefined ? {} : { cause: eventCause(house.burntByEventId, house.burntByEventId.split("@")[0] ?? "fire") });
      continue;
    }
    if (house.burntTick === undefined && old.burntTick !== undefined) push("person.rebuilt", 0);
    if (house.abandonedTick !== undefined && old.abandonedTick === undefined) { push("person.left", 1); continue; }
    if (house.abandonedTick === undefined && old.abandonedTick !== undefined) push("person.resettled", 0);
    if (house.leavingSinceTick !== undefined && old.leavingSinceTick === undefined) push("person.leaving", 0);
    if (old.residents <= 0 && house.residents > 0 && old.abandonedTick === undefined) push("person.move_in", 0);
    if (old.residents > 0 && house.residents <= 0 && house.abandonedTick === undefined) push("person.emptied", 1);
    if (house.level > old.level && house.burntTick === undefined) push("person.level_up", 0, { params: { level: house.level } });
    if (house.level < old.level && house.burntTick === undefined) push("person.level_down", 0, { params: { level: house.level } });
    if (house.leavingSinceTick === undefined && old.leavingSinceTick !== undefined && house.abandonedTick === undefined) push("person.stayed", 0);
    if (house.foodShortSinceTick !== undefined && old.foodShortSinceTick === undefined) push("person.hungry", 0);
    if (house.foodShortSinceTick === undefined && old.foodShortSinceTick !== undefined && house.abandonedTick === undefined) push("person.fed", 0);
    if (house.hasWater !== old.hasWater) push(house.hasWater ? "person.water" : "person.water_lost", 0);
    if (old.residents > 0 && house.residents > old.residents) push("person.grew", 0, { params: { residents: house.residents } });
    if (house.residents > 0 && house.residents < old.residents) push("person.shrank", 0, { params: { residents: house.residents } });
  }
  return drafts;
}

/** HL-2 ②: event lines written this tick (the season tally's new `event_*` lines). */
function eventDrafts(before: GameState, after: GameState): Draft[] {
  const current = after.seasons?.current;
  if (current === undefined) return [];
  const known = before.seasons?.current.startTick === current.startTick ? (before.seasons?.current.events?.length ?? 0) : 0;
  const drafts: Draft[] = [];
  for (const line of (current.events ?? []).slice(known)) {
    const record = after.events?.records.find(entry => entry.id === line.eventId);
    const origin = record?.originBuildingId === undefined ? undefined : after.buildings.find(building => building.id === record.originBuildingId);
    const base = { tick: after.tick, kind: "event" as const, subject: TOWN, cause: eventCause(line.eventId, line.defId),
      ...(origin === undefined ? {} : { place: { tx: origin.tx, ty: origin.ty, buildingId: origin.id } }) };
    if (line.kind === "event_rumour") drafts.push({ ...base, template: "event.rumour", params: { defId: line.defId, eventId: line.eventId }, severity: 1 });
    else if (line.kind === "event_sign") drafts.push({ ...base, template: "event.sign", params: { defId: line.defId, eventId: line.eventId }, severity: 1 });
    else if (line.kind === "event_arrived") drafts.push({ ...base, template: "event.arrived", params: { defId: line.defId, eventId: line.eventId }, severity: 2 });
    else if (line.kind === "event_recovered") drafts.push({ ...base, template: "event.recovered", severity: 2,
      params: { defId: line.defId, eventId: line.eventId, burntHouses: line.losses.burntHouses, departures: line.losses.departures, harvestLost: line.losses.harvestLost } });
  }
  return drafts;
}

/** HL-2 ③: milestones reached (checked on the ladder's samples). */
function milestoneDrafts(after: GameState, reached: ReadonlySet<string>): { readonly drafts: Draft[]; readonly ids: string[] } {
  const drafts: Draft[] = [];
  const ids: string[] = [];
  const add = (id: string, template: string, params?: Readonly<Record<string, number | string>>) => {
    if (reached.has(id)) return;
    ids.push(id);
    drafts.push({ tick: after.tick, kind: "milestone", template, ...(params === undefined ? {} : { params }), subject: TOWN, severity: 1 });
  };
  for (const kind of MILESTONE_BUILDINGS) if (after.buildings.some(building => building.kind === kind)) add(`building:${kind}`, "milestone.first_building", { building: kind });
  if (after.era !== "hamlet") add("market_town", "milestone.market_town");
  if (after.era === "stone_town") add("stone_town", "milestone.stone_town");
  if (after.houses.some(house => house.level === 4)) add("first_l4", "milestone.first_l4");
  const lots = housingLotCount(after);
  for (const threshold of LOT_MILESTONES) if (lots >= threshold) add(`lots:${threshold}`, "milestone.lots", { lots: threshold });
  return { drafts, ids };
}

/** HL-2 ④: the season that closed this tick — its bundled decisions, its line with a thumbnail, its big changes. */
function seasonDrafts(after: GameState, history: HistoryState): { readonly drafts: (Draft & { thumbnail?: { state: GameState; size: 128 | 256 } })[]; readonly closed: boolean } {
  const ledgers = after.seasons?.history ?? [];
  const last = ledgers.at(-1);
  if (last === undefined || last.endTick !== after.tick) return { drafts: [], closed: false };
  const drafts: (Draft & { thumbnail?: { state: GameState; size: 128 | 256 } })[] = [];
  for (const kind of DECISION_KINDS) {
    const count = history.seasonDecisions[kind] ?? 0;
    if (count > 0) drafts.push({ tick: after.tick, kind: "decision", template: "decision.bundle", params: { decisionKind: kind, count }, subject: TOWN, severity: 0 });
  }
  const net = last.income - last.expense;
  drafts.push({ tick: after.tick, kind: "ledger", template: "ledger.season", params: { population: after.population, popDelta: last.popDelta, net,
    income: last.income, expense: last.expense, season: last.season, year: last.year }, subject: TOWN, severity: 0, thumbnail: { state: after, size: 128 } });
  const startPopulation = after.population - last.popDelta;
  const percent = startPopulation <= 0 ? 0 : Math.round(last.popDelta * 100 / startPopulation);
  if (Math.abs(percent) >= 5) drafts.push({ tick: after.tick, kind: "ledger", template: "ledger.population", params: { percent }, subject: TOWN, severity: 1 });
  const previous = ledgers.at(-2);
  if (previous !== undefined && Math.sign(previous.income - previous.expense) !== Math.sign(net) && net !== 0 && previous.income - previous.expense !== 0) {
    drafts.push({ tick: after.tick, kind: "ledger", template: "ledger.treasury_turn", params: { net }, subject: TOWN, severity: 1 });
  }
  const departures = last.notableEvents.reduce((sum, event) => sum + (event.kind === "households_abandoned" ? event.count : 0), 0);
  if (departures > 0) drafts.push({ tick: after.tick, kind: "ledger", template: "ledger.departures", params: { count: departures }, subject: TOWN, severity: 1 });
  return { drafts, closed: true };
}

/** One tick of the ledger: `before` is the state the tick started from. */
export function advanceHistory(before: GameState, after: GameState): GameState {
  let history = historyOf(after);
  const drafts: (Draft & { thumbnail?: { state: GameState; size: 128 | 256 } })[] = [];
  drafts.push(...eventDrafts(before, after));
  const beforeEras = before.historicalEras?.length ?? 0;
  for (const era of (after.historicalEras ?? []).slice(beforeEras)) {
    drafts.push({ tick: after.tick, kind: "era", template: "era.entered", params: { eraId: era.id, forced: era.forced ? 1 : 0 }, subject: TOWN, severity: 3,
      thumbnail: { state: after, size: 256 } });
  }
  for (const end of (after.politics?.chapterEnds ?? []).slice(before.politics?.chapterEnds.length ?? 0)) {
    drafts.push({ tick: after.tick, kind: "milestone", template: "milestone.chapter_end", params: { chapter: end.chapter }, subject: TOWN, severity: 3,
      thumbnail: { state: after, size: 256 } });
  }
  drafts.push(...personDrafts(before, after));
  let milestones = history.milestones;
  if (after.tick % PRESSURE_BALANCE.sampleTicks === 0) {
    const reached = milestoneDrafts(after, new Set(milestones));
    drafts.push(...reached.drafts);
    if (reached.ids.length > 0) milestones = [...milestones, ...reached.ids];
  }
  const season = seasonDrafts(after, history);
  drafts.push(...season.drafts);
  if (milestones !== history.milestones || season.closed) history = { ...history, milestones, ...(season.closed ? { seasonDecisions: {} } : {}) };
  history = fillActuals(append(history, drafts), after);
  return history === historyOf(after) ? after : { ...after, history };
}

/** HL-3: fills the due decisions' `actual` (the ledger's one later write). */
function fillActuals(history: HistoryState, state: GameState): HistoryState {
  if (history.pendingActuals.length === 0 || !history.pendingActuals.some(entry => state.tick >= entry.due)) return history;
  const due = new Set(history.pendingActuals.filter(entry => state.tick >= entry.due).map(entry => entry.id));
  const now = metrics(state);
  return {
    ...history,
    pendingActuals: history.pendingActuals.filter(entry => !due.has(entry.id)),
    records: history.records.map(record => !due.has(record.id) || record.decision === undefined ? record
      : { ...record, decision: { ...record.decision, actual: pick(now, BIG_KEYS[String(record.params?.decisionKind)] ?? Object.keys(record.decision.predicted)) } }),
  };
}

/** HL-7 `history.query`: records matching the filter, oldest first. */
export function historyQuery(state: Pick<GameState, "history">, query: HistoryQuery = {}): readonly HistoryRecord[] {
  const kinds = query.kinds === undefined ? null : new Set<HistoryKind>(query.kinds);
  const actors = query.actors === undefined ? null : new Set(query.actors.map(actor => `${actor.type}:${actor.id}`));
  const from = query.range?.from ?? -Infinity;
  const to = query.range?.to ?? Infinity;
  const least = query.severity ?? 0;
  return historyOf(state).records.filter(record => record.severity >= least && record.tick >= from && record.tick <= to
    && (kinds === null || kinds.has(record.kind))
    && (actors === null || actors.has(`${record.subject.type}:${record.subject.id}`) || (record.actors ?? []).some(actor => actors.has(`${actor.type}:${actor.id}`))));
}

/** HL-7 `history.snapshot`: a thumbnail's palette indices, or null. */
export function historySnapshot(state: Pick<GameState, "history">, id: string): { readonly size: number; readonly tick: number; readonly pixels: Uint8Array } | null {
  const snapshot = historyOf(state).snapshots.find(entry => entry.id === id);
  return snapshot === undefined ? null : { size: snapshot.size, tick: snapshot.tick, pixels: decodeSnapshot(snapshot) };
}

/** HL-1: the record's sentence, rebuilt from its template and parameters. */
export function historySummary(record: Pick<HistoryRecord, "template" | "params">): string {
  const template = HISTORY_TEMPLATES[record.template];
  return template === undefined ? record.template : template(record.params ?? {});
}

/** HL-1: the record's calendar date (year, season, day). */
export function historyDate(record: Pick<HistoryRecord, "tick">, state: Pick<GameState, "scenarioId">) {
  return calendar(record.tick, scenarioOf(state).startYear);
}

/** HL-7: the API in one place (`history.query(state, …)`, `history.snapshot(state, id)`). */
export const history = { query: historyQuery, snapshot: historySnapshot, summary: historySummary, date: historyDate } as const;

/** HL-6: the decisions a chapter page quotes, weightiest first. */
const QUOTE_WEIGHT: Readonly<Record<string, number>> = { famine_response: 0, petition_response: 1, market_town: 2, stone_town: 3, rebuild: 4 };

/** HL-6: a chapter's page from the ledger — its top `limit` event and era records, and its quoted decisions. */
export function chapterPageRecords(state: Pick<GameState, "history">, fromTick: number, toTick: number, limit = 8) {
  const records = historyQuery(state, { kinds: ["event", "era"], severity: 2, range: { from: fromTick, to: toTick } });
  const events = [...records].sort((a, b) => b.severity - a.severity || a.tick - b.tick).slice(0, limit).sort((a, b) => a.tick - b.tick);
  const decisions = historyQuery(state, { kinds: ["decision"], severity: 1, range: { from: fromTick, to: toTick } })
    .filter(record => record.decision !== undefined)
    .sort((a, b) => (QUOTE_WEIGHT[String(a.params?.decisionKind)] ?? 9) - (QUOTE_WEIGHT[String(b.params?.decisionKind)] ?? 9) || a.tick - b.tick)
    .slice(0, CHAPTER_ONE.quotedDecisions);
  return { events, decisions };
}
