import { PETITION_SUBJECTS } from "../content/historyCopy.ko";
import type { GameState } from "../engine/engine.types";
import { history } from "../engine/history";
import type { HistoryRecord } from "../engine/history.types";
import type { ChapterEnd } from "../engine/politics.types";
import { chapterEnd } from "../engine/politics";
import { currentYear } from "../engine/persons";
import { CHRONICLE_COPY } from "./chronicleCopy.ko";
import { answerWords, chapterOpenedTick, chapterOwnsRecord, chapterQuotes, heirRelationWord, recordSentence } from "./legacy/chapterRecords";
import type { StoryIllustration } from "./storyArt";
import { chapterIntro } from "./wave31Art";
import type { Wave21ImageId } from "./wave21Art";
import { interludeImageId, type Wave33ImageId } from "./wave33Art";

// UI-4 chronicle page (CHRONICLE_DESIGN 2.1 timeline v0, one chapter): at the end of chapter 1 (F0-C1 `chapterEnd`),
// the chapter as a timeline edited from the F0-C2 history ledger (`history.query`: the chapter's records of severity 1
// and up — events, eras, milestones, the big decisions — the weightiest CHRONICLE_ENTRIES in order of time), each with
// its Wave 16 chronicle illustration, the three decisions the chapter page quotes (chosen, the alternatives, predicted
// and actual) and the chapter's numbers. Sentences are the ledger's own (`history.summary`).
export const CHRONICLE_ENTRIES = 8;

export type ChronicleView = Readonly<{
  chapter: number;
  title: string;
  entries: readonly { readonly id: string; readonly date: string; readonly sentence: string; readonly illustration: StoryIllustration }[];
  decisions: readonly { readonly id: string; readonly sentence: string; readonly alternatives: string; readonly outcome: string }[];
  stats: readonly string[];
}>;

/**
 * UI-9 (F4-A): the reorganisation's ledger lines and their Wave 21 chapter-4 pictures (the six chronicle scenes, the
 * event illustrations where no scene was painted). The rumour of 1381: the chase only when the collectors were chased —
 * a quiet rumour is the townsfolk talking (the petitions' scene); nobody is hurt in either.
 */
export function reorgRecordArt(record: Pick<HistoryRecord, "template" | "params">): Wave21ImageId | null {
  switch (record.template) {
    case "reorg.wage_competition": case "reorg.weavers_left": return "ch4_chronicle_wage_competition";
    case "reorg.textile_street": return "ch4_chronicle_textile_street";
    case "reorg.alehouse_boom": return "ch4_event_alehouse";
    case "reorg.petitions_surge": return "ch4_chronicle_petitions";
    case "reorg.guild_founded": return "ch4_chronicle_guild";
    case "reorg.overlord_warning": return "ch4_event_lord_warning";
    case "reorg.poll_tax": return "ch4_decision_tax_collection";
    case "reorg.rebellion_rumour": return record.params?.outcome === "chased" ? "ch4_chronicle_rebellion_rumour" : "ch4_chronicle_petitions";
    case "reorg.autonomy_request": return "ch4_event_autonomy_request";
    case "reorg.charter": return "ch4_chronicle_charter_negotiation";
    default: return null;
  }
}

/** UI-10 (F5-A LG-2…LG-5): chapter 5's four decisions' Wave 21 cards (a record the scenes do not cover shows its card). */
const LEGACY_DECISION_ART: Readonly<Record<string, Wave21ImageId>> = {
  royal_tax: "ch5_decision_royal_tax_response", heir_choice: "ch5_decision_heir_choice", borough_autonomy: "ch5_decision_autonomy", legacy_choice: "ch5_decision_legacy",
};

/**
 * UI-10 (F5-A LG-1…LG-8, FIX-9 LG-13): chapter 5's ledger lines and their pictures — the six Wave 21 chronicle scenes
 * (the heir, the town's seal, the charter sealed, the mayor elected with it, the legacy sealed, the last market day),
 * the event illustrations where no scene was painted, the decision cards for the Crown's tax and a refused charter, and
 * the interlude's Wave 33 paintings. A family that stays has no painting of its own: the succession's manor hall.
 */
export function legacyRecordArt(record: Pick<HistoryRecord, "template" | "params">): Wave21ImageId | Wave33ImageId | null {
  const param = (key: string) => String(record.params?.[key] ?? "");
  switch (record.template) {
    case "legacy.mayor_demand": return "ch5_event_mayor_demand";
    case "legacy.royal_tax_envoy": return "ch5_event_royal_tax_envoy";
    case "legacy.royal_subsidy": return "ch5_decision_royal_tax_response";
    case "legacy.succession": case "legacy.family_stayed": return "ch5_event_succession";
    case "legacy.heir_seated": return "ch5_chronicle_heir";
    case "legacy.city_seal": return "ch5_chronicle_city_seal";
    case "legacy.charter_sealed": return "ch5_chronicle_charter_sealing";
    case "legacy.charter_refused": return "ch5_decision_autonomy";
    case "legacy.family_departed": return "ch5_event_family_departure";
    case "legacy.legacy_record": return "ch5_chronicle_legacy_sealing";
    case "legacy.last_market": return "ch5_chronicle_last_market";
    case "legacy.staple": return interludeImageId("staple");
    case "legacy.guild_dispute": return interludeImageId("guild_dispute");
    case "legacy.market_fire": return interludeImageId("market_fire");
    case "legacy.church_rebuilding": case "legacy.nave_rebuilt": return interludeImageId("church_rebuilding");
    case "legacy.deposition": return interludeImageId("deposition");
    case "legacy.unanswered": {
      const defId = param("defId");
      return defId === "guild_dispute" || defId === "church_rebuilding" ? interludeImageId(defId) : LEGACY_DECISION_ART[defId] ?? null;
    }
    case "decision.petition_response": {
      const defId = param("defId");
      // The charter sealed: the town elects its mayor (the scene of the election); the interlude's two by their painting.
      if (defId === "borough_autonomy" && param("chosen") === "accept") return "ch5_chronicle_mayor_election";
      if (defId === "guild_dispute" || defId === "church_rebuilding") return interludeImageId(defId);
      return LEGACY_DECISION_ART[defId] ?? null;
    }
    case "milestone.chapter_end": return param("chapter") === "5" ? "ch5_ending" : null;
    default: return null;
  }
}

/** The chronicle illustration for a ledger record (the chapter's settlement when nothing fits better). */
export function chronicleIllustration(record: Pick<HistoryRecord, "template" | "params">): StoryIllustration {
  const param = (key: string) => String(record.params?.[key] ?? "");
  const reorg = reorgRecordArt(record);
  if (reorg !== null) return reorg;
  const legacy = legacyRecordArt(record);
  if (legacy !== null) return legacy;
  switch (record.template) {
    // UI-8 (F3-A): plague records mapped to Wave 21 chronicle scenes (384×384).
    // rumour / arrived / priest_died → first-death scene (the earliest visible plague sign).
    // new_graves → churchyard, empty_streets / abandoned_fields → abandoned fields.
    // ordinance → the ordinance proclamation, resettlement → resettlement scene.
    // second / second_ended → spring recovery (the plague ebbing).
    case "plague.rumour": case "plague.arrived": case "plague.priest_died": return "ch3_chronicle_first_death";
    case "plague.new_graves": case "plague.second": return "ch3_chronicle_churchyard";
    case "plague.empty_streets": case "plague.abandoned_fields": return "ch3_chronicle_abandoned_fields";
    case "plague.ordinance": return "ch3_chronicle_ordinance";
    case "plague.resettlement": return "ch3_chronicle_resettlement";
    case "plague.second_ended": return "ch3_chronicle_spring_recovery";
    // UI-6 (F2-A): the war's records with the Wave 17 chronicle scenes.
    case "war.messenger": return "chronicle_messenger";
    case "war.beacon": return "chronicle_beacon";
    case "war.raid": return "chronicle_raid";
    case "war.conscripts_left": case "war.conscripts_returned": return "chronicle_conscription";
    case "war.licence": return "chronicle_purveyance_licence";
    case "decision.stone_town": return "stonewall_start";
    case "event.arrived": case "event.recovered":
      return param("defId") === "great_famine" ? (record.template === "event.recovered" ? "chronicle_survival_spring" : "chronicle_famine")
        : param("defId") === "dearth_rehearsal" ? "chronicle_bad_harvest" : "chronicle_first_fire";
    case "decision.famine_response": return param("chosen") === "relief" ? "chronicle_relief" : "chronicle_famine";
    case "decision.petition_response": return param("defId") === "wool_payment" ? "chronicle_wool_levy" : param("defId") === "levy_response" ? "chronicle_conscription"
      : param("chosen") === "refuse" ? "chronicle_petition" : "chronicle_charter";
    case "decision.market_town": case "milestone.market_town": return "chronicle_market_town";
    case "decision.rebuild": return "chronicle_rebuilding";
    case "milestone.first_building": {
      const building = param("building");
      return building === "mill" ? "chronicle_first_mill" : building === "farmstead" ? "chronicle_first_plough" : building === "market" ? "chronicle_market_day"
        : building === "chapel" || building === "church" ? "chronicle_church_dedication" : "chronicle_settlement";
    }
    // PLAGUE-b: a chapter's start is its Wave 31 opening painting (chapter 2's is Wave 16's, chronicleScreenModel).
    case "milestone.chapter_start": return chapterIntro(Number(param("chapter"))) ?? "chronicle_settlement";
    // UI-9 (F4-A): chapter 4 end uses the chapter's own ending illustration.
    case "milestone.chapter_end": return param("chapter") === "4" ? "ch4_ending" : "chronicle_survival_spring";
    case "era.entered": return param("eraId") === "famine" ? "chronicle_famine" : param("eraId") === "saturation" ? "chronicle_settlement" : "chronicle_palisade";
    default: return "chronicle_settlement";
  }
}

/** UI-6: the chapter the town finished last (chapter 1's end, then chapter 2's …). */
export function latestChapterEnd(state: Pick<GameState, "politics">): ChapterEnd | null {
  return state.politics?.chapterEnds.at(-1) ?? chapterEnd(state);
}

/**
 * UI-10: the year a chapter began — the engine starts each chapter at the tick the one before it ended
 * (`endChapterTwo` …, `chapterEnd`), read as its calendar year (`currentYear`); null before that end.
 */
export function chapterStartYear(state: Pick<GameState, "politics" | "scenarioId" | "tick">, chapter: number): number | null {
  const previous = chapterEnd(state, chapter - 1);
  return previous === null ? null : currentYear({ ...state, tick: previous.tick });
}

export function chronicleView(state: GameState): ChronicleView | null {
  const end = latestChapterEnd(state);
  if (end === null) return null;
  // The chapter runs from the end of the one before (chapter 2 begins on chapter 1's closing tick, FL-8).
  const ends = state.politics?.chapterEnds ?? [];
  const from = ends[ends.indexOf(end) - 1]?.tick ?? 0;
  const records = history.query(state, { severity: 1, range: { from, to: end.tick } })
    .filter(record => record.kind !== "person" && record.kind !== "ledger")
    // The chapters meet on one tick: the page keeps its own chapter's start and end, not the one before's or after's.
    .filter(record => !record.template.startsWith("milestone.chapter_") || String(record.params?.chapter ?? end.chapter) === String(end.chapter))
    // UI-10: the tick it opened on is the closing chapter's (chapter 4's charter line is not chapter 5's first event).
    .filter(record => chapterOwnsRecord(record, end.chapter, chapterOpenedTick(state, end.chapter)));
  const chosen = [...records].sort((a, b) => b.severity - a.severity || a.tick - b.tick).slice(0, CHRONICLE_ENTRIES).sort((a, b) => a.tick - b.tick);
  const dateOf = (tick: number) => { const date = history.date({ tick }, state); return CHRONICLE_COPY.date(date.year, date.season); };
  return {
    chapter: end.chapter,
    title: CHRONICLE_COPY.title(end.chapter, end.chronicle.fromYear, end.chronicle.toYear),
    entries: chosen.map(record => ({ id: record.id, date: dateOf(record.tick), sentence: recordSentence(state, record), illustration: chronicleIllustration(record) })),
    // UI-10: chapter 5's page also quotes its own cards' answers the engine's three left out (chapterQuotes).
    decisions: chapterQuotes(state, end.chapter, end.chronicle.decisions, end.tick).map(quote => {
      // UI-6: a petition's quote by its kind (the war's demands are not the merchants' charter) and that kind's answer.
      const defId = String(state.history?.records.find(record => record.id === quote.recordId)?.params?.defId ?? "");
      const subject = quote.kind === "petition_response" && defId !== "" && defId !== "market_charter" ? PETITION_SUBJECTS[defId] : undefined;
      const chosen = answerWords(state, defId, quote.chosen);
      return {
      id: quote.recordId,
      sentence: CHRONICLE_COPY.decision(dateOf(quote.tick), subject ?? quote.kind, chosen),
      alternatives: CHRONICLE_COPY.alternatives(quote.alternatives.map(alternative => answerWords(state, defId, alternative))),
      outcome: CHRONICLE_COPY.outcome(quote.predicted, quote.actual ?? null),
    }; }),
    stats: CHRONICLE_COPY.stats(end.chronicle.stats, end.chapter, heirRelationWord(state)),
  };
}
