/**
 * F5-A (spec docs/design/chapter-five-legacy.md LG-9): the campaign's chronicle book, edited from the history ledger —
 * the chapters (their pages' events and quoted decisions), the lord's family tree, each faction's record with the
 * town, the legacy and its ending — and its export text in Korean. Read-only: nothing here changes the state.
 */
import { factionDisplayName } from "../content/factionCopy.ko";
import { CHAPTER_TITLES, CHRONICLE_TEXT, chapterSummaryLine } from "../content/legacyCopy.ko";
import type { LegacyAxis, LegacyEndingId } from "../content/legacyConfig";
import type { GameState } from "./engine.types";
import { historySummary } from "./history";
import type { PersonReader } from "./historyNames";
import type { HistoryRecord } from "./history.types";
import { legacyEnding, legacyOf, legacyScores } from "./legacy";
import { lordshipOf } from "./lordshipState";
import { LORD_FAMILY_TAG, personDisplayName } from "./persons";
import type { Person } from "./persons.types";
import { chapterEnd, chronicleEntry } from "./politics";
import type { ChronicleEntry } from "./politics.types";
import { calendar, scenarioOf } from "./scenarioState";

export interface ChronicleBookLine {
  readonly recordId: string;
  readonly year: number;
  readonly text: string;
  /** The record's picture (a Wave 21 event or record), if it has one. */
  readonly illustration?: string;
  readonly snapshotId?: string;
}

export interface ChronicleBookChapter {
  readonly chapter: number;
  readonly title: string;
  readonly fromYear: number;
  readonly toYear: number;
  /** Written at the chapter's end (false: the chapter being played, its page so far). */
  readonly closed: boolean;
  readonly summary: string;
  readonly events: readonly ChronicleBookLine[];
  readonly decisions: readonly (ChronicleBookLine & { readonly chosen: string; readonly alternatives: readonly string[] })[];
}

export interface ChronicleBookPerson {
  readonly id: string;
  readonly name: string;
  readonly sex: Person["sex"];
  readonly birthYear: number;
  readonly deathYear: number | null;
  readonly leftYear: number | null;
  readonly fatherId: string | null;
  readonly motherId: string | null;
  /** The house (order) the person belonged to. */
  readonly house: number;
  /** Head of the house (now, at death, or before an heir took it). */
  readonly head: boolean;
  /** 1 = the house's founders; each child one more. */
  readonly generation: number;
  readonly portraitIdentity: string;
}

export interface CampaignChronicle {
  readonly fromYear: number;
  readonly toYear: number;
  /** The campaign has ended (chapter 5's end). */
  readonly finished: boolean;
  readonly chapters: readonly ChronicleBookChapter[];
  readonly family: {
    readonly houses: readonly { readonly order: number; readonly name: string; readonly since: number; readonly until: number | null }[];
    readonly people: readonly ChronicleBookPerson[];
  };
  readonly factions: readonly { readonly id: string; readonly name: string; readonly relation: number; readonly entries: readonly ChronicleBookLine[] }[];
  readonly legacy: {
    readonly scores: { readonly town: number; readonly family: number; readonly church: number };
    readonly chosen: LegacyAxis | null;
    readonly ending: { readonly id: LegacyEndingId; readonly title: string; readonly sentence: string; readonly quotes: readonly string[]; readonly final: boolean } | null;
  } | null;
}

function line(record: HistoryRecord, year: (tick: number) => number, state?: PersonReader): ChronicleBookLine {
  // FIX-12 (item 4): the persons a line names are named now (their id is what the record keeps).
  return { recordId: record.id, year: year(record.tick), text: historySummary(record, state),
    ...(record.illustration === undefined ? {} : { illustration: record.illustration }), ...(record.snapshotId === undefined ? {} : { snapshotId: record.snapshotId }) };
}

/**
 * FIX-11 (FX11-8, FX11-9): a chapter of the book is its page as the chapter wrote it — from FIX-11 on, every decision of
 * the chapter (a page written before keeps its quotes, as the chapter page screen shows them). Its first year is the
 * year of the tick the chapter began (`fromTick`), not a planned one.
 */
function bookChapter(state: GameState, page: ChronicleEntry, closed: boolean, year: (tick: number) => number, fromTick?: number): ChronicleBookChapter {
  const records = new Map((state.history?.records ?? []).map(record => [record.id, record]));
  const events = page.events.flatMap(event => { const record = records.get(event.recordId); return record === undefined ? [] : [line(record, year, state)]; });
  const decisions = page.decisions.flatMap(quote => {
    const record = records.get(quote.recordId);
    return record === undefined ? [] : [{ ...line(record, year, state), chosen: quote.chosen, alternatives: quote.alternatives }];
  });
  const fromYear = fromTick !== undefined ? year(fromTick) : page.fromYear;
  return { chapter: page.chapter, title: CHAPTER_TITLES[page.chapter] ?? "", fromYear, toYear: page.toYear, closed,
    summary: chapterSummaryLine({ fromYear, toYear: page.toYear, populationStart: page.stats.populationStart,
      populationEnd: page.stats.populationEnd, treasury: page.stats.treasury }), events, decisions };
}

/** LG-9 API: the chronicle book so far (at the campaign's end, the whole of it). */
export function campaignChronicle(state: GameState): CampaignChronicle {
  const startYear = scenarioOf(state).startYear;
  const year = (tick: number) => calendar(tick, startYear).year;
  const politics = state.politics;
  const ends = politics?.chapterEnds ?? [];
  const chapters = ends.map((end, index) => bookChapter(state, end.chronicle, true, year, index === 0 ? 0 : ends[index - 1]!.tick));
  if (politics !== undefined && chapterEnd(state, politics.chapter.number) === null)
    chapters.push(bookChapter(state, chronicleEntry(state), false, year, politics.chapter.startTick));

  // The family tree: everyone of the lord's houses (the manor's own), by house and generation.
  const everyone = [...(state.persons?.people ?? []), ...(state.persons?.past ?? [])];
  const houseOf = (person: Person) => Number(person.tags.find(tag => tag.startsWith("lord-house:"))?.slice(11) ?? 0);
  const family = everyone.filter(person => person.tags.includes(LORD_FAMILY_TAG) && houseOf(person) > 0);
  const ids = new Set(family.map(person => person.id));
  const byId = new Map(family.map(person => [person.id, person]));
  const depth = new Map<string, number>();
  const generation = (person: Person): number => {
    const known = depth.get(person.id);
    if (known !== undefined) return known;
    depth.set(person.id, 1);
    const parent = [person.fatherId, person.motherId].find(id => id !== undefined && ids.has(id));
    const value = parent === undefined ? 1 : generation(byId.get(parent)!) + 1;
    depth.set(person.id, value);
    return value;
  };
  const legacy = legacyOf(state);
  const people = family.sort((a, b) => houseOf(a) - houseOf(b) || a.birthYear - b.birthYear || a.id.localeCompare(b.id)).map(person => ({
    id: person.id, name: personDisplayName(person), sex: person.sex, birthYear: person.birthYear, deathYear: person.deathYear ?? null,
    leftYear: person.leftYear ?? null, fatherId: person.fatherId ?? null, motherId: person.motherId ?? null, house: houseOf(person),
    head: person.role === "head" || person.id === legacy?.heir?.previousHeadId, generation: generation(person), portraitIdentity: person.portraitIdentity }));
  const lordship = lordshipOf(state);
  const houses = [...lordship.pastHouses, lordship.house].map(house => ({
    order: house.order, name: house.name, since: year(house.since), until: house.until === undefined ? null : year(house.until) }));

  // The factions: each one's memories of the town (the ledger's faction records) and the events it took part in.
  const records = state.history?.records ?? [];
  const factions = (state.factions?.factions ?? []).map(faction => ({
    id: faction.id, name: factionDisplayName(faction.id, faction.name), relation: faction.relation,
    entries: records.filter(record => (record.kind === "faction" || (record.kind === "event" && record.severity >= 2))
      && (record.actors ?? []).some(actor => actor.type === "faction" && actor.id === faction.id)).map(record => line(record, year, state)),
  }));

  const scores = legacy === undefined ? null : legacy.scores ?? legacyScores(state);
  return {
    fromYear: startYear, toYear: year(state.tick), finished: legacy?.endedTick !== undefined,
    chapters, family: { houses, people }, factions,
    legacy: legacy === undefined || scores === null ? null
      : { scores: { town: scores.town, family: scores.family, church: scores.church }, chosen: legacy.legacy ?? null, ending: legacyEnding(state) },
  };
}

/** LG-9 API: the chronicle book as Korean text (for export), a line each; the factions' last twelve entries each. */
export function campaignChronicleText(state: GameState): string {
  const book = campaignChronicle(state);
  const house = lordshipOf(state).house.name;
  const lines: string[] = [CHRONICLE_TEXT.title({ house, fromYear: book.fromYear, toYear: book.toYear }), ""];
  for (const chapter of book.chapters) {
    lines.push(CHRONICLE_TEXT.chapter({ chapter: chapter.chapter }), chapter.summary);
    for (const event of chapter.events) lines.push(CHRONICLE_TEXT.event({ year: event.year, text: event.text }));
    for (const decision of chapter.decisions) lines.push(CHRONICLE_TEXT.decision({ year: decision.year, text: decision.text }));
    lines.push("");
  }
  lines.push(CHRONICLE_TEXT.family);
  for (const entry of book.family.houses) {
    lines.push(CHRONICLE_TEXT.houseLine({ house: entry.name, since: entry.since, until: entry.until ?? 0 }));
    for (const person of book.family.people.filter(member => member.house === entry.order && member.head)) {
      lines.push(CHRONICLE_TEXT.headLine({ name: person.name, birthYear: person.birthYear, deathYear: person.deathYear ?? 0, generation: person.generation }));
    }
  }
  lines.push("", CHRONICLE_TEXT.factions);
  for (const faction of book.factions) {
    lines.push(CHRONICLE_TEXT.factionLine({ name: faction.name, relation: faction.relation }));
    for (const entry of faction.entries.slice(-12)) lines.push(CHRONICLE_TEXT.event({ year: entry.year, text: entry.text }));
  }
  if (book.legacy !== null) {
    lines.push("", CHRONICLE_TEXT.legacy, CHRONICLE_TEXT.scores(book.legacy.scores));
    if (book.legacy.ending !== null) lines.push(CHRONICLE_TEXT.ending({ title: book.legacy.ending.title }), book.legacy.ending.sentence);
  }
  return lines.join("\n");
}
