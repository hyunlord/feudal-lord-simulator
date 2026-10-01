/**
 * F0-C2 history ledger v0 (spec docs/design/history-ledger.md HL-1…HL-10). Append-only: records are only added; the
 * later writes are a decision's `actual` (HL-3) and the folding of old everyday records (HL-10). Nothing here changes
 * the simulation — the ledger reads the state before and after each tick and each player command.
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
 * - HL-10 (HIST-1): at each season's close, everyday records eight seasons old fold into one summary per season, and
 *   128² thumbnails that old are kept only at a year's end (winter's close). Everything else stays for good.
 */
import { WITNESS_RELATION_LOSS } from "../content/diplomacyConfig";
import { estatesOf } from "./estates";
import { PETITION_DEFS, type FamineResponseChoice, type PetitionResponse } from "../content/chapterConfig";
import { GREAT_FAMINE_EVENT_ID } from "../content/eventConfig";
import { HISTORY_TEMPLATES } from "../content/historyCopy.ko";
import { historyParams, namesPerson, type PersonReader } from "./historyNames";

export { historyParams } from "./historyNames";
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
import { reliefCostForecast, reliefCostPosted } from "./famineRelief";
import { speculationSaleForecast, speculationSalePosted } from "./famineSale";
import { housingLotCount } from "../population/housing";
import type { SourceRef } from "../contracts";
import type { Person, PersonConditionKind } from "./persons.types";
import { lordshipOf } from "./lordshipState";
import { beaconLit, raidEventId, warDecisionForecast } from "./war";
import { plagueDecisionForecast } from "./plague";
import { reorganisationDecisionForecast } from "./reorganisation";
import { heirRelationWord, legacyDecisionForecast, legacyEnding, legacyOf, legacyWord } from "./legacy";
import { LEGACY_BALANCE, LEGACY_PETITION_IDS, LEGACY_STEP_ART, BOROUGH_AUTONOMY_PETITION_ID, HEIR_CHOICE_PETITION_ID, HEIR_BY_RESPONSE } from "../content/legacyConfig";
import { currentYear, manorLord } from "./persons";
import { REORGANISATION_PETITION_IDS } from "../content/reorganisationConfig";
import { PLAGUE_PETITION_IDS } from "../content/plagueConfig";
import { applyFactionRecords, factionChanges, factionOfPetitioner } from "./factions";
import { finishedDrainage } from "./drainage";
import { WAR_PETITION_IDS } from "../content/warConfig";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const TOWN: ActorRef = { type: "town", id: "town" };
/** HL-3: `actual` is read this long after the decision. */
export const ACTUAL_AFTER_TICKS = 2 * SEASON;

/** HL-2 ①: the decision kinds (twelve, and WALL-2's wall expansion) and the commands behind them. */
export const DECISION_KINDS = ["build", "road", "zone", "house", "cancel", "operation", "wall_priority",
  "rebuild", "market_town", "stone_town", "famine_response", "petition_response", "wall_expand", "drainage",
  // LM-E1 (TA-6): the lord's conditions in lord mode.
  "estate_policy", "project_subsidy", "market_dues",
  // LM-E2 (ES-7): the lord's suit commands (the suit's own course is in the ledger as `estate.*` events).
  "lawsuit",
  // LM-E3 (NG-7): the marriage — the offer, the answer to a counter, a promise kept, the will-change answer.
  "marriage"] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];
/** HL-3: the big five, one record each with alternatives, a prediction and (later) the actual. */
export const BIG_DECISION_KINDS: readonly DecisionKind[] = ["market_town", "stone_town", "famine_response", "petition_response", "rebuild", "wall_expand", "drainage",
  "estate_policy", "project_subsidy", "market_dues"];

export const DECISION_KIND_BY_COMMAND: Readonly<Record<string, DecisionKind>> = {
  place_building: "build", place_road_line: "road", remove_road: "road",
  zone_paint: "zone", zone_erase: "zone", zone_remove: "zone", zone_undo_stroke: "zone",
  demolish_house: "house", merge_houses: "house", cancel_construction: "cancel", set_building_operation: "operation",
  set_wall_construction_priority: "wall_priority", rebuild_house: "rebuild", set_farmstead_crop: "operation",
  confirm_palisade_proclamation: "market_town", confirm_stone_town_proclamation: "stone_town",
  famine_response: "famine_response", petition_response: "petition_response", expand_palisade: "wall_expand",
  // ARCH-1b (MA-11): the fen's drainage works.
  drain_fen: "drainage", order_timber: "operation",
  // LM-E1 (TA-6): each condition the lord sets is a decision with a ledger id; the town's receipts point at it.
  set_estate_policy: "estate_policy", set_project_subsidy: "project_subsidy", set_market_dues: "market_dues",
  file_suit: "lawsuit", add_suit_evidence: "lawsuit", seek_suit_patron: "lawsuit", enforce_possession: "lawsuit",
  propose_marriage: "marriage", answer_counter: "marriage", keep_promise: "marriage", answer_will_change: "marriage",
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

/** FC-1: the Great Famine's record, if it arrived. */
function famineOf(state: Pick<GameState, "events">) {
  return state.events?.records.find(record => record.defId === GREAT_FAMINE_EVENT_ID);
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
  // LM-E1 (TA-6): the lord's conditions — what was set and what it replaced; the treasury is the prediction's metric.
  if (kind === "estate_policy") {
    const chosen = String(command.policy);
    return { chosen, alternatives: ["growth", "revenue", "stability", "defence"].filter(policy => policy !== chosen), predicted: pick(now, ["treasury"]), actualDueTick: due };
  }
  if (kind === "project_subsidy") {
    return { chosen: `${String(command.kind)}:${Number(command.amount)}`, alternatives: [`${String(command.kind)}:0`], predicted: pick(now, ["treasury"]), actualDueTick: due };
  }
  if (kind === "market_dues") {
    return { chosen: String(command.permille), alternatives: [String(before.agency?.duesPermille ?? 1000)], predicted: pick(now, ["treasury"]), actualDueTick: due };
  }
  if (kind === "famine_response") {
    const chosen = String(command.choice) as FamineResponseChoice;
    const poor = famineShortHouses(before, true).length;
    const perHousehold = before.houses.filter(house => house.residents > 0).length === 0 ? 0
      : Math.round(before.population / before.houses.filter(house => house.residents > 0).length);
    const leaving = chosen === "laissez_faire" ? Math.min(poor, 2) : chosen === "speculation" ? Math.min(poor, 3) : 0;
    // FC-2a: relief costs the bread it hands out in its seasons to the due tick, at the market price (bought or released);
    // FC-2b: speculation earns the grain it sells in them (a quarter of each granary a season) × the market price.
    const famine = famineOf(before);
    const treasury = famine === undefined ? 0 : chosen === "relief" ? -reliefCostForecast(before, famine, due)
      : chosen === "speculation" ? speculationSaleForecast(before, famine, due) : 0;
    return { chosen, alternatives: (["relief", "price_control", "laissez_faire", "speculation"] as const).filter(option => option !== chosen),
      predicted: { population: now.population! - leaving * perHousehold, treasury: now.treasury! + treasury }, actualDueTick: due };
  }
  if (kind === "petition_response") {
    const chosen = String(command.response) as PetitionResponse;
    // FAIL-3 (FL-6): the petition's own terms (a restoration costs the treasury its fee).
    const defId = before.politics?.petitions.find(petition => petition.id === command.petitionId)?.defId;
    const def = PETITION_DEFS.find(entry => entry.id === defId) ?? PETITION_DEFS[0]!;
    const outcome = def.outcomes[chosen];
    // F2-A (WR-2…WR-8): a war decision's sums follow the town (the war's own forecast).
    const treasury = def.trigger === "war" ? warDecisionForecast(before, def.id, chosen)
      // F3-A (PL-5…PL-8): so does a plague decision's.
      : def.trigger === "plague" ? plagueDecisionForecast(before, def.id, chosen)
      // F4-A (RG-12): and a reorganisation decision's.
      : def.trigger === "reorganisation" ? reorganisationDecisionForecast(before, def.id, chosen)
      // F5-A (LG-12): and a chapter-5 decision's.
      : def.trigger === "legacy" ? legacyDecisionForecast(before, def.id, chosen) : now.treasury! + outcome.charterFee;
    // F5-A (LG-3): the alternatives the petition itself offered.
    const offered = before.politics?.petitions.find(petition => petition.id === command.petitionId)?.options ?? def.responses;
    return { chosen, alternatives: (offered ?? (["accept", "accept_with_price", "refuse"] as const)).filter(option => option !== chosen),
      predicted: { treasury, merchantGauge: Math.max(0, Math.min(100, now.merchantGauge! + outcome.gauge)) }, actualDueTick: due };
  }
  if (kind === "stone_town") {
    return { chosen: "proclaim", alternatives: ["wait"], predicted: { treasury: now.treasury! - MONEY_BALANCE.stoneWallProjectCost, lots: now.lots! }, actualDueTick: due };
  }
  if (kind === "wall_expand") {
    return { chosen: "expand", alternatives: ["keep"], predicted: pick(metrics(after), ["population", "lots"]), actualDueTick: due };
  }
  if (kind === "market_town") {
    return { chosen: "proclaim", alternatives: ["wait"], predicted: pick(metrics(after), ["population", "lots"]), actualDueTick: due };
  }
  if (kind === "drainage") {
    // ARCH-1b (MA-11): the mere drained or left; the treasury keeps its coin (the works cost timber and men).
    return { chosen: "drain", alternatives: ["leave"], predicted: pick(now, ["population", "treasury"]), actualDueTick: due };
  }
  return { chosen: "rebuild", alternatives: ["leave"], predicted: pick(now, ["population"]), actualDueTick: due };
}

const BIG_KEYS: Readonly<Record<string, readonly string[]>> = {
  famine_response: ["population", "treasury"], petition_response: ["treasury", "merchantGauge"],
  stone_town: ["treasury", "lots"], market_town: ["population", "lots"], rebuild: ["population"], wall_expand: ["population", "lots"],
  drainage: ["population", "treasury"],
  estate_policy: ["treasury"], project_subsidy: ["treasury"], market_dues: ["treasury"],
};

/** HL-2 ①: records the player's (or the bot's) command, if it changed the state. Called by `gameReducer`. */
export function recordDecision(before: GameState, reduced: GameState, command: { readonly type: string } & Readonly<Record<string, unknown>>): GameState {
  const kind = DECISION_KIND_BY_COMMAND[command.type];
  if (kind === undefined || reduced === before) return reduced;
  // LM-E2 (ES-7): a suit command's effect (a suit filed, evidence, a patron, an enforcement) is in the ledger as well.
  const lines = kind === "lawsuit" ? estateDrafts(before, reduced) : kind === "marriage" ? [...diplomacyDrafts(before, reduced), ...estateDrafts(before, reduced)] : [];
  const after = lines.length === 0 ? reduced : { ...reduced, history: append(historyOf(reduced), lines) };
  // LM-E1b (TA-6 ②): a subsidy refused is no decision; the ledger keeps its reason as an event.
  const refusal = after.agency?.lastRefusal;
  if (command.type === "set_project_subsidy" && refusal !== undefined && refusal !== before.agency?.lastRefusal) {
    return { ...after, history: append(historyOf(after), [{ tick: after.tick, kind: "event", template: "agency.subsidy_refused", subject: TOWN,
      severity: 1, params: { reason: refusal.reason, kind: refusal.kind, amount: refusal.amount, total: refusal.total, limit: refusal.limit } }]) };
  }
  const history = historyOf(after);
  if (!BIG_DECISION_KINDS.includes(kind)) {
    return { ...after, history: { ...history, seasonDecisions: { ...history.seasonDecisions, [kind]: (history.seasonDecisions[kind] ?? 0) + 1 } } };
  }
  const decision = bigDecision(before, after, kind, command);
  const params: Record<string, string | number> = { decisionKind: kind, chosen: decision.chosen };
  // FC-2a, FC-2b: the relief's or speculation's actual is its posted cost or sale on the treasury at the decision (`fillActuals`).
  const famine = kind === "famine_response" && (decision.chosen === "relief" || decision.chosen === "speculation") ? famineOf(before) : undefined;
  if (famine !== undefined) Object.assign(params, { eventId: famine.id, treasuryAtDecision: before.treasuryCoin });
  // F2-A: which petition was answered (the war's five read their own sentence).
  if (kind === "petition_response") {
    const defId = before.politics?.petitions.find(petition => petition.id === command.petitionId)?.defId;
    if (defId !== undefined) params.defId = defId;
    // Item 8: heir choice — add the candidate's relation word so the sentence and chronicle can use it
    if (defId === HEIR_CHOICE_PETITION_ID) {
      const candidateKind = HEIR_BY_RESPONSE[decision.chosen as PetitionResponse];
      const candidate = legacyOf(after)?.candidates.find(c => c.kind === candidateKind);
      if (candidate !== undefined) params.relation = heirRelationWord(candidate);
    }
  }
  // LM-E1 (TA-6): a subsidy's decision names its kind and sum (the receipts find it by its kind).
  if (kind === "project_subsidy") Object.assign(params, { kind: String(command.kind), amount: Number(command.amount) });
  const place = kind === "rebuild" ? after.buildings.find(entry => entry.id === command.buildingId) : undefined;
  // FACTION-0 (FX-3): a petition's decision names its faction.
  const petitioner = kind === "petition_response" ? before.politics?.petitions.find(petition => petition.id === command.petitionId)?.petitioner : undefined;
  // FAIL-3 (FL-6): a restoration answered by the command ends the decline there, so its record comes with the decision.
  return withFactionRecords(after, history, append(history, [{ tick: after.tick, kind: "decision", template: `decision.${kind}`, params, subject: TOWN,
    ...(petitioner === undefined ? {} : { actors: [{ type: "faction" as const, id: factionOfPetitioner(petitioner) }] }),
    ...(place === undefined ? {} : { place: { tx: place.tx, ty: place.ty, buildingId: place.id } }), decision, severity: 1 }, ...lordshipDrafts(before, after),
    // F5-A (LG-2…LG-5): what a chapter-5 answer did at once (the heir seated, the Crown paid, the charter sealed).
    // FIX-9: and a chapter-4 answer's (the guild founded).
    ...reorganisationDrafts(before, after), ...legacyDrafts(before, after), ...factionDrafts(before, after)]));
}

/** FACTION-0 (FX-4): a faction's relation moved — one record each, the faction's memory. */
function factionDrafts(before: GameState, after: GameState): Draft[] {
  return factionChanges(before, after).map(change => {
    const faction = after.factions?.factions.find(entry => entry.id === change.factionId);
    const relation = faction?.relation ?? 0;
    return { tick: after.tick, kind: "faction" as const, template: "faction.relation", subject: { type: "faction" as const, id: change.factionId },
      params: { faction: change.factionId, name: faction?.name ?? change.factionId, delta: change.delta, reason: change.reason,
        relation: Math.max(-100, Math.min(100, relation + change.delta)) }, severity: 1 as const };
  });
}

/**
 * FIX-12 (item 3, QA-036): a town faction's leader who died is followed — one line naming both by id (the predecessor
 * among the dead, the next living head of the group).
 */
function leaderDrafts(before: GameState, after: GameState): Draft[] {
  if (before.factions === undefined || after.factions === undefined || before.factions === after.factions) return [];
  const past = new Set((after.persons?.past ?? []).filter(person => !person.alive).map(person => person.id));
  return after.factions.factions.flatMap(faction => {
    const was = before.factions!.factions.find(entry => entry.id === faction.id)?.leaderId ?? null;
    if (was === null || faction.leaderId === null || was === faction.leaderId || !past.has(was)) return [];
    return [{ tick: after.tick, kind: "faction" as const, template: "faction.leader_succeeded", subject: { type: "faction" as const, id: faction.id },
      params: { faction: faction.id, name: faction.name, predecessorId: was, leaderId: faction.leaderId }, severity: 1 as const }];
  });
}

/**
 * FIX-12 (item 3, QA-036): an open petition's representative who died is replaced by the next living head (persons) —
 * one line naming both by id.
 */
function petitionerDrafts(before: GameState, after: GameState): Draft[] {
  const was = before.politics?.petitions, now = after.politics?.petitions;
  if (was === undefined || now === undefined || was === now) return [];
  return now.flatMap(petition => {
    const old = was.find(entry => entry.id === petition.id)?.petitionerIds;
    if (old === undefined || petition.petitionerIds === undefined) return [];
    return old.flatMap((id, index) => {
      const next = petition.petitionerIds![index];
      if (next === undefined || next === id) return [];
      const died = (after.persons?.past ?? []).some(person => person.id === id && !person.alive);
      return [{ tick: after.tick, kind: "person" as const, template: "petition.representative_replaced",
        subject: { type: "person" as const, id: next }, params: { defId: petition.defId, predecessorId: id, leaderId: next, gone: died ? "died" : "left" }, severity: 0 as const }];
    });
  });
}

/** FACTION-0 (FX-4): the history with its new records, and the factions moved by the new `faction.relation` records. */
function withFactionRecords(after: GameState, before: HistoryState, history: HistoryState): GameState {
  const added = history.records.slice(before.records.length);
  const factions = after.factions === undefined ? undefined : applyFactionRecords(after.factions, added);
  return { ...after, history, ...(factions === undefined || factions === after.factions ? {} : { factions }) };
}

function eventCause(eventId: string, defId: string): SourceRef {
  return { type: "event", id: eventId, detail: defId };
}

/**
 * HL-2 ⑤: a household's life between two states. PERSON-0 (PS-8): with persons, a household's record is the
 * head's (subject the head, the household an actor), and each person's own life is recorded from the persons that
 * appear, go or change — born, married (a household formed), a relative arrived, came of age, took a trade, chosen
 * reeve, a new steward, died (with the cause), left the town.
 */
function personDrafts(before: GameState, after: GameState): Draft[] {
  const previous = new Map(before.houses.map(house => [house.buildingId, house]));
  // SMOOTH-2E: the buildings' and the heads' lookups (and a record's base) are made only when a record is written —
  // most ticks write none, and these were rebuilt for every house each tick.
  let buildings: Map<string, GameState["buildings"][number]> | null = null;
  let heads: Map<string, string> | null = null;
  const headOf = (householdId: string) => {
    if (heads === null) {
      heads = new Map();
      for (const person of before.persons?.people ?? []) if (person.role === "head") heads.set(person.householdId, person.id);
      for (const person of after.persons?.people ?? []) if (person.role === "head") heads.set(person.householdId, person.id);
    }
    return heads.get(householdId);
  };
  const drafts: Draft[] = [];
  const placeOf = (householdId: string) => {
    buildings ??= new Map(after.buildings.map(building => [building.id, building]));
    const building = buildings.get(householdId);
    return building === undefined ? {} : { place: { tx: building.tx, ty: building.ty, buildingId: building.id } };
  };
  for (const house of after.houses) {
    const old = previous.get(house.buildingId);
    if (old === undefined) continue;
    const baseOf = () => {
      const household = { type: "household" as const, id: house.buildingId };
      const head = headOf(house.buildingId);
      return { tick: after.tick, kind: "person" as const, ...placeOf(house.buildingId),
        ...(head === undefined ? { subject: household } : { subject: { type: "person" as const, id: head }, actors: [household] }) };
    };
    const push = (template: string, severity: HistorySeverity, extra: Partial<Draft> = {}) => drafts.push({ ...baseOf(), template, severity, ...extra });
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
    // Without persons (a town before save v16's first tick) the household's size is its own line.
    if (after.persons === undefined) {
      if (old.residents > 0 && house.residents > old.residents) push("person.grew", 0, { params: { residents: house.residents } });
      if (house.residents > 0 && house.residents < old.residents) push("person.shrank", 0, { params: { residents: house.residents } });
    }
  }
  if (before.persons === undefined || after.persons === undefined || before.persons === after.persons) return drafts;
  const year = calendar(after.tick, scenarioOf(after).startYear).year;
  const beforeYear = calendar(before.tick, scenarioOf(before).startYear).year;
  const was = new Map(before.persons.people.map(person => [person.id, person]));
  const now = new Map(after.persons.people.map(person => [person.id, person]));
  const personRecord = (person: Person, template: string, severity: HistorySeverity, params?: Readonly<Record<string, number | string>>) => drafts.push({
    tick: after.tick, kind: "person", template, severity, subject: { type: "person", id: person.id },
    ...(person.householdId === "manor" ? {} : { actors: [{ type: "household", id: person.householdId }] }), ...placeOf(person.householdId),
    ...(params === undefined ? {} : { params }) });
  for (const person of after.persons.people) {
    const old = was.get(person.id);
    if (old === undefined) {
      // PERSON-1a (LN-4): the birth names the parents and where the child's name came from.
      if (person.role === "child" && person.birthYear === year) personRecord(person, "person.born", 0, {
        ...(person.motherId === undefined ? {} : { motherId: person.motherId }), ...(person.fatherId === undefined ? {} : { fatherId: person.fatherId }),
        nameFrom: person.nameFrom ?? "common", ...(person.godparentId === undefined ? {} : { godparentId: person.godparentId }) });
      else if (person.role === "spouse") personRecord(person, "person.married", 0);
      else if (person.role === "kin") personRecord(person, "person.arrived", 0);
      else if (person.role === "steward") personRecord(person, "person.steward", 1);
      continue;
    }
    if (year - person.birthYear >= 14 && beforeYear - old.birthYear < 14) personRecord(person, "person.came_of_age", 0);
    if (old.occupation !== person.occupation && old.occupation !== "child" && person.occupation !== "labourer") personRecord(person, "person.occupation", 0, { occupation: person.occupation });
    if (!old.tags.includes("reeve") && person.tags.includes("reeve")) personRecord(person, "person.reeve", 1);
    // PERSON-1a (LN-10): the passing states and the bailiff's office.
    if (!old.tags.includes("bailiff") && person.tags.includes("bailiff")) personRecord(person, "person.bailiff", 1);
    if (person.condition !== undefined && old.condition?.kind !== person.condition.kind) {
      personRecord(person, CONDITION_BEGINS[person.condition.kind], person.condition.kind === "pilgrim" ? 1 : 0);
    } else if (person.condition === undefined && old.condition !== undefined && old.condition.kind !== "pregnant") {
      personRecord(person, CONDITION_ENDS[old.condition.kind], 0);
    }
  }
  const gone = after.persons.past.slice(before.persons.past.length);
  for (const person of gone) {
    if (!was.has(person.id) || now.has(person.id)) continue;
    if (!person.alive) personRecord(person, "person.died", 1, { cause: person.deathCause ?? "age", age: (person.deathYear ?? year) - person.birthYear });
    else personRecord(person, "person.left_town", 0);
  }
  return drafts;
}

/** LN-10: the ledger's line when a passing state begins, and when it ends (a pregnancy ends with the birth's own line). */
const CONDITION_BEGINS: Readonly<Record<PersonConditionKind, string>> = { sick: "person.fell_ill", injury: "person.injured", pregnant: "person.expecting", pilgrim: "person.pilgrimage" };
const CONDITION_ENDS: Readonly<Record<Exclude<PersonConditionKind, "pregnant">, string>> = { sick: "person.recovered", injury: "person.healed", pilgrim: "person.returned" };

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

/** HL-10: everyday records and 128² thumbnails are thinned once they are this many seasons old. */
export const FOLD_AFTER_SEASONS = 8;
/** HL-10: the season summary that replaces a season's folded everyday records. */
export const ROLLUP_TEMPLATE = "ledger.rollup";
/** HL-10: everyday records that are never folded (a household moving into a house, a household forming). */
const PERMANENT_EVERYDAY: ReadonlySet<string> = new Set(["person.move_in", "person.resettled", "person.married"]);
const YEAR = 4 * SEASON;

/** HL-10: a record folded into its season's summary once old enough — everyday (severity 0), not kept for good. */
export function foldableRecord(record: HistoryRecord): boolean {
  return record.severity === 0 && record.decision === undefined && record.template !== ROLLUP_TEMPLATE && !PERMANENT_EVERYDAY.has(record.template);
}

/** HL-10: a thumbnail kept once old: an era's or chapter's (256²), or a year's end (winter's close). */
function keptOldSnapshot(snapshot: { readonly size: number; readonly tick: number }): boolean {
  return snapshot.size === 256 || snapshot.tick % YEAR === 0;
}

/**
 * HL-10: folds the everyday records at least `FOLD_AFTER_SEASONS` seasons old into one summary per season (the season
 * ending at the next multiple of the season length): `count`, a count per template, commands per everyday decision
 * kind (`decision.build`), and the season's line
 * (population, change, treasury) and its thumbnail if kept. The summary takes the first folded record's id and place,
 * so ids stay in order. Old 128² thumbnails are kept only at a year's end. The originals are dropped.
 */
export function compactHistory(history: HistoryState, tick: number): HistoryState {
  const cutoff = tick - FOLD_AFTER_SEASONS * SEASON;
  const dropsSnapshot = (snapshot: HistoryState["snapshots"][number]) => snapshot.tick <= cutoff && !keptOldSnapshot(snapshot);
  const folds = history.records.some(record => record.tick <= cutoff && foldableRecord(record));
  if (!folds && !history.snapshots.some(dropsSnapshot)) return history;
  const snapshots = history.snapshots.filter(snapshot => !dropsSnapshot(snapshot));
  const kept = new Set(snapshots.map(snapshot => snapshot.id));
  const records: HistoryRecord[] = [];
  const summaries = new Map<number, { index: number; params: Record<string, number | string>; snapshotId?: string }>();
  const windowOf = (at: number) => Math.ceil(at / SEASON);
  for (const record of history.records) {
    if (record.template === ROLLUP_TEMPLATE) {
      summaries.set(windowOf(record.tick), { index: records.length, params: { ...record.params },
        ...(record.snapshotId === undefined ? {} : { snapshotId: record.snapshotId }) });
      records.push(record);
      continue;
    }
    if (record.tick > cutoff || !foldableRecord(record)) { records.push(record); continue; }
    const window = windowOf(record.tick);
    let summary = summaries.get(window);
    if (summary === undefined) {
      summary = { index: records.length, params: { count: 0 } };
      summaries.set(window, summary);
      records.push({ id: record.id, tick: window * SEASON, kind: "ledger", template: ROLLUP_TEMPLATE, subject: TOWN, severity: 0 });
    }
    summary.params.count = Number(summary.params.count ?? 0) + 1;
    summary.params[record.template] = Number(summary.params[record.template] ?? 0) + 1;
    // An everyday decision line keeps its command count by kind (`decision.build`: commands that season).
    if (record.template === "decision.bundle") {
      const key = `decision.${String(record.params?.decisionKind)}`;
      summary.params[key] = Number(summary.params[key] ?? 0) + Number(record.params?.count ?? 0);
    }
    if (record.template === "ledger.season") {
      for (const key of ["population", "popDelta", "net", "season", "year"] as const) if (record.params?.[key] !== undefined) summary.params[key] = record.params[key]!;
      if (record.snapshotId !== undefined && kept.has(record.snapshotId)) summary.snapshotId = record.snapshotId;
    }
  }
  for (const summary of summaries.values()) {
    const base = records[summary.index]!;
    records[summary.index] = { ...base, params: summary.params, ...(summary.snapshotId === undefined ? {} : { snapshotId: summary.snapshotId }) };
  }
  return { ...history, records, snapshots };
}

/**
 * FAIL-3 (FL-5, FL-7, FL-8): the lordship's turns — a decline begun (a right lost, the title demoted) or ended, a house
 * withdrawn and the new one, and a new chapter begun.
 */
function lordshipDrafts(before: GameState, after: GameState): Draft[] {
  const drafts: Draft[] = [];
  const was = lordshipOf(before), now = lordshipOf(after);
  if (now.house.order > was.house.order) {
    drafts.push({ tick: after.tick, kind: "milestone", template: "house.withdrew", params: { name: was.house.name, order: was.house.order }, subject: TOWN, severity: 3 });
    drafts.push({ tick: after.tick, kind: "milestone", template: "house.arrived", params: { name: now.house.name, order: now.house.order }, subject: TOWN, severity: 2 });
    // FIX-5 (FL-14): an emptied town's new house brings settlers.
    if (before.population <= 0 && after.population > 0) {
      drafts.push({ tick: after.tick, kind: "milestone", template: "house.resettled", params: { name: now.house.name, settlers: after.population }, subject: TOWN, severity: 3 });
    }
  } else if (now.decline !== null && was.decline === null) {
    drafts.push({ tick: after.tick, kind: "milestone", template: "decline.entered",
      params: { cause: now.decline.cause, right: now.decline.lost ?? "none", by: now.decline.by }, subject: TOWN, severity: 3 });
  } else if (now.decline === null && was.decline !== null) {
    drafts.push({ tick: after.tick, kind: "milestone", template: "decline.recovered", params: { right: was.decline.lost ?? "none" }, subject: TOWN, severity: 2 });
  }
  const chapter = after.politics?.chapter.number ?? 1;
  if (chapter > (before.politics?.chapter.number ?? 1)) {
    drafts.push({ tick: after.tick, kind: "milestone", template: "milestone.chapter_start", params: { chapter }, subject: TOWN, severity: 2 });
  }
  // FIX-11 (FX11-1): wardship begin and end — the ward is the lord the rule reads (`manorLord`), before or after.
  const lordOf = (state: GameState) => manorLord(state.persons?.people ?? [], lordshipOf(state).house.order, currentYear(state));
  if (was.wardship === undefined && now.wardship !== undefined) {
    const lord = lordOf(after);
    const guardianId = now.wardship.guardianId;
    const guardian = guardianId === null ? undefined : after.persons?.people.find(person => person.id === guardianId);
    drafts.push({ tick: after.tick, kind: "milestone", template: "lord.wardship_begun",
      params: { lordId: lord?.id ?? "", guardianId: guardian?.id ?? "" },
      subject: TOWN, severity: 2 });
  } else if (was.wardship !== undefined && now.wardship === undefined) {
    const lord = lordOf(after) ?? lordOf(before);
    drafts.push({ tick: after.tick, kind: "milestone", template: "lord.wardship_ended",
      params: { lordId: lord?.id ?? "" },
      subject: TOWN, severity: 2 });
  }
  return drafts;
}

/**
 * F2-A (WR-1…WR-7): the war's turns — the messenger, the beacon, the raid (what it took), the men gone and home, a
 * royal demand left unanswered, the Crown's favour lost, the purveyance licence.
 */
function warDrafts(before: GameState, after: GameState): (Draft & { thumbnail?: { state: GameState; size: 128 | 256 } })[] {
  const was = before.war, now = after.war;
  if (now === undefined || was === now) return [];
  const drafts: (Draft & { thumbnail?: { state: GameState; size: 128 | 256 } })[] = [];
  // FACTION-0 (FX-3): the war's records name the faction behind them — the Crown's demands and grants, the town's raid.
  const by = (id: string) => ({ actors: [{ type: "faction" as const, id }] });
  const at = { tick: after.tick, subject: TOWN, ...by("crown") };
  if (was === undefined) drafts.push({ ...at, kind: "event", template: "war.messenger", severity: 2 });
  if (beaconLit(after) && !beaconLit(before)) drafts.push({ ...at, ...by("town"), kind: "event", template: "war.beacon", severity: 2 });
  if (now.raid !== undefined && was?.raid === undefined) {
    drafts.push({ ...at, ...by("town"), kind: "event", template: "war.raid", severity: 3, params: { burntHouses: now.raid.losses.burntHouses, looted: now.raid.losses.looted,
      coin: now.raid.losses.coin, defence: now.raid.defencePermille }, cause: { type: "event", id: raidEventId(now.raid.tick), detail: "coastal_raid" },
      thumbnail: { state: after, size: 256 } });
  }
  if (now.conscripts !== undefined && was?.conscripts === undefined) drafts.push({ ...at, kind: "event", template: "war.conscripts_left", severity: 2, params: { men: now.conscripts.men } });
  if (now.conscripts?.returned === true && was?.conscripts?.returned === false) {
    drafts.push({ ...at, kind: "event", template: "war.conscripts_returned", severity: 2, params: { men: now.conscripts.men, lost: now.conscripts.lostHouseIds.length } });
  }
  if (was !== undefined && was.favour && !now.favour) drafts.push({ ...at, kind: "event", template: "war.favour_lost", severity: 2 });
  if (now.licenceSeasonsLeft !== undefined && was?.licenceSeasonsLeft === undefined) drafts.push({ ...at, kind: "event", template: "war.licence", severity: 2 });
  for (const [defId, answer] of Object.entries(now.answers)) {
    if (answer === "expired" && was?.answers[defId] !== "expired" && (WAR_PETITION_IDS as readonly string[]).includes(defId)) {
      const petitioner = after.politics?.petitions.find(petition => petition.defId === defId)?.petitioner;
      drafts.push({ ...at, ...(petitioner === undefined ? {} : by(factionOfPetitioner(petitioner))), kind: "event", template: "war.unanswered", severity: 2, params: { defId } });
    }
  }
  return drafts;
}

/**
 * F3-A (PL-1…PL-10): the pestilence's turns — the harbour fever's rumour, the first dead and the priest, the new graves,
 * the empty streets and the abandoned fields, the Statute, the resettlement, the second pestilence, the priest's seat
 * filled, a petition left unanswered. The dead themselves are the persons' `person.died` (cause `plague`).
 */
function plagueDrafts(before: GameState, after: GameState): (Draft & { thumbnail?: { state: GameState; size: 128 | 256 } })[] {
  const was = before.plague, now = after.plague;
  if (now === undefined || was === now) return [];
  const drafts: (Draft & { thumbnail?: { state: GameState; size: 128 | 256 } })[] = [];
  const by = (id: string) => ({ actors: [{ type: "faction" as const, id }] });
  const at = { tick: after.tick, subject: TOWN, ...by("bishop") };
  const cause = { type: "event" as const, id: `black_death@${now.eraTick}`, detail: "black_death" };
  if (now.rumourTick !== undefined && was?.rumourTick === undefined) drafts.push({ ...at, kind: "event", template: "plague.rumour", severity: 2, cause });
  if (now.first !== undefined && was?.first === undefined) drafts.push({ ...at, kind: "event", template: "plague.arrived", severity: 3, cause });
  if (now.curacy !== undefined && was?.curacy === undefined) drafts.push({ ...at, kind: "event", template: "plague.priest_died", severity: 2, cause });
  if (now.curacy?.filledTick !== undefined && after.tick >= now.curacy.filledTick && (was?.curacy?.filledTick === undefined || before.tick < was.curacy.filledTick)) {
    drafts.push({ ...at, kind: "event", template: "plague.priest_filled", severity: 1, params: { by: now.curacy.by ?? "clerk" } });
  }
  const first = now.first, old = was?.first;
  if (first !== undefined && old !== undefined && old.dead === 0 && first.dead > 0) {
    drafts.push({ ...at, ...by("town"), kind: "event", template: "plague.new_graves", severity: 2, params: { dead: first.dead }, cause, thumbnail: { state: after, size: 128 } });
  }
  if (first !== undefined && (was?.vacantHouseIds.length ?? 0) === 0 && now.vacantHouseIds.length > 0) {
    drafts.push({ ...at, ...by("town"), kind: "event", template: "plague.empty_streets", severity: 2, params: { houses: now.vacantHouseIds.length }, cause });
  }
  if (first?.endTick !== undefined && old?.endTick === undefined) {
    drafts.push({ ...at, ...by("town"), kind: "event", template: "plague.abandoned_fields", severity: 3,
      params: { dead: first.dead, manorDead: first.manorDead, population: first.populationAtArrival, permille: first.populationAtArrival === 0 ? 0 : Math.round(first.dead * 1000 / first.populationAtArrival),
        houses: now.vacantHouseIds.length }, cause, thumbnail: { state: after, size: 256 } });
  }
  if (now.ordinanceTick !== undefined && was?.ordinanceTick === undefined) {
    drafts.push({ ...at, ...by("crown"), kind: "event", template: "plague.ordinance", severity: 2, params: { fine: now.statuteFine ?? 0 } });
  }
  if (now.resettled > 0 && (was?.resettled ?? 0) === 0) drafts.push({ ...at, ...by("town"), kind: "event", template: "plague.resettlement", severity: 2, params: { households: now.resettled } });
  if (now.second !== undefined && was?.second === undefined) drafts.push({ ...at, kind: "event", template: "plague.second", severity: 3, cause });
  if (now.second?.endTick !== undefined && was?.second?.endTick === undefined) {
    drafts.push({ ...at, kind: "event", template: "plague.second_ended", severity: 2, params: { dead: now.second.dead } });
  }
  for (const [defId, answer] of Object.entries(now.answers)) {
    if (answer === "expired" && was?.answers[defId] !== "expired" && (PLAGUE_PETITION_IDS as readonly string[]).includes(defId)) {
      const petitioner = after.politics?.petitions.find(petition => petition.defId === defId)?.petitioner;
      drafts.push({ ...at, ...(petitioner === undefined ? {} : by(factionOfPetitioner(petitioner))), kind: "event", template: "plague.unanswered", severity: 2, params: { defId } });
    }
  }
  return drafts;
}

/**
 * F4-A (RG-1…RG-10): the reorganisation's turns — the neighbours' wages, the textile street, the alehouses, the
 * petitions, the guild founded (or its weavers gone), the earl's warning, the poll tax, the rumour of 1381, the town's
 * demand, the charter, a petition left unanswered.
 */
function reorganisationDrafts(before: GameState, after: GameState): (Draft & { thumbnail?: { state: GameState; size: 128 | 256 } })[] {
  const was = before.reorganisation, now = after.reorganisation;
  if (now === undefined || was === now) return [];
  const drafts: (Draft & { thumbnail?: { state: GameState; size: 128 | 256 } })[] = [];
  const by = (id: string) => ({ actors: [{ type: "faction" as const, id }] });
  const at = { tick: after.tick, subject: TOWN, ...by("town") };
  const cause = { type: "event" as const, id: `reorganisation@${now.startTick}`, detail: "reorganisation" };
  const came = (key: "wageCompetitionTick" | "textileStreetTick" | "alehouseBoomTick" | "surgeTick" | "warningTick" | "autonomyTick") => now[key] !== undefined && was?.[key] === undefined;
  if (came("wageCompetitionTick")) drafts.push({ ...at, ...by("neighbour_1"), kind: "event", template: "reorg.wage_competition", severity: 2, cause });
  if (came("textileStreetTick")) drafts.push({ ...at, kind: "event", template: "reorg.textile_street", severity: 2, cause, thumbnail: { state: after, size: 128 } });
  if (came("alehouseBoomTick")) drafts.push({ ...at, kind: "event", template: "reorg.alehouse_boom", severity: 1, cause });
  if (came("surgeTick")) drafts.push({ ...at, ...by("merchant_house_1"), kind: "event", template: "reorg.petitions_surge", severity: 2, cause });
  if (now.guild !== undefined && was?.guild === undefined) drafts.push({ ...at, kind: "event", template: "reorg.guild_founded", severity: 3, cause, thumbnail: { state: after, size: 128 } });
  if (now.weaverLeavers > (was?.weaverLeavers ?? 0)) drafts.push({ ...at, kind: "event", template: "reorg.weavers_left", severity: 2, params: { households: now.weaverLeavers }, cause });
  if (came("warningTick")) drafts.push({ ...at, ...by("overlord"), kind: "event", template: "reorg.overlord_warning", severity: 3, params: { influence: now.influence.town ?? 0 }, cause });
  if (now.collections > (was?.collections ?? 0)) drafts.push({ ...at, ...by("crown"), kind: "event", template: "reorg.poll_tax", severity: 1, params: { amount: now.pollTax - (was?.pollTax ?? 0) }, cause });
  if (now.rebellion !== undefined && was?.rebellion === undefined) {
    drafts.push({ ...at, ...by("commons"), kind: "event", template: "reorg.rebellion_rumour", severity: 3, params: { outcome: now.rebellion.outcome, pressure: now.rebellion.pressure }, cause,
      thumbnail: { state: after, size: 256 } });
  }
  if (came("autonomyTick")) drafts.push({ ...at, kind: "event", template: "reorg.autonomy_request", severity: 3, cause });
  if (now.chapterFiveStart !== undefined && was?.chapterFiveStart === undefined) {
    drafts.push({ ...at, kind: "event", template: "reorg.charter", severity: 3, params: { charter: now.chapterFiveStart.charter }, cause, thumbnail: { state: after, size: 256 } });
  }
  for (const [defId, answer] of Object.entries(now.answers)) {
    if (answer === "expired" && was?.answers[defId] !== "expired" && (REORGANISATION_PETITION_IDS as readonly string[]).includes(defId)) {
      const petitioner = after.politics?.petitions.find(petition => petition.defId === defId)?.petitioner;
      drafts.push({ ...at, ...(petitioner === undefined ? {} : by(factionOfPetitioner(petitioner))), kind: "event", template: "reorg.unanswered", severity: 2, params: { defId } });
    }
  }
  return drafts;
}

/**
 * F5-A (LG-1…LG-8): chapter 5's turns — each step (with its Wave 21 picture), the Crown paid, the heir seated, the
 * charter sealed or refused, the family gone or staying, the legacy sealed, the last market day, a petition left.
 */
function legacyDrafts(before: GameState, after: GameState): (Draft & { thumbnail?: { state: GameState; size: 128 | 256 } })[] {
  const was = before.legacy, now = after.legacy;
  if (now === undefined || was === now) return [];
  const drafts: (Draft & { thumbnail?: { state: GameState; size: 128 | 256 } })[] = [];
  const by = (id: string) => ({ actors: [{ type: "faction" as const, id }] });
  const at = { tick: after.tick, subject: TOWN, ...by("town") };
  const cause = { type: "event" as const, id: `legacy@${now.startTick}`, detail: "legacy" };
  const came = (step: keyof typeof LEGACY_STEP_ART) => now.steps[step] !== undefined && was?.steps[step] === undefined;
  const art = (step: keyof typeof LEGACY_STEP_ART) => ({ illustration: LEGACY_STEP_ART[step] });
  const house = lordshipOf(after).house.name;
  if (came("mayor_demand")) drafts.push({ ...at, ...by("merchant_house_1"), ...art("mayor_demand"), kind: "event", template: "legacy.mayor_demand", severity: 2, params: { candidateId: now.mayorCandidateId ?? "" }, cause });
  if (came("royal_tax_envoy")) drafts.push({ ...at, ...by("crown"), ...art("royal_tax_envoy"), kind: "event", template: "legacy.royal_tax_envoy", severity: 2, cause });
  if (came("succession")) {
    const lord = manorLord(after.persons?.people ?? [], lordshipOf(after).house.order, calendar(after.tick, scenarioOf(after).startYear).year);
    drafts.push({ ...at, ...by("overlord"), ...art("succession"), kind: "event", template: "legacy.succession", severity: 3, cause,
      params: { lordId: lord?.id ?? "", age: lord === undefined ? 0 : calendar(after.tick, scenarioOf(after).startYear).year - lord.birthYear, candidates: now.candidates.length } });
  }
  if (now.royalSubsidy > (was?.royalSubsidy ?? 0)) drafts.push({ ...at, ...by("crown"), kind: "event", template: "legacy.royal_subsidy", severity: 1, params: { amount: now.royalSubsidy - (was?.royalSubsidy ?? 0) }, cause });
  if (now.heir !== undefined && was?.heir === undefined) {
    const candidate = now.candidates.find(entry => entry.personId === now.heir!.personId);
    drafts.push({ tick: after.tick, subject: { type: "person", id: now.heir.personId }, actors: [{ type: "faction", id: "overlord" }], kind: "event", template: "legacy.heir_seated", severity: 3,
      params: { heirId: now.heir.personId, relation: candidate === undefined ? "" : heirRelationWord(candidate) }, illustration: "ch5_chronicle_heir", cause });
  }
  if (came("city_seal")) drafts.push({ ...at, ...art("city_seal"), kind: "event", template: "legacy.city_seal", severity: 2, cause, thumbnail: { state: after, size: 128 } });
  const charter = now.answers[BOROUGH_AUTONOMY_PETITION_ID];
  if (charter !== undefined && was?.answers[BOROUGH_AUTONOMY_PETITION_ID] === undefined) {
    drafts.push(charter === "accept"
      ? { ...at, ...art("charter_sealing"), kind: "event", template: "legacy.charter_sealed", severity: 3, params: { mayorId: now.mayorId ?? "" }, cause, thumbnail: { state: after, size: 256 } }
      : { ...at, kind: "event", template: "legacy.charter_refused", severity: 3, params: { backlash: now.backlash }, cause, thumbnail: { state: after, size: 256 } });
  }
  if (came("family_departure")) {
    drafts.push({ ...at, ...(now.family === "departed" ? art("family_departure") : {}), kind: "event", template: now.family === "departed" ? "legacy.family_departed" : "legacy.family_stayed",
      severity: 3, params: { house }, cause });
  }
  // FIX-9 (LG-13): the interlude's events, the nave rebuilt.
  for (const [id, tick] of Object.entries(now.interludes ?? {})) {
    if (was?.interludes?.[id as keyof typeof now.interludes] !== undefined || tick !== after.tick) continue;
    const actor = id === "staple" || id === "deposition" ? "crown" : id === "church_rebuilding" ? "bishop" : id === "guild_dispute" ? "merchant_house_1" : "town";
    drafts.push({ ...at, ...by(actor), kind: "event", template: `legacy.${id}`, severity: id === "deposition" ? 3 : 2, cause,
      ...(id === "market_fire" ? { params: { cost: LEGACY_BALANCE.marketFireRepair } } : {}) });
  }
  if (now.naveRebuilt === true && was?.naveRebuilt !== true) drafts.push({ ...at, ...by("bishop"), kind: "event", template: "legacy.nave_rebuilt", severity: 2, cause, thumbnail: { state: after, size: 128 } });
  if (came("legacy_record")) drafts.push({ ...at, ...art("legacy_record"), kind: "event", template: "legacy.legacy_record", severity: 3, params: { legacy: legacyWord(now.legacy) }, cause });
  if (came("last_market")) {
    drafts.push({ ...at, ...art("last_market"), kind: "event", template: "legacy.last_market", severity: 3, params: { ending: legacyEnding(after)?.title ?? "" }, cause,
      thumbnail: { state: after, size: 256 } });
  }
  for (const [defId, answer] of Object.entries(now.answers)) {
    if (answer === "expired" && was?.answers[defId] !== "expired" && (LEGACY_PETITION_IDS as readonly string[]).includes(defId)) {
      const petitioner = after.politics?.petitions.find(petition => petition.defId === defId)?.petitioner;
      drafts.push({ ...at, ...(petitioner === undefined ? {} : by(factionOfPetitioner(petitioner))), kind: "event", template: "legacy.unanswered", severity: 2, params: { defId } });
    }
  }
  return drafts;
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
  drafts.push(...lordshipDrafts(before, after));
  drafts.push(...warDrafts(before, after));
  drafts.push(...plagueDrafts(before, after));
  drafts.push(...reorganisationDrafts(before, after));
  drafts.push(...legacyDrafts(before, after));
  drafts.push(...factionDrafts(before, after));
  drafts.push(...leaderDrafts(before, after), ...petitionerDrafts(before, after));
  drafts.push(...personDrafts(before, after));
  // LM-E1 (TA-5): each project the town started this tick, with its receipt.
  drafts.push(...agencyDrafts(before, after));
  // LM-E2 (ES-5…ES-7): the estates' claims, suits, titles and possessions that changed this tick.
  drafts.push(...estateDrafts(before, after));
  // LM-E3 (NG-5…NG-8): offers, counters, promises and the marriage's stages that changed this tick.
  drafts.push(...diplomacyDrafts(before, after));
  // ARCH-1b (MA-11): a drainage works finished — its cells are meadow now.
  for (const work of finishedDrainage(before, after)) {
    const cell = work.cells[0]!;
    drafts.push({ tick: after.tick, kind: "event", template: "drainage.done", params: { cells: work.cells.length, timber: work.timber },
      subject: TOWN, place: { tx: cell % after.width, ty: Math.floor(cell / after.width) }, severity: 2 });
  }
  let milestones = history.milestones;
  if (after.tick % PRESSURE_BALANCE.sampleTicks === 0) {
    const reached = milestoneDrafts(after, new Set(milestones));
    drafts.push(...reached.drafts);
    if (reached.ids.length > 0) milestones = [...milestones, ...reached.ids];
  }
  const season = seasonDrafts(after, history);
  drafts.push(...season.drafts);
  if (milestones !== history.milestones || season.closed) history = { ...history, milestones, ...(season.closed ? { seasonDecisions: {} } : {}) };
  const appended = append(history, drafts);
  // FACTION-0 (FX-4): the factions remember by the records just written.
  const added = appended.records.slice(history.records.length);
  const factions = after.factions === undefined || added.length === 0 ? after.factions : applyFactionRecords(after.factions, added);
  history = fillActuals(appended, after);
  if (season.closed) history = compactHistory(history, after.tick);
  if (history === historyOf(after) && factions === after.factions) return after;
  return { ...after, history, ...(factions === undefined || factions === after.factions ? {} : { factions }) };
}

/**
 * HL-3: fills the due decisions' `actual` (the ledger's one later write). FC-2a: a relief's treasury is the treasury at
 * the decision less the relief's posted cost to the due tick (cash bought and granary bread released, at the market price);
 * FC-2b: a speculation's is the treasury at the decision plus its posted sales.
 */
function fillActuals(history: HistoryState, state: GameState): HistoryState {
  if (history.pendingActuals.length === 0 || !history.pendingActuals.some(entry => state.tick >= entry.due)) return history;
  const due = new Set(history.pendingActuals.filter(entry => state.tick >= entry.due).map(entry => entry.id));
  const now = metrics(state);
  const actual = (record: HistoryRecord, decision: HistoryDecision): Record<string, number> => {
    const values = pick(now, BIG_KEYS[String(record.params?.decisionKind)] ?? Object.keys(decision.predicted));
    const eventId = record.params?.eventId;
    const treasury = record.params?.treasuryAtDecision;
    if (typeof eventId !== "string" || typeof treasury !== "number" || decision.actualDueTick === undefined) return values;
    return { ...values, treasury: record.params?.chosen === "speculation"
      ? treasury + speculationSalePosted(state.ledger, eventId, record.tick, decision.actualDueTick)
      : treasury - reliefCostPosted(state.ledger, eventId, record.tick, decision.actualDueTick) };
  };
  return {
    ...history,
    pendingActuals: history.pendingActuals.filter(entry => !due.has(entry.id)),
    records: history.records.map(record => !due.has(record.id) || record.decision === undefined ? record
      : { ...record, decision: { ...record.decision, actual: actual(record, record.decision) } }),
  };
}

/** HL-7 `history.query`: records matching the filter, oldest first. */
export function historyQuery(state: Pick<GameState, "history"> & PersonReader, query: HistoryQuery = {}): readonly HistoryRecord[] {
  const kinds = query.kinds === undefined ? null : new Set<HistoryKind>(query.kinds);
  const actors = query.actors === undefined ? null : new Set(query.actors.map(actor => `${actor.type}:${actor.id}`));
  const from = query.range?.from ?? -Infinity;
  const to = query.range?.to ?? Infinity;
  const least = query.severity ?? 0;
  const found = historyOf(state).records.filter(record => record.severity >= least && record.tick >= from && record.tick <= to
    && (kinds === null || kinds.has(record.kind))
    && (actors === null || actors.has(`${record.subject.type}:${record.subject.id}`) || (record.actors ?? []).some(actor => actors.has(`${actor.type}:${actor.id}`))));
  // FIX-12 (item 4, HL-1a): a record that names a person by id comes back with the person's name now (the summary reads it).
  return state.persons === undefined ? found : found.map(record => namesPerson(record) ? { ...record, params: historyParams(record, state) } : record);
}

/** HL-7 `history.snapshot`: a thumbnail's palette indices, or null. */
export function historySnapshot(state: Pick<GameState, "history">, id: string): { readonly size: number; readonly tick: number; readonly pixels: Uint8Array } | null {
  const snapshot = historyOf(state).snapshots.find(entry => entry.id === id);
  return snapshot === undefined ? null : { size: snapshot.size, tick: snapshot.tick, pixels: decodeSnapshot(snapshot) };
}

/** HL-1: the record's sentence, rebuilt from its template and parameters (FIX-12: its persons named from `state` when given). */
export function historySummary(record: Pick<HistoryRecord, "template" | "params">, state?: PersonReader): string {
  const template = HISTORY_TEMPLATES[record.template];
  return template === undefined ? record.template : template(historyParams(record, state));
}

/** HL-1: the record's calendar date (year, season, day). */
export function historyDate(record: Pick<HistoryRecord, "tick">, state: Pick<GameState, "scenarioId">) {
  return calendar(record.tick, scenarioOf(state).startYear);
}

/** HL-7: the API in one place (`history.query(state, …)`, `history.snapshot(state, id)`). */
export const history = { query: historyQuery, snapshot: historySnapshot, summary: historySummary, date: historyDate } as const;

/** HL-6: the decisions a chapter page quotes, weightiest first. */
const QUOTE_WEIGHT: Readonly<Record<string, number>> = { famine_response: 0, petition_response: 1, market_town: 2, stone_town: 3, wall_expand: 4, rebuild: 5 };

/** HL-6: a chapter's page from the ledger — its top `limit` event and era records, and its quoted decisions. */
export function chapterPageRecords(state: Pick<GameState, "history">, fromTick: number, toTick: number, limit = 8) {
  const records = historyQuery(state, { kinds: ["event", "era"], severity: 2, range: { from: fromTick, to: toTick } });
  const events = [...records].sort((a, b) => b.severity - a.severity || a.tick - b.tick).slice(0, limit).sort((a, b) => a.tick - b.tick);
  // FIX-11 (FX11-8): every decision of the chapter (no three-quote limit). The caller starts a later chapter's range one
  // tick after the previous chapter's end, whose records are that chapter's.
  const decisions = historyQuery(state, { kinds: ["decision"], severity: 1, range: { from: fromTick, to: toTick } })
    .filter(record => record.decision !== undefined)
    .sort((a, b) => (QUOTE_WEIGHT[String(a.params?.decisionKind)] ?? 9) - (QUOTE_WEIGHT[String(b.params?.decisionKind)] ?? 9) || a.tick - b.tick);
  return { events, decisions };
}

/**
 * LM-E3 (NG-5…NG-8): what changed in the diplomacy — an offer made (accepted, countered or refused), a counter taken or
 * let go, a promise made, kept or broken (a broken one also moves each witness faction's relation, its memory), and
 * each of the marriage's middle events.
 */
function diplomacyDrafts(before: GameState, after: GameState): Draft[] {
  if (after.diplomacy === before.diplomacy || after.diplomacy === undefined) return [];
  const was = before.diplomacy;
  const now = after.diplomacy;
  const drafts: Draft[] = [];
  const line = (template: string, params: Record<string, string | number>, severity: 1 | 2 | 3 = 2) =>
    drafts.push({ tick: after.tick, kind: "event", template, subject: TOWN, severity, params });
  for (const negotiation of now.negotiations) {
    const old = was?.negotiations.find(entry => entry.id === negotiation.id);
    if (old === undefined) {
      line("negotiation.offered", { negotiation: negotiation.id, counterpart: negotiation.counterpart, tier: negotiation.acceptance.tier, score: negotiation.acceptance.score });
      line(`negotiation.${negotiation.status === "countered" ? "countered" : negotiation.status === "accepted" ? "accepted" : "rejected"}`,
        { negotiation: negotiation.id, changes: (negotiation.counter?.changes ?? []).map(change => change.kind).join(",") });
    } else if (old.status !== negotiation.status) line(`negotiation.${negotiation.status === "accepted" ? "accepted" : "withdrawn"}`, { negotiation: negotiation.id, changes: "" });
  }
  for (const record of now.promises) {
    const old = was?.promises.find(entry => entry.id === record.id);
    if (old === undefined) line("promise.made", { promise: record.id, promisor: record.promisor, term: record.term, amount: record.amount ?? 0, deadline: record.deadline }, 1);
    if (old?.status === record.status || record.status === "open") continue;
    line(`promise.${record.status}`, { promise: record.id, promisor: record.promisor, term: record.term });
    if (record.status === "broken" && record.promisor === "lord") for (const witness of record.witnesses) {
      const faction = after.factions?.factions.find(entry => entry.id === witness);
      if (faction === undefined) continue;
      drafts.push({ tick: after.tick, kind: "faction", template: "faction.relation", subject: { type: "faction", id: witness }, severity: 1,
        params: { faction: witness, name: faction.name, delta: -WITNESS_RELATION_LOSS, reason: `promise_broken:${record.id}`,
          relation: Math.max(-100, Math.min(100, faction.relation - WITNESS_RELATION_LOSS)) } });
    }
  }
  const plan = now.marriage;
  if (plan !== undefined) {
    // FIX-12 (item 2): who the groom is to the lord (a son, the widowed lord, a brother, a nephew, a cousin).
    const groom = after.persons?.people.find(person => person.id === plan.groomId);
    const relation = groom?.tags.find(tag => tag.startsWith("lord-kin:"))?.slice("lord-kin:".length) ?? (groom?.role === "head" ? "widowed_lord" : "son");
    if (was?.marriage === undefined) line("marriage.contracted", { negotiation: plan.negotiationId, groom: plan.groomId, bride: plan.brideId, relation }, 3);
    for (const [event, tick] of Object.entries(plan.events)) {
      if (tick === undefined || tick < 0 || (was?.marriage?.events as Record<string, number | undefined> | undefined)?.[event] !== undefined) continue;
      line(`marriage.${event}`, { bride: plan.brideId, brotherInLaw: plan.brotherInLawId ?? "" }, event === "father_died" ? 3 : 2);
    }
    if (was?.marriage?.stage !== plan.stage && (plan.stage === "inherited" || plan.stage === "lost" || plan.stage === "contested")) {
      line(`marriage.${plan.stage}`, { estate: plan.estateId, rival: plan.rival ?? "" }, 3);
    }
  }
  return drafts;
}

/**
 * LM-E2 (ES-5…ES-7): what changed in the estates — a claim raised, a suit filed, a suit's stage, its judgment, an
 * enforcement, a piece's title or possessor. FAIL-3's own losses (suspended, seized) are the lordship's lines already.
 */
function estateDrafts(before: GameState, after: GameState): Draft[] {
  if (after.estates === before.estates || after.estates === undefined) return [];
  const was = estatesOf(before);
  const now = after.estates;
  const drafts: Draft[] = [];
  const line = (template: string, params: Record<string, string | number>) => drafts.push({ tick: after.tick, kind: "event", template, subject: TOWN, severity: 2, params });
  for (const claim of now.claims) if (!was.claims.some(entry => entry.id === claim.id)) {
    line("estate.claim_raised", { claim: claim.id, claimant: claim.claimant, estate: claim.estateId, piece: claim.pieceId ?? "", basis: claim.basis });
  }
  for (const suit of now.suits) {
    const old = was.suits.find(entry => entry.id === suit.id);
    if (old === undefined) { line("estate.suit_filed", { suit: suit.id, claim: suit.claimId, plaintiff: suit.plaintiff, defendant: suit.defendant, piece: suit.pieceId ?? "" }); continue; }
    if (old.stage !== suit.stage && suit.verdict !== undefined && old.verdict === undefined) line("estate.suit_judged", { suit: suit.id, verdict: suit.verdict, piece: suit.pieceId ?? "" });
    else if (old.stage !== suit.stage && suit.stage !== "closed") line("estate.suit_stage", { suit: suit.id, stage: suit.stage });
    if (suit.enforcements > old.enforcements) line("estate.possession_enforced", { suit: suit.id, attempt: suit.enforcements, succeeded: suit.enforced === true ? 1 : 0, piece: suit.pieceId ?? "" });
    if (suit.patron !== undefined && old.patron === undefined) line("estate.suit_patron", { suit: suit.id, patron: suit.patron, support: suit.patronSupport });
  }
  for (const estate of now.estates) {
    const old = was.estates.find(entry => entry.id === estate.id);
    // LM-E3 (NG-8): a whole estate changing hands is one line, not one for each of its pieces.
    if (old !== undefined && (old.titleHolder !== estate.titleHolder || old.possessor !== estate.possessor)) {
      if (old.titleHolder !== estate.titleHolder) line("estate.title_changed", { estate: estate.id, piece: "", from: old.titleHolder, to: estate.titleHolder });
      if (old.possessor !== estate.possessor) line("estate.possession_changed", { estate: estate.id, piece: "", from: old.possessor, to: estate.possessor });
      continue;
    }
    for (const piece of estate.pieces) {
      const prior = old?.pieces.find(entry => entry.id === piece.id);
      if (prior === undefined) continue;
      if (prior.titleHolder !== piece.titleHolder) line("estate.title_changed", { estate: estate.id, piece: piece.id, from: prior.titleHolder, to: piece.titleHolder });
      const lordship = piece.loss === "suspended" || piece.loss === "seized" || prior.loss === "suspended" || prior.loss === "seized";
      if (prior.possessor !== piece.possessor && !lordship) line("estate.possession_changed", { estate: estate.id, piece: piece.id, from: prior.possessor, to: piece.possessor });
    }
  }
  return drafts;
}

/** LM-E1 (TA-5): a project the town started — `agency.project_started`, its receipt's who, what, where and top reasons. */
function agencyDrafts(before: GameState, after: GameState): Draft[] {
  const receipts = after.agency?.receipts ?? [];
  const known = before.agency?.nextReceipt ?? 1;
  return receipts.filter(receipt => Number(receipt.id.slice("receipt-".length)) >= known).map(receipt => ({
    tick: after.tick, kind: "event" as const, template: "agency.project_started", subject: TOWN, severity: 1 as const,
    place: { tx: receipt.tx, ty: receipt.ty, ...(receipt.siteId === null ? {} : { buildingId: receipt.siteId }) },
    params: { receipt: receipt.id, actor: receipt.actor, what: receipt.what, planner: receipt.planner, score: receipt.score,
      reasons: receipt.reasons.map(reason => `${reason.name}:${reason.value}`).join(","), decisions: receipt.decisionIds.join(",") },
  }));
}
