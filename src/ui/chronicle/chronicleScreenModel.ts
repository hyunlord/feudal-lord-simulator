import { personOrnament, type PersonStateId } from "../persons/personStates";
import { PRESSURE_BALANCE } from "../../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../../content/buildingConfig";
import { HISTORY_CHOICE_LABELS, HISTORY_OCCUPATIONS } from "../../content/historyCopy.ko";
import type { GameState } from "../../engine/engine.types";
import { history } from "../../engine/history";
import type { HistoryKind, HistoryQuery, HistoryRecord, HistorySeverity } from "../../engine/history.types";
import { ageBandOf, ageOf, personById, personDisplayName, personsOf } from "../../engine/persons";
import { persons } from "../../engine/personsApi";
import type { Person } from "../../engine/persons.types";
import { MANOR_HOUSEHOLD } from "../../engine/persons.types";
import { portraitFor } from "../../engine/portraits";
import { calendar, scenarioOf } from "../../engine/scenarioState";
import { factionDisplayName } from "../../content/factionCopy.ko";
import type { FactionRecord } from "../../engine/faction.types";
import { lordHouseByOrder, lordHouseHeraldrySeed, lordshipOf } from "../../engine/lordshipState";
import { chronicleIllustration, legacyRecordArt, reorgRecordArt } from "../chronicleModel";
import type { EmblemSpec } from "../heraldry/EmblemImage";
import { armsRecipe, heraldryArms, heraldryMark, royalArms } from "../heraldry/heraldry";
import { PERSONS_COPY } from "../persons/personsCopy.ko";
import { lordChoiceLabel } from "../lord/policyModel";
import { isOutsider, personEmblem } from "../persons/personModels";
import { PERSON_TRAIT_COPY } from "../persons/personTraitCopy.ko";
import { resemblanceParts } from "../persons/resemblance";
import { drawnPortraitId } from "../portraitArt";
import type { Wave16ImageId } from "../wave16Art";
import type { Wave17ImageId } from "../wave17Art";
import type { Wave21ImageId } from "../wave21Art";
import { chapterIntro, type Wave31ImageId } from "../wave31Art";
import type { Wave33ImageId } from "../wave33Art";
import { wave40RecordArt, type Wave40ImageId } from "../wave40Art";
import { lordMode } from "../../engine/townAgency";
import { WAVE33_IMAGES } from "../wave33ArtManifest.generated";
import { CHRONICLE_SCREEN_COPY, OCCUPATION_TITLES } from "./chronicleScreenCopy.ko";
import { recordSentence } from "../legacy/chapterRecords";
import { WAVE17_IMAGES } from "../wave17ArtManifest.generated";
import { V4_COPY } from "../../content/registry/v4Copy.generated";
import { RESULTS_COPY } from "../results/resultsCopy.ko";
import { decisionBy, recordIndex } from "./historyIndex";

// CHRON-1 chronicle screen (CHRONICLE_DESIGN 2.1, 2.2, 2.4): the whole history ledger read on three axes — the town's
// timeline (a 1300→1450 strip of the scenario's eras, one Wave 19 segment each, markers for the weightiest record of
// each stretch, a season ruler when zoomed), its records as cards (newest first, filtered by kind, severity, years and
// person), the map as it was (`history.snapshot`), the lord's decisions (chosen, the other ways, predicted against
// actual) and a person's life (PERSON-0 `persons.biography`). Pure: the screen renders what these return.

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = 4 * SEASON;
/** CHRONICLE_DESIGN 2.1: the strip runs to the campaign's last year. */
export const CHRONICLE_END_YEAR = 1450;

/** UI-6: `faction` — a faction's relation moved (FACTION-0 FX-4 `faction.relation`), shown as the "관계" kind. */
export const CHRONICLE_KINDS = ["decision", "event", "era", "milestone", "person", "ledger", "faction"] as const satisfies readonly HistoryKind[];
export type ChronicleKind = (typeof CHRONICLE_KINDS)[number];
/** `factionId` (UI-6): only the records a faction is the subject or an actor of (a faction page's record link sets it). */
export type ChronicleFilter = Readonly<{ kinds: readonly ChronicleKind[]; severity: HistorySeverity; fromYear: number | null; toYear: number | null; personId: string | null;
  factionId?: string | null }>;
/** CHRONICLE_DESIGN 0.5: the screen opens on the weighty records; "모든 기록" shows the everyday ones too. */
export const DEFAULT_CHRONICLE_FILTER: ChronicleFilter = { kinds: CHRONICLE_KINDS, severity: 1, fromYear: null, toYear: null, personId: null, factionId: null };

export const yearOfTick = (state: Pick<GameState, "scenarioId">, tick: number) => calendar(tick, scenarioOf(state).startYear).year;
const tickOfYear = (state: Pick<GameState, "scenarioId">, year: number) => (year - scenarioOf(state).startYear) * YEAR;

export function chronicleDate(state: Pick<GameState, "scenarioId">, tick: number): string {
  const date = history.date({ tick }, state);
  return CHRONICLE_SCREEN_COPY.date(date.year, date.season);
}

// ---------------------------------------------------------------------------------------------------------------
// Rows: the filtered records, newest first; a season's everyday decision lines are one item.

export type ChronicleItem = Readonly<{ key: string; tick: number; record: HistoryRecord; bundle: readonly HistoryRecord[] | null }>;

export function chronicleQuery(state: Pick<GameState, "scenarioId">, filter: ChronicleFilter): HistoryQuery {
  const range = { ...(filter.fromYear === null ? {} : { from: tickOfYear(state, filter.fromYear) }),
    ...(filter.toYear === null ? {} : { to: tickOfYear(state, filter.toYear + 1) - 1 }) };
  const actors = [...(filter.personId === null ? [] : [{ type: "person" as const, id: filter.personId }]),
    ...(filter.factionId == null ? [] : [{ type: "faction" as const, id: filter.factionId }])];
  return { kinds: filter.kinds, severity: filter.severity, range, ...(actors.length === 0 ? {} : { actors }) };
}

/** CHRONICLE_DESIGN 2.4: frequent decisions (placement and the like) are one card a season — the engine's lines per kind, joined. */
export function chronicleItems(state: Pick<GameState, "history" | "scenarioId">, filter: ChronicleFilter): readonly ChronicleItem[] {
  const records = history.query(state, chronicleQuery(state, filter));
  const items: ChronicleItem[] = [];
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index]!;
    if (record.template === "decision.bundle") {
      const last = items.at(-1);
      if (last?.bundle !== null && last?.bundle !== undefined && last.tick === record.tick) {
        items[items.length - 1] = { ...last, bundle: [record, ...last.bundle] };
        continue;
      }
      items.push({ key: record.id, tick: record.tick, record, bundle: [record] });
      continue;
    }
    items.push({ key: record.id, tick: record.tick, record, bundle: null });
  }
  return items;
}

/** The first item (newest first) at or before `tick`: where the list scrolls when a time is picked. */
export function itemIndexAt(items: readonly ChronicleItem[], tick: number): number {
  let low = 0; let high = items.length;
  while (low < high) { const middle = (low + high) >> 1; if (items[middle]!.tick > tick) low = middle + 1; else high = middle; }
  return Math.min(low, Math.max(0, items.length - 1));
}

/** The people the ledger names, most recorded first (the person filter's choices). */
export function chroniclePeople(state: Pick<GameState, "history" | "persons">): readonly { readonly id: string; readonly name: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const record of state.history?.records ?? []) {
    if (record.subject.type === "person") counts.set(record.subject.id, (counts.get(record.subject.id) ?? 0) + 1);
    for (const actor of record.actors ?? []) if (actor.type === "person" && actor.id !== record.subject.id) counts.set(actor.id, (counts.get(actor.id) ?? 0) + 1);
  }
  const people: { id: string; name: string; count: number }[] = [];
  for (const [id, count] of counts) {
    const person = personById(state, id);
    if (person !== undefined) people.push({ id, name: personDisplayName(person), count });
  }
  return people.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function chronicleYears(state: Pick<GameState, "scenarioId" | "tick">): readonly number[] {
  const first = scenarioOf(state).startYear; const last = yearOfTick(state, state.tick);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

// ---------------------------------------------------------------------------------------------------------------
// Timeline: one strip segment per scenario era (entered: from its entry; ahead: from its year or now, whichever later).
// An era not entered yet is labelled with its nominal year (UI-KIT-1b: an overdue one read "now", e.g. 1469, before).

export type TimelineSegment = Readonly<{ eraId: string; label: string; from: number; to: number; fromYear: number; entered: boolean }>;
export type TimelineMarkerKind = "decision" | "era" | "event" | "milestone" | "person";
export const TIMELINE_MARKER_KINDS: readonly TimelineMarkerKind[] = ["decision", "era", "event", "milestone", "person"];
export type TimelineMarker = Readonly<{ kind: TimelineMarkerKind; x: number; tick: number; recordId: string }>;
export type TimelineChapter = Readonly<{ chapter: number; from: number; to: number; ended: boolean }>;

export function timelineSegments(state: Pick<GameState, "scenarioId" | "tick" | "historicalEras">): readonly TimelineSegment[] {
  const scenario = scenarioOf(state);
  const entered = new Map((state.historicalEras ?? []).map(entry => [entry.id, entry.enteredTick]));
  const end = Math.max(tickOfYear(state, CHRONICLE_END_YEAR), state.tick + SEASON);
  const starts: number[] = [];
  for (const [index, era] of scenario.eras.entries()) {
    const nominal = tickOfYear(state, era.enterWhen.yearAtLeast ?? scenario.startYear);
    const previous = starts[index - 1] ?? 0;
    const at = entered.get(era.id) ?? Math.max(nominal, index === 0 ? 0 : state.tick + 1);
    starts.push(Math.max(previous + 1, at));
  }
  return scenario.eras.map((era, index) => {
    const isEntered = index === 0 || entered.has(era.id);
    return { eraId: era.id, label: era.name, from: index === 0 ? 0 : starts[index]!, to: starts[index + 1] ?? end,
      fromYear: isEntered ? yearOfTick(state, index === 0 ? 0 : starts[index]!) : era.enterWhen.yearAtLeast ?? scenario.startYear, entered: isEntered };
  });
}

/** Where a tick falls along the band (0–1): each segment an equal share, linear in time inside it. */
export function timelineX(segments: readonly TimelineSegment[], tick: number): number {
  const count = segments.length;
  for (const [index, segment] of segments.entries()) {
    if (tick < segment.to || index === count - 1) return (index + Math.min(1, Math.max(0, (tick - segment.from) / (segment.to - segment.from)))) / count;
  }
  return 1;
}

/** The tick at a place along the band (the inverse of `timelineX`). */
export function timelineTickAt(segments: readonly TimelineSegment[], x: number): number {
  const count = segments.length;
  const scaled = Math.min(count - 1e-9, Math.max(0, x * count));
  const segment = segments[Math.floor(scaled)]!;
  return Math.round(segment.from + (scaled - Math.floor(scaled)) * (segment.to - segment.from));
}

const markerKind = (record: HistoryRecord): TimelineMarkerKind | null =>
  record.kind === "ledger" || record.kind === "faction" ? null : record.kind;

/** On equal weight a stretch shows the town's story before one life: era, event, decision, milestone, person. */
const MARKER_RANK: Readonly<Record<TimelineMarkerKind, number>> = { era: 4, event: 3, decision: 2, milestone: 1, person: 0 };

/** One marker per stretch of the band (`bins`): the weightiest record there (then by kind, then the later). */
export function timelineMarkers(records: readonly HistoryRecord[], segments: readonly TimelineSegment[], bins = 48): readonly TimelineMarker[] {
  const best = new Map<number, HistoryRecord>();
  const rank = (record: HistoryRecord) => record.severity * 10 + MARKER_RANK[markerKind(record)!];
  for (const record of records) {
    if (markerKind(record) === null) continue;
    const bin = Math.min(bins - 1, Math.floor(timelineX(segments, record.tick) * bins));
    const held = best.get(bin);
    if (held === undefined || rank(record) > rank(held) || (rank(record) === rank(held) && record.tick >= held.tick)) best.set(bin, record);
  }
  return [...best.values()].sort((a, b) => a.tick - b.tick)
    .map(record => ({ kind: markerKind(record)!, x: timelineX(segments, record.tick), tick: record.tick, recordId: record.id }));
}

export function timelineChapters(state: Pick<GameState, "politics" | "tick">): readonly TimelineChapter[] {
  const ends = state.politics?.chapterEnds ?? [];
  const chapters: TimelineChapter[] = ends.map((end, index) => ({ chapter: end.chapter, from: index === 0 ? 0 : ends[index - 1]!.tick, to: end.tick, ended: true }));
  const current = state.politics?.chapter;
  if (current !== undefined && !ends.some(end => end.chapter === current.number)) chapters.push({ chapter: current.number, from: current.startTick, to: state.tick, ended: false });
  return chapters;
}

export type SeasonCell = Readonly<{ index: number; from: number; to: number; label: string; season: 0 | 1 | 2 | 3; year: number; count: number; kinds: readonly TimelineMarkerKind[] }>;
export const SEASON_WINDOW = 16;

/** The zoomed ruler: `SEASON_WINDOW` seasons around `tick` (never past now), each with how many of the rows fall in it. */
export function seasonWindow(state: Pick<GameState, "scenarioId" | "tick">, items: readonly ChronicleItem[], tick: number): readonly SeasonCell[] {
  const last = Math.floor(state.tick / SEASON);
  const first = Math.max(0, Math.min(last - SEASON_WINDOW + 1, Math.floor(tick / SEASON) - SEASON_WINDOW / 2));
  const cells: SeasonCell[] = [];
  for (let index = first; index < first + SEASON_WINDOW && index <= last; index += 1) {
    const from = index * SEASON; const to = from + SEASON - 1;
    const date = history.date({ tick: from }, state);
    const start = itemIndexAt(items, to);
    const kinds = new Set<TimelineMarkerKind>(); let count = 0;
    for (let at = start; at < items.length && items[at]!.tick >= from; at += 1) {
      if (items[at]!.tick > to) continue;
      count += 1; const kind = markerKind(items[at]!.record); if (kind !== null) kinds.add(kind);
    }
    cells.push({ index, from, to, label: CHRONICLE_SCREEN_COPY.date(date.year, date.season), season: date.season, year: date.year, count,
      kinds: TIMELINE_MARKER_KINDS.filter(kind => kinds.has(kind)) });
  }
  return cells;
}

// ---------------------------------------------------------------------------------------------------------------
// The map then (HL-5): the record's own thumbnail, else the season's close that follows it, else the last before it.

export type SnapshotRef = Readonly<{ id: string; tick: number; size: number }>;

export function snapshotFor(state: Pick<GameState, "history">, tick: number, own?: string): SnapshotRef | null {
  const snapshots = state.history?.snapshots ?? [];
  if (own !== undefined) { const found = snapshots.find(snapshot => snapshot.id === own); if (found !== undefined) return { id: found.id, tick: found.tick, size: found.size }; }
  let low = 0; let high = snapshots.length;
  while (low < high) { const middle = (low + high) >> 1; if (snapshots[middle]!.tick < tick) low = middle + 1; else high = middle; }
  const after = snapshots[low];
  if (after !== undefined && after.tick - tick <= SEASON) return { id: after.id, tick: after.tick, size: after.size };
  const before = snapshots[low - 1];
  return before === undefined ? (after === undefined ? null : { id: after.id, tick: after.tick, size: after.size }) : { id: before.id, tick: before.tick, size: before.size };
}

// ---------------------------------------------------------------------------------------------------------------
// Record cards.

export type RecordFrameId = "frame_record_decision" | "frame_record_era" | "frame_record_event" | "frame_record_ledger" | "frame_record_milestone" | "frame_record_person";
export type ChronicleArt = Readonly<{ kind: "wave16"; id: Wave16ImageId }> | Readonly<{ kind: "wave17"; id: Wave17ImageId }>
  | Readonly<{ kind: "wave21"; id: Wave21ImageId }>
  | Readonly<{ kind: "wave31"; id: Wave31ImageId }>
  | Readonly<{ kind: "wave33"; id: Wave33ImageId }>
  | Readonly<{ kind: "wave40"; id: Wave40ImageId }>
  | Readonly<{ kind: "portrait"; portraitId: string }> | Readonly<{ kind: "emblem"; emblem: EmblemSpec }> | null;
export type RecordCard = Readonly<{
  id: string; kind: HistoryKind; frame: RecordFrameId; date: string; sentence: string; numbers: string | null; art: ChronicleArt;
  place: Readonly<{ tx: number; ty: number }> | null; snapshot: SnapshotRef | null; personId: string | null; personName: string | null;
  /** UI-6: the faction the record is about or names ([세력] opens its page), with its display name. */
  factionId: string | null; factionName: string | null;
  decision: boolean; folded: boolean;
}>;

/** The household lines (HL-2 ③): written on the head of the house, about the house ("…의 집 — 가구가 …"). */
const HOUSEHOLD_TEMPLATES: ReadonlySet<string> = new Set(["person.move_in", "person.level_up", "person.level_down", "person.leaving", "person.left",
  "person.resettled", "person.burnt", "person.rebuilt", "person.emptied", "person.stayed", "person.hungry", "person.fed", "person.water", "person.water_lost"]);

const FRAMES: Readonly<Record<HistoryKind, RecordFrameId>> = {
  decision: "frame_record_decision", event: "frame_record_event", era: "frame_record_era", milestone: "frame_record_milestone",
  person: "frame_record_person", ledger: "frame_record_ledger", faction: "frame_record_event",
};

/** The person a record is about (its subject, else a person among its actors). */
function recordPerson(state: Pick<GameState, "persons">, record: HistoryRecord): Person | undefined {
  if (record.subject.type === "person") return personById(state, record.subject.id);
  const actor = record.actors?.find(entry => entry.type === "person");
  return actor === undefined ? undefined : personById(state, actor.id);
}

/** The person's picture as they were in `year` (the aging chain's stage of that age). */
export function portraitAt(person: Person, year: number) {
  const age = ageOf(person, Math.min(year, person.deathYear ?? person.leftYear ?? year));
  const pick = portraitFor(person, ageBandOf(age), age);
  return { ...pick, portraitId: drawnPortraitId(person, pick.portraitId) };
}

// ---------------------------------------------------------------------------------------------------------------
// UI-6: factions on the cards (FACTION-0). Arms and marks from the faction's heraldry seed (`heraldryArms`, one key for
// every screen); the lord's houses keep the manor's key (FAIL-3: the first house's arms are the ones drawn before).

/**
 * The merchant houses bear a merchant's mark; the rest arms — both from the faction's seed (FX-1). UI-6b: the Crown bears
 * the king's arms of `year` (England, quartered with France from 1340), not a seed's.
 */
export const factionEmblem = (faction: Pick<FactionRecord, "kind" | "heraldrySeed">, year: number): EmblemSpec => faction.kind === "crown"
  ? { kind: "royal", arms: royalArms(year) } : faction.kind === "merchant_house"
    ? { kind: "merchant", recipe: heraldryMark(faction.heraldrySeed) } : { kind: "arms", recipe: heraldryArms(faction.heraldrySeed) };

/** The faction a record is about or names (a relation's subject, a petition's or a war record's actor). */
export function recordFaction(record: Pick<HistoryRecord, "subject" | "actors">): string | null {
  if (record.subject.type === "faction") return record.subject.id;
  return record.actors?.find(actor => actor.type === "faction")?.id ?? null;
}

/** A faction's name by id (FIX-5: only through `factionDisplayName`), or null when the town has no such faction. */
export function factionNameOf(state: Partial<Pick<GameState, "factions">>, id: string): string | null {
  const faction = state.factions?.factions.find(entry => entry.id === id);
  return faction === undefined ? null : factionDisplayName(faction.id, faction.name);
}

/** A lord's house by its record (`order`, else its name among the houses): its arms (FAIL-3 FL-7). MANOR-1: a house the
 * game has had carries its own arms (the first is the house chosen in the new game, not the default one); the order's
 * seed is only for a house the lordship no longer lists. */
function houseArms(state: Pick<GameState, "seed" | "lordship">, record: HistoryRecord): ChronicleArt {
  const order = record.params?.order;
  const lordship = lordshipOf(state as GameState);
  const seed = typeof order === "number" ? lordHouseByOrder(state, order)?.heraldrySeed ?? lordHouseHeraldrySeed(state.seed, order)
    : [lordship.house, ...lordship.pastHouses].find(house => house.name === record.params?.name)?.heraldrySeed;
  return seed === undefined ? null : { kind: "emblem", emblem: { kind: "arms", recipe: armsRecipe(seed, MANOR_HOUSEHOLD) } };
}

// UI-8 (F3-A): plague records mapped to Wave 21 chronicle scenes.
// Mapping rationale:
//   rumour/arrived/priest_died → ch3_chronicle_first_death (earliest visible sign of the plague)
//   new_graves               → ch3_chronicle_churchyard   (the cemetery fills)
//   empty_streets            → ch3_chronicle_abandoned_fields (town empties; no dedicated empty-streets art)
//   abandoned_fields         → ch3_chronicle_abandoned_fields (fields left untended)
//   ordinance                → ch3_chronicle_ordinance    (the 1351 proclamation)
//   resettlement             → ch3_chronicle_resettlement (new families arrive)
//   second/second_ended      → ch3_chronicle_spring_recovery (the second plague subsides)
const PLAGUE_RECORD_ART: Readonly<Record<string, Wave21ImageId>> = {
  "plague.rumour": "ch3_chronicle_first_death", "plague.arrived": "ch3_chronicle_first_death",
  "plague.priest_died": "ch3_chronicle_first_death", "plague.new_graves": "ch3_chronicle_churchyard",
  "plague.empty_streets": "ch3_chronicle_abandoned_fields", "plague.abandoned_fields": "ch3_chronicle_abandoned_fields",
  "plague.ordinance": "ch3_chronicle_ordinance", "plague.resettlement": "ch3_chronicle_resettlement",
  "plague.second": "ch3_chronicle_churchyard", "plague.second_ended": "ch3_chronicle_spring_recovery",
};

/** F2-A (WR-2…WR-8): a royal demand or the war's choice by its petition — its chronicle scene, else its Wave 17 decision card. */
const WAR_DEMAND_ART: Readonly<Record<string, Wave17ImageId>> = {
  wool_payment: "chronicle_wool_levy", levy_response: "chronicle_conscription", war_funding: "decision_war_funding",
  refugee_admission: "decision_refugee_admission", wall_or_market: "decision_wall_or_market",
};
/** F2-A (WR-1…WR-7): the war's records. `favour_lost` and the men's return borrow the messenger's and the levy's scenes. */
const WAR_RECORD_ART: Readonly<Record<string, Wave17ImageId>> = {
  "war.messenger": "chronicle_messenger", "war.beacon": "chronicle_beacon", "war.raid": "chronicle_raid", "war.conscripts_left": "chronicle_conscription",
  "war.conscripts_returned": "chronicle_conscription", "war.licence": "chronicle_purveyance_licence", "war.favour_lost": "chronicle_messenger",
};

/** The record's picture that F2-A, FACTION-0 and FAIL-3 brought (null: the CHRON-1 rules below decide). */
function chapterTwoArt(state: Pick<GameState, "seed" | "lordship" | "factions" | "scenarioId">, record: HistoryRecord): ChronicleArt {
  const param = (key: string) => String(record.params?.[key] ?? "");
  const war = WAR_RECORD_ART[record.template];
  if (war !== undefined) return { kind: "wave17", id: war };
  if (record.template === "war.unanswered") { const id = WAR_DEMAND_ART[param("defId")]; return id === undefined ? null : { kind: "wave17", id }; }
  if (record.template === "decision.petition_response") {
    if (param("defId") === "wall_or_market" && param("chosen") !== "expired") return param("chosen") === "refuse" ? { kind: "wave16", id: "chronicle_market_day" } : { kind: "wave17", id: "stonewall_start" };
    const id = WAR_DEMAND_ART[param("defId")];
    return id === undefined ? null : { kind: "wave17", id };
  }
  if (record.template === "faction.relation") {
    const faction = state.factions?.factions.find(entry => entry.id === record.subject.id);
    // The arms borne when the record was written (the Crown's changed in 1340).
    return faction === undefined ? null : { kind: "emblem", emblem: factionEmblem(faction, history.date({ tick: record.tick }, state).year) };
  }
  if (record.template === "house.withdrew" || record.template === "house.arrived" || record.template === "house.resettled") return houseArms(state, record);
  if (record.template === "milestone.chapter_start" && param("chapter") === "2") return { kind: "wave16", id: "chapter2_intro" };
  if (record.template === "milestone.chapter_end" && param("chapter") === "2") return { kind: "wave17", id: "chapter2_end" };
  return null;
}

// UI-9 (F4-A RG-5…RG-9): chapter 4 reorganisation decision cards and chapter 4 end milestone.
const REORG_DECISION_ART: Readonly<Record<string, Wave21ImageId>> = {
  guild_charter: "ch4_decision_guild_approval", tax_collection: "ch4_decision_tax_collection",
  cloth_or_grain: "ch4_decision_textile_or_grain", borough_charter: "ch4_decision_charter_negotiation",
};

/** F4-A: the reorganisation's petition decisions and chapter 4 milestone. */
function chapterFourArt(_state: unknown, record: HistoryRecord): ChronicleArt {
  const param = (key: string) => String(record.params?.[key] ?? "");
  const reorg = reorgRecordArt(record);
  if (reorg !== null) return { kind: "wave21", id: reorg };
  if (record.template === "decision.petition_response") {
    const id = REORG_DECISION_ART[param("defId")];
    if (id !== undefined) return { kind: "wave21", id };
  }
  if (record.template === "milestone.chapter_end" && param("chapter") === "4") return { kind: "wave21", id: "ch4_ending" };
  return null;
}

/** F5-A (UI-10): chapter 5's records, decisions and end page; a family that stays shows its house's arms. */
function chapterFiveArt(state: Pick<GameState, "seed" | "lordship">, record: HistoryRecord): ChronicleArt {
  if (record.template === "legacy.family_stayed") {
    const seed = lordshipOf(state as GameState).house.heraldrySeed;
    return { kind: "emblem", emblem: { kind: "arms", recipe: armsRecipe(seed, MANOR_HOUSEHOLD) } };
  }
  const id = legacyRecordArt(record);
  if (id === null) return null;
  return id in WAVE33_IMAGES ? { kind: "wave33", id: id as Wave33ImageId } : { kind: "wave21", id: id as Wave21ImageId };
}

/** F3-A: the plague's records and chapter 3 milestones. */
function chapterThreeArt(_state: unknown, record: HistoryRecord): ChronicleArt {
  const param = (key: string) => String(record.params?.[key] ?? "");
  const plague = PLAGUE_RECORD_ART[record.template];
  if (plague !== undefined) return { kind: "wave21", id: plague };
  if (record.template === "decision.petition_response") {
    // Plague petition cards: wages, vacant_priest, land_redistribution, cash_rent.
    const plagueDecisions: Readonly<Record<string, Wave21ImageId>> = {
      wages: "ch3_decision_wages", vacant_priest: "ch3_decision_vacant_priest",
      land_redistribution: "ch3_decision_land_redistribution", cash_rent: "ch3_decision_cash_rent",
    };
    const id = plagueDecisions[param("defId")];
    if (id !== undefined) return { kind: "wave21", id };
  }
  // PLAGUE-b: a chapter's start shows its Wave 31 opening painting.
  const start = record.template === "milestone.chapter_start" ? chapterIntro(Number(param("chapter"))) : null;
  if (start !== null) return { kind: "wave31", id: start };
  if (record.template === "milestone.chapter_end" && param("chapter") === "3") return { kind: "wave21", id: "ch3_ending" };
  return null;
}

export function recordArt(state: Pick<GameState, "persons" | "scenarioId" | "seed"> & Partial<Pick<GameState, "lordship" | "factions" | "agency">>, record: HistoryRecord): ChronicleArt {
  // EVENT-ART (lord mode): the lord's ledger moments — marriage, suit, wardship — with their Wave 40 picture.
  const moment = lordMode(state) ? wave40RecordArt(record) : null;
  if (moment !== null) return { kind: "wave40", id: moment };
  if (record.template === "decision.stone_town") return { kind: "wave17", id: "stonewall_start" };
  if (record.template === "milestone.stone_town") return { kind: "wave17", id: "stonewall_complete" };
  // UI-10: chapter 5's records first (its petitions share decision.petition_response).
  const ch5 = chapterFiveArt(state as Pick<GameState, "seed" | "lordship">, record);
  if (ch5 !== null) return ch5;
  // UI-9: chapter 4 reorganisation records checked first (reorg petitions share decision.petition_response).
  const ch4 = chapterFourArt(state, record);
  if (ch4 !== null) return ch4;
  // UI-8: chapter 3 plague records checked before chapter 2 (plague petitions share decision.petition_response).
  const ch3 = chapterThreeArt(state, record);
  if (ch3 !== null) return ch3;
  const later = chapterTwoArt(state as Pick<GameState, "seed" | "lordship" | "factions">, record);
  if (later !== null) return later;
  if (record.kind === "person") {
    const person = recordPerson(state, record);
    return person === undefined ? null : { kind: "portrait", portraitId: portraitAt(person, yearOfTick(state, record.tick)).portraitId };
  }
  if (record.kind === "ledger" || record.template === "decision.bundle") return null;
  // A rumour or a sign is the event's warning card (Wave 16 event art), not the event itself.
  if (record.template === "event.rumour" || record.template === "event.sign") {
    const defId = String(record.params?.defId ?? "");
    return { kind: "wave16", id: defId === "great_famine" ? "event_famine_omen" : defId === "dearth_rehearsal" ? "event_wet_summer" : "event_fire_warning" };
  }
  const id = chronicleIllustration(record);
  return id in WAVE17_IMAGES ? { kind: "wave17", id: id as Wave17ImageId } : { kind: "wave16", id: id as Wave16ImageId };
}

const label = (key: string) => HISTORY_CHOICE_LABELS[key] ?? key;
const param = (record: HistoryRecord, key: string) => { const value = record.params?.[key]; return typeof value === "number" ? value : null; };

function recordNumbers(record: HistoryRecord, bundle: readonly HistoryRecord[] | null): string | null {
  // DEC-CARD-2: a card's, the steward's or a lapse's decision forecasts nothing (its numbers line would read "예측" alone).
  if (record.decision !== undefined && Object.keys(record.decision.predicted).length === 0) return null;
  if (record.decision !== undefined) {
    return CHRONICLE_SCREEN_COPY.outcome(CHRONICLE_SCREEN_COPY.metrics(record.decision.predicted),
      record.decision.actual === undefined ? null : CHRONICLE_SCREEN_COPY.metrics(record.decision.actual));
  }
  if (bundle !== null) {
    return CHRONICLE_SCREEN_COPY.bundleLine(bundle.map(line => ({ kind: String(line.params?.decisionKind ?? ""), count: param(line, "count") ?? 0 })));
  }
  if (record.template === "ledger.season") return CHRONICLE_SCREEN_COPY.seasonNumbers(param(record, "income") ?? 0, param(record, "expense") ?? 0);
  if (record.template === "ledger.rollup") {
    // HL-10 fold: the season's counts only (no "펼치기": the originals are gone).
    const parts: { key: string; count: number }[] = []; let personCount = 0;
    for (const [key, value] of Object.entries(record.params ?? {})) {
      if (typeof value !== "number") continue;
      if (key.startsWith("decision.") && key !== "decision.bundle") parts.push({ key: key.slice("decision.".length), count: value });
      else if (key.startsWith("person.")) personCount += value;
    }
    if (personCount > 0) parts.push({ key: "person", count: personCount });
    return CHRONICLE_SCREEN_COPY.rollupNumbers(parts, param(record, "population"), param(record, "popDelta"));
  }
  return null;
}

export function recordCard(state: Pick<GameState, "history" | "persons" | "scenarioId" | "houses" | "seed"> & Partial<Pick<GameState, "lordship" | "factions" | "legacy">>, item: ChronicleItem): RecordCard {
  const { record, bundle } = item;
  const person = recordPerson(state, record);
  // UI-10: the heir's answer in the heir's real relation (recordSentence), otherwise the ledger's own sentence.
  const summary = bundle !== null ? CHRONICLE_SCREEN_COPY.bundleTitle : recordSentence(state, record);
  const personName = person === undefined ? null : personDisplayName(person);
  const sentence = personName === null || record.kind !== "person" ? summary
    : HOUSEHOLD_TEMPLATES.has(record.template) ? CHRONICLE_SCREEN_COPY.householdLine(personName, summary) : CHRONICLE_SCREEN_COPY.personLine(personName, summary);
  return {
    // DEC-CARD-2: a record that followed from a decision says so first (becauseLine).
    id: item.key, kind: record.kind, frame: FRAMES[record.kind], date: chronicleDate(state, record.tick), sentence: becauseLine(state, record, sentence),
    numbers: recordNumbers(record, bundle), art: recordArt(state, record),
    place: record.place === undefined ? null : { tx: record.place.tx, ty: record.place.ty },
    snapshot: snapshotFor(state, record.tick, record.snapshotId), personId: person?.id ?? null, personName,
    ...(() => { const factionId = bundle === null ? recordFaction(record) : null; const factionName = factionId === null ? null : factionNameOf(state, factionId);
      return factionName === null ? { factionId: null, factionName: null } : { factionId, factionName }; })(),
    decision: record.decision !== undefined, folded: record.template === "ledger.rollup",
  };
}

/** DEC-CARD-2: "1300년 당신의 결정 때문에 — …" before a record that followed from a decision (its main cause; "…도 한몫해"
 * when it was one cause among others, P-C2; the steward's answer and a silence say what they were). */
export function becauseLine(state: Partial<Pick<GameState, "history" | "scenarioId">>, record: Pick<HistoryRecord, "because">, sentence: string): string {
  const because = record.because?.[0];
  const decision = because === undefined ? undefined : recordIndex(state).get(because.decisionId);
  if (because === undefined || decision === undefined) return sentence;
  // SUIT-THREAD (lordplay2 ④): a decision that prepared for the crisis says what it left, not that it caused it.
  const year = yearOfTick(state, decision.tick);
  return RESULTS_COPY.trace.prefixed(because.key === "crisis_prepared" ? RESULTS_COPY.trace.prepared(year) : RESULTS_COPY.trace.because(year, decisionBy(decision), because.part === true), sentence);
}

// ---------------------------------------------------------------------------------------------------------------
// Decision record (CHRONICLE_DESIGN 2.4): what was chosen, the other ways, and each predicted number against what came.

export type DecisionRow = Readonly<{ key: string; predicted: string; actual: string | null; delta: "up" | "down" | "same" | null; deltaLabel: string | null }>;
export type DecisionCompareView = Readonly<{
  id: string; heading: string; chosen: string; alternatives: readonly string[]; art: ChronicleArt; rows: readonly DecisionRow[]; pending: string | null;
}>;

export function decisionCompare(state: Pick<GameState, "persons" | "scenarioId" | "seed"> & Partial<Pick<GameState, "lordship" | "factions" | "registry">>, record: HistoryRecord): DecisionCompareView | null {
  const decision = record.decision;
  if (decision === undefined) return null;
  const kind = String(record.params?.decisionKind ?? record.template.slice("decision.".length));
  // LM-R1: the lord's conditions are named by the lord tab's own words, not the engine's keys.
  // DEC-CARD-2: a card's, the steward's or a lapse's answer in words — an event's by its own choices, a petition's granted or refused.
  const entryId = state.registry?.occurrences.find(entry => entry.id === record.params?.subjectId)?.entryId;
  // A card's command that chose nothing but itself (a suit filed, a marriage proposed) by the ledger's sentence.
  const choiceLabel = (key: string) => lordChoiceLabel(kind, key) ?? (entryId === undefined ? undefined : V4_COPY[entryId]?.choices[key]?.label)
    ?? CHRONICLE_SCREEN_COPY.cardChoices[key] ?? (key === record.params?.command ? recordSentence(state, record) : label(key));
  const rows = Object.entries(decision.predicted).map(([key, predicted]): DecisionRow => {
    const actual = decision.actual?.[key];
    if (actual === undefined) return { key, predicted: CHRONICLE_SCREEN_COPY.predictedValue(key, predicted), actual: null, delta: null, deltaLabel: null };
    const difference = CHRONICLE_SCREEN_COPY.difference(key, Math.abs(actual - predicted));
    return { key, predicted: CHRONICLE_SCREEN_COPY.predictedValue(key, predicted), actual: CHRONICLE_SCREEN_COPY.actualValue(key, actual),
      delta: actual > predicted ? "up" : actual < predicted ? "down" : "same",
      deltaLabel: actual > predicted ? CHRONICLE_SCREEN_COPY.deltaUp(difference) : actual < predicted ? CHRONICLE_SCREEN_COPY.deltaDown(difference) : CHRONICLE_SCREEN_COPY.deltaSame };
  });
  return {
    id: record.id, heading: CHRONICLE_SCREEN_COPY.decisionHeading(chronicleDate(state, record.tick), kind, record.template), chosen: choiceLabel(decision.chosen),
    alternatives: decision.alternatives.map(choiceLabel), art: recordArt(state, record), rows,
    pending: decision.actual === undefined && decision.actualDueTick !== undefined ? CHRONICLE_SCREEN_COPY.actualPending(chronicleDate(state, decision.actualDueTick)) : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Biography (CHRONICLE_DESIGN 2.2, PERSON-0 PS-7).

export type BiographyRelation = Readonly<{ id: string; line: string; portraitId: string | null }>;
export type BiographyView = Readonly<{
  id: string; name: string; portraitId: string; portraitLine: string; portraitExact: boolean; life: string; role: string;
  /** UI-8 (F3-A PL-2): plague death cause line shown below the life span, or null for non-plague deaths and the living. */
  deathCause: string | null;
  /** INSTALL-23 ④: the state ornament on the great circle (`personStates.ts`; a death also greys the face). */
  ornament: PersonStateId | null;
  /** The house they belong to (none for a head: it is theirs). */
  household: string | null;
  /** UI-7: what they have of their parents ("닮은 점: 아버지의 매부리코, 어머니의 붉은 머리"; null for none, `resemblance.ts`). */
  resemblance: string | null;
  /** UI-7b: the page's shield holds a house's arms, its small circle a merchant's mark; either empty is hidden. */
  arms: EmblemSpec | null; mark: EmblemSpec | null; emblemLabel: string;
  events: readonly { readonly id: string; readonly date: string; readonly sentence: string; readonly last: boolean }[];
  relations: readonly BiographyRelation[]; survivors: boolean; offices: readonly string[];
  records: readonly { readonly id: string; readonly tick: number; readonly date: string; readonly sentence: string }[];
}>;

const RELATION_ORDER: Readonly<Record<string, number>> = { head: 0, spouse: 1, child: 2, kin: 3, steward: 4 };

function householdName(state: Pick<GameState, "persons">, householdId: string): string | null {
  if (householdId === MANOR_HOUSEHOLD) return null;
  const members = [...(state.persons?.people ?? []), ...(state.persons?.past ?? [])].filter(person => person.householdId === householdId);
  const head = members.find(person => person.role === "head" && person.alive) ?? members.find(person => person.role === "head") ?? members[0];
  return head === undefined ? null : personDisplayName(head);
}

function occupationName(occupation: string): string {
  return occupation === "" || occupation === "labourer" || occupation === "child" ? "" : OCCUPATION_TITLES[occupation] ?? HISTORY_OCCUPATIONS[occupation] ?? occupation;
}

export function biographyView(state: GameState, personId: string): BiographyView | null {
  const biography = persons.biography(state, personId);
  if (biography === null) return null;
  const { person } = biography;
  // SUIT-THREAD (lordplay2 ⑥, TOP10 9): the parents are the engine's (`persons.parents`: a kinsman's child is his and
  // his bride's, not the lord's), first, wherever they live; the household's others by their roles after them.
  const parents = persons.parents(state, person.id);
  const parentIds = [parents.father, parents.mother].flatMap(parent => parent === null ? [] : [parent.id]);
  const members = [...[parents.father, parents.mother].filter((parent): parent is Person => parent !== null),
    ...personsOf(state, person.householdId).filter(member => member.id !== person.id && !parentIds.includes(member.id))
      .sort((a, b) => (RELATION_ORDER[a.role] ?? 9) - (RELATION_ORDER[b.role] ?? 9) || a.birthYear - b.birthYear)];
  // The marriage's couple (the engine's plan: a kinsman's bride is his wife, not "영주의 친척").
  const plan = state.diplomacy?.marriage;
  const couple = plan !== undefined && [plan.groomId, plan.brideId].includes(person.id) ? (person.id === plan.groomId ? plan.brideId : plan.groomId) : null;
  const kinship = (member: Person) => member.id === parents.father?.id ? "father" as const : member.id === parents.mother?.id ? "mother" as const
    : member.fatherId === person.id || member.motherId === person.id ? "child" as const : member.id === couple ? "spouse" as const : null;
  // A child whose parents the engine knows does not call the household's head and spouse "부모" when they are not.
  const known = parentIds.length > 0;
  const asRole = (member: Person) => known && person.role === "child" && (member.role === "head" || member.role === "spouse") ? "kin" : person.role;
  const relations = members.map(member => ({ id: member.id,
    line: CHRONICLE_SCREEN_COPY.relation(asRole(member), member.role, personDisplayName(member), kinship(member), person.householdId === MANOR_HOUSEHOLD),
    portraitId: drawnPortraitId(member, persons.portrait(state, member).portraitId) }));
  // UI-7b: the shield and the small circle are the emblem slots (a family member stays in the relations below).
  const emblem = personEmblem(state, person);
  const offices: string[] = [];
  for (const tag of person.tags) {
    if (tag === "reeve") offices.push(CHRONICLE_SCREEN_COPY.reeve);
    else if (tag.startsWith("manager:")) {
      const building = state.buildings.find(entry => entry.id === tag.slice("manager:".length));
      if (building !== undefined) offices.push(CHRONICLE_SCREEN_COPY.manager(BUILDING_CONFIG_BY_KIND[building.kind as BuildingKind].name));
    } else if (tag.startsWith("petitioner:")) {
      const fellows = (state.persons?.people ?? []).filter(other => other.id !== person.id && other.tags.includes(tag)).map(other => personDisplayName(other));
      offices.push(CHRONICLE_SCREEN_COPY.petitioner(fellows));
    }
  }
  // "함께 남긴 기록": the weighty records that name this person (decisions, events, the town's milestones they were part of).
  const shared = history.query(state, { actors: [{ type: "person", id: personId }], severity: 1 }).slice(-6).reverse();
  const end = biography.died ?? biography.left;
  return {
    id: person.id, name: personDisplayName(person), portraitId: drawnPortraitId(person, biography.portrait.portraitId), portraitExact: person.role === "steward" || biography.portrait.exact,
    ornament: personOrnament(state, person),
    portraitLine: person.role === "steward" ? PERSONS_COPY.stewardPortrait
      : CHRONICLE_SCREEN_COPY.portraitMatch(biography.portrait.identityId, biography.portrait.stage, biography.portrait.exact),
    life: CHRONICLE_SCREEN_COPY.life(person.birthYear, end, biography.age, biography.died !== null, biography.left !== null && biography.died === null),
    // UI-8 (F3-A PL-2): show plague cause in the header; other death causes are visible in the events list already.
    deathCause: person.deathCause === "plague" && person.deathYear !== undefined
      ? CHRONICLE_SCREEN_COPY.plagueDeath(person.deathYear) : null,
    // The steward's trade is the office itself (not "청지기 · 청지기"); NAT-4 (QA-014): an outsider by his title alone.
    role: isOutsider(person) ? occupationName(person.occupation)
      : CHRONICLE_SCREEN_COPY.role(person.role, person.occupation === person.role ? "" : occupationName(person.occupation)),
    household: person.role === "head" ? null : person.householdId === MANOR_HOUSEHOLD ? CHRONICLE_SCREEN_COPY.household(null)
      : CHRONICLE_SCREEN_COPY.household(householdName(state, person.householdId)),
    resemblance: (parts => parts.length === 0 ? null : PERSON_TRAIT_COPY.resemblance(parts))(resemblanceParts(state, person)),
    arms: emblem?.kind === "merchant" ? null : emblem, mark: emblem?.kind === "merchant" ? emblem : null,
    emblemLabel: emblem === null ? "" : emblem.kind === "merchant" ? PERSONS_COPY.merchantMark : PERSONS_COPY.arms,
    events: biography.events.map((event, index) => ({ id: event.id, date: CHRONICLE_SCREEN_COPY.date(event.date.year, event.date.season), sentence: event.summary,
      last: index === biography.events.length - 1 && end !== null })),
    relations, survivors: !person.alive || person.leftYear !== undefined, offices,
    records: shared.map(record => ({ id: record.id, tick: record.tick, date: chronicleDate(state, record.tick), sentence: history.summary(record, state) })),
  };
}
