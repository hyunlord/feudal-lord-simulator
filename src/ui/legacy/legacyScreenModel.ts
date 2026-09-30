import { HISTORY_CHOICE_LABELS, LORD_HOUSE_NAMES_KO, WAR_CHOICES } from "../../content/historyCopy.ko";
import { CHRONICLE_TEXT, LEGACY_AXIS_COPY } from "../../content/legacyCopy.ko";
import type { LegacyAxis, LegacyEndingId } from "../../content/legacyConfig";
import { campaignChronicle, campaignChronicleText, type ChronicleBookLine } from "../../engine/campaignChronicle";
import type { GameState } from "../../engine/engine.types";
import type { HistoryRecord } from "../../engine/history.types";
import { legacyEnding, legacyOf, legacyScores, legacyWord } from "../../engine/legacy";
import { MANOR_HOUSEHOLD } from "../../engine/persons.types";
import { lordshipOf } from "../../engine/lordshipState";
import type { PlatformFiles } from "../../platform/PlatformServices";
import { factionEmblem, recordArt, recordCard, yearOfTick, type ChronicleArt } from "../chronicle/chronicleScreenModel";
import type { EmblemSpec } from "../heraldry/EmblemImage";
import { armsRecipe } from "../heraldry/heraldry";
import { WAVE16_IMAGES } from "../wave16ArtManifest.generated";
import type { Wave16ImageId } from "../wave16Art";
import { WAVE17_IMAGES } from "../wave17ArtManifest.generated";
import type { Wave17ImageId } from "../wave17Art";
import { WAVE21_IMAGES } from "../wave21ArtManifest.generated";
import type { Wave21ImageId } from "../wave21Art";
import { WAVE31_IMAGES } from "../wave31ArtManifest.generated";
import type { Wave31ImageId } from "../wave31Art";
import { LEGACY_SCREEN_COPY as COPY } from "./legacyScreenCopy.ko";

// UI-10 the campaign's end (spec docs/design/chapter-five-legacy.md LG-7…LG-9, LG-12): the legacy verdict (the three
// axes and their parts, the axis that led, the chosen legacy), the ending the engine wrote (`legacyEnding`) with its
// quoted ledger records, and the chronicle book (`campaignChronicle`) as pages — a title page, one page per chapter,
// the family tree, the factions, the legacy. Pure: the screens render what these return; the export goes through the
// platform's files service with the engine's own text (`campaignChronicleText`).

export const LEGACY_AXES: readonly LegacyAxis[] = ["town", "family", "church"];

/** LG-7 table: the axis that leads each ending (the one painting is dressed in that axis's colours and arms). */
export const ENDING_AXIS: Readonly<Record<LegacyEndingId, LegacyAxis>> = {
  free_borough: "town", house_remembered: "town", merchants_chantry: "town", house_seat: "family", lords_town: "family", pilgrim_town: "church",
};

export type LegacyPartView = Readonly<{ key: string; label: string; value: number; line: string }>;
export type LegacyAxisView = Readonly<{ axis: LegacyAxis; name: string; score: number; lead: boolean; parts: readonly LegacyPartView[] }>;
export type LegacyQuoteView = Readonly<{ id: string; date: string; sentence: string; art: ChronicleArt }>;
export type LegacyEndingView = Readonly<{
  id: LegacyEndingId; title: string; sentence: string; final: boolean; axis: LegacyAxis; emblem: EmblemSpec; emblemName: string;
  quotes: readonly LegacyQuoteView[];
}>;
export type LegacyVerdictView = Readonly<{
  axes: readonly LegacyAxisView[]; lead: LegacyAxis; leadLine: string; chosen: LegacyAxis | null; chosenLine: string; ending: LegacyEndingView;
}>;

const houseName = (state: GameState) => { const name = lordshipOf(state).house.name; return LORD_HOUSE_NAMES_KO[name] ?? name; };
const recordsById = (state: GameState) => new Map((state.history?.records ?? []).map(record => [record.id, record]));

/** The ending's emblem: the town's arms (the town led), the lord's house's (the family), the bishop's (the church). */
function endingEmblem(state: GameState, axis: LegacyAxis): { readonly emblem: EmblemSpec; readonly name: string } {
  const year = yearOfTick(state, state.tick);
  const faction = state.factions?.factions.find(entry => entry.id === (axis === "church" ? "bishop" : "town"));
  if (axis === "family" || faction === undefined) {
    return { emblem: { kind: "arms", recipe: armsRecipe(lordshipOf(state).house.heraldrySeed, MANOR_HOUSEHOLD) }, name: houseName(state) };
  }
  return { emblem: factionEmblem(faction, year), name: LEGACY_AXIS_COPY[axis]!.name };
}

/** A quoted record as a short dated line (the chronicle screen's card: its date, its sentence, its picture). */
function quoteView(state: GameState, record: HistoryRecord): LegacyQuoteView {
  const card = recordCard(state, { key: record.id, tick: record.tick, record, bundle: null });
  return { id: record.id, date: card.date, sentence: card.sentence, art: installedArt(illustrationArt(record.illustration) ?? card.art) };
}

/** LG-7 / LG-8 API for the verdict screen: null before chapter 5 (no legacy yet). */
export function legacyVerdictView(state: GameState): LegacyVerdictView | null {
  const legacy = legacyOf(state);
  const ending = legacyEnding(state);
  if (legacy === undefined || ending === null) return null;
  const scores = legacy.scores ?? legacyScores(state);
  const lead = legacy.ending?.highest ?? ENDING_AXIS[ending.id];
  const axes = LEGACY_AXES.map(axis => {
    const labels = COPY.parts[axis] ?? {};
    const parts = Object.entries(scores.parts[axis]).map(([key, value]) => {
      const label = labels[key] ?? key;
      return { key, label, value, line: COPY.part(label, value) };
    });
    return { axis, name: LEGACY_AXIS_COPY[axis]!.name, score: scores[axis], lead: axis === lead, parts };
  });
  const records = recordsById(state);
  const emblem = endingEmblem(state, ENDING_AXIS[ending.id]);
  return {
    axes, lead, leadLine: COPY.leadLine(LEGACY_AXIS_COPY[lead]!.name), chosen: legacy.legacy ?? null, chosenLine: COPY.chosenLine(legacyWord(legacy.legacy)),
    ending: { id: ending.id, title: ending.title, sentence: ending.sentence, final: ending.final, axis: ENDING_AXIS[ending.id], emblem: emblem.emblem,
      emblemName: emblem.name,
      quotes: ending.quotes.flatMap(id => { const record = records.get(id); return record === undefined ? [] : [quoteView(state, record)]; }) },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The chronicle book (LG-9).

export type BookLineView = Readonly<{ id: string; year: string; text: string; art: ChronicleArt }>;
export type BookDecisionView = BookLineView & Readonly<{ chosen: string; alternatives: string }>;
export type BookPersonView = Readonly<{ id: string; name: string; life: string; parents: string; head: boolean; generation: number; generationLabel: string }>;
export type BookPage =
  | Readonly<{ kind: "title"; key: "title"; title: string; years: string; status: string; emblem: EmblemSpec; contents: readonly string[] }>
  | Readonly<{ kind: "chapter"; key: string; chapter: number; heading: string; years: string; closed: boolean; summary: string;
      events: readonly BookLineView[]; decisions: readonly BookDecisionView[] }>
  | Readonly<{ kind: "family"; key: "family"; heading: string; houses: readonly Readonly<{ order: number; name: string; years: string; people: readonly BookPersonView[] }>[] }>
  | Readonly<{ kind: "factions"; key: "factions"; heading: string;
      factions: readonly Readonly<{ id: string; name: string; relation: number; relationLine: string; entries: readonly BookLineView[] }>[] }>
  | Readonly<{ kind: "legacy"; key: "legacy"; heading: string; verdict: LegacyVerdictView | null; scoresLine: string | null }>;
export type ChronicleBookView = Readonly<{ finished: boolean; pages: readonly BookPage[] }>;

/** An illustration key the engine wrote, if it is a picture the game has (any wave; the sets share no id). */
function illustrationArt(id: string | undefined): ChronicleArt {
  if (id === undefined) return null;
  if (id in WAVE21_IMAGES) return { kind: "wave21", id: id as Wave21ImageId };
  if (id in WAVE31_IMAGES) return { kind: "wave31", id: id as Wave31ImageId };
  if (id in WAVE17_IMAGES) return { kind: "wave17", id: id as Wave17ImageId };
  if (id in WAVE16_IMAGES) return { kind: "wave16", id: id as Wave16ImageId };
  return null;
}

/** The chronicle screen's picture, dropped when it names an image the game does not have (a chapter-5 key before its art). */
function installedArt(art: ChronicleArt): ChronicleArt {
  if (art === null) return null;
  if (art.kind === "wave16") return art.id in WAVE16_IMAGES ? art : null;
  if (art.kind === "wave17") return art.id in WAVE17_IMAGES ? art : null;
  if (art.kind === "wave21") return art.id in WAVE21_IMAGES ? art : null;
  if (art.kind === "wave31") return art.id in WAVE31_IMAGES ? art : null;
  return art;
}

function bookLine(state: GameState, records: ReadonlyMap<string, HistoryRecord>, line: ChronicleBookLine): BookLineView {
  const record = records.get(line.recordId);
  const art = illustrationArt(line.illustration) ?? (record === undefined ? null : installedArt(recordArt(state, record)));
  return { id: line.recordId, year: COPY.book.year(line.year), text: line.text, art };
}

/** A decision's answer in words (the war's own answers, else the ledger's). */
function answerLabel(record: HistoryRecord | undefined, key: string): string {
  const defId = String(record?.params?.defId ?? "");
  return WAR_CHOICES[defId]?.[key] ?? HISTORY_CHOICE_LABELS[key] ?? key;
}

/** LG-9 API for the book screen: the book so far (at the campaign's end, the whole of it), page by page. */
export function chronicleBookView(state: GameState): ChronicleBookView {
  const book = campaignChronicle(state);
  const records = recordsById(state);
  const chapters: BookPage[] = book.chapters.map(chapter => ({
    kind: "chapter", key: `chapter-${chapter.chapter}`, chapter: chapter.chapter, heading: CHRONICLE_TEXT.chapter({ chapter: chapter.chapter }),
    years: COPY.book.years(chapter.fromYear, chapter.toYear), closed: chapter.closed, summary: chapter.summary,
    events: chapter.events.map(line => bookLine(state, records, line)),
    decisions: chapter.decisions.map(decision => {
      const record = records.get(decision.recordId);
      return { ...bookLine(state, records, decision), chosen: COPY.book.chosen(answerLabel(record, decision.chosen)),
        alternatives: COPY.book.alternatives(decision.alternatives.map(key => answerLabel(record, key))) };
    }),
  }));
  const names = new Map(book.family.people.map(person => [person.id, person.name]));
  const family: BookPage = {
    kind: "family", key: "family", heading: CHRONICLE_TEXT.family,
    houses: book.family.houses.map(house => ({
      order: house.order, name: LORD_HOUSE_NAMES_KO[house.name] ?? house.name, years: COPY.book.houseYears(house.since, house.until),
      people: book.family.people.filter(person => person.house === house.order)
        .sort((a, b) => a.generation - b.generation || a.birthYear - b.birthYear || a.id.localeCompare(b.id))
        .map(person => ({ id: person.id, name: person.name, life: COPY.book.life(person.birthYear, person.deathYear, person.leftYear),
          parents: COPY.book.parents([person.fatherId, person.motherId].flatMap(id => { const name = id === null ? undefined : names.get(id); return name === undefined ? [] : [name]; })),
          head: person.head, generation: person.generation, generationLabel: COPY.book.generation(person.generation) })),
    })),
  };
  const factions: BookPage = {
    kind: "factions", key: "factions", heading: CHRONICLE_TEXT.factions,
    factions: book.factions.map(faction => ({ id: faction.id, name: faction.name, relation: faction.relation, relationLine: COPY.book.relation(faction.relation),
      entries: faction.entries.map(line => bookLine(state, records, line)) })),
  };
  const legacy: BookPage = { kind: "legacy", key: "legacy", heading: CHRONICLE_TEXT.legacy, verdict: legacyVerdictView(state),
    scoresLine: book.legacy === null ? null : CHRONICLE_TEXT.scores(book.legacy.scores) };
  const contents = [...chapters, family, factions, legacy].map(page => page.kind === "chapter" ? `${page.heading} · ${page.years}` : "heading" in page ? page.heading : "");
  const title: BookPage = {
    kind: "title", key: "title", title: CHRONICLE_TEXT.title({ house: lordshipOf(state).house.name, fromYear: book.fromYear, toYear: book.toYear }),
    years: COPY.book.years(book.fromYear, book.toYear), status: book.finished ? COPY.book.finished : COPY.book.soFar(book.toYear),
    emblem: { kind: "arms", recipe: armsRecipe(lordshipOf(state).house.heraldrySeed, MANOR_HOUSEHOLD) }, contents,
  };
  return { finished: book.finished, pages: [title, ...chapters, family, factions, legacy] };
}

/** LG-9 export: the engine's Korean text saved through the platform (`연대기-<house>-<year>.txt`). */
export function exportChronicleText(state: GameState, files: PlatformFiles): Promise<{ readonly fileName: string; readonly saved: boolean }> {
  const fileName = COPY.fileName(houseName(state), yearOfTick(state, state.tick));
  return files.saveText(fileName, campaignChronicleText(state)).then(saved => ({ fileName, saved }), () => ({ fileName, saved: false }));
}
