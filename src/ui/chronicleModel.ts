import { HISTORY_CHOICE_LABELS, PETITION_SUBJECTS, WAR_CHOICES } from "../content/historyCopy.ko";
import type { GameState } from "../engine/engine.types";
import { history } from "../engine/history";
import type { HistoryRecord } from "../engine/history.types";
import type { ChapterEnd } from "../engine/politics.types";
import { chapterEnd } from "../engine/politics";
import { CHRONICLE_COPY } from "./chronicleCopy.ko";
import type { StoryIllustration } from "./storyArt";
import { chapterIntro } from "./wave31Art";

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

/** The chronicle illustration for a ledger record (the chapter's settlement when nothing fits better). */
export function chronicleIllustration(record: Pick<HistoryRecord, "template" | "params">): StoryIllustration {
  const param = (key: string) => String(record.params?.[key] ?? "");
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
    case "milestone.chapter_end": return "chronicle_survival_spring";
    case "era.entered": return param("eraId") === "famine" ? "chronicle_famine" : param("eraId") === "saturation" ? "chronicle_settlement" : "chronicle_palisade";
    default: return "chronicle_settlement";
  }
}

/** UI-6: the chapter the town finished last (chapter 1's end, then chapter 2's …). */
export function latestChapterEnd(state: Pick<GameState, "politics">): ChapterEnd | null {
  return state.politics?.chapterEnds.at(-1) ?? chapterEnd(state);
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
    .filter(record => !record.template.startsWith("milestone.chapter_") || String(record.params?.chapter ?? end.chapter) === String(end.chapter));
  const chosen = [...records].sort((a, b) => b.severity - a.severity || a.tick - b.tick).slice(0, CHRONICLE_ENTRIES).sort((a, b) => a.tick - b.tick);
  const dateOf = (tick: number) => { const date = history.date({ tick }, state); return CHRONICLE_COPY.date(date.year, date.season); };
  const label = (key: string) => HISTORY_CHOICE_LABELS[key] ?? key;
  return {
    chapter: end.chapter,
    title: CHRONICLE_COPY.title(end.chapter, end.chronicle.fromYear, end.chronicle.toYear),
    entries: chosen.map(record => ({ id: record.id, date: dateOf(record.tick), sentence: history.summary(record), illustration: chronicleIllustration(record) })),
    decisions: end.chronicle.decisions.map(quote => {
      // UI-6: a petition's quote by its kind (the war's demands are not the merchants' charter) and that kind's answer.
      const defId = String(state.history?.records.find(record => record.id === quote.recordId)?.params?.defId ?? "");
      const subject = quote.kind === "petition_response" && defId !== "" && defId !== "market_charter" ? PETITION_SUBJECTS[defId] : undefined;
      const chosen = WAR_CHOICES[defId]?.[quote.chosen] ?? label(quote.chosen);
      return {
      id: quote.recordId,
      sentence: CHRONICLE_COPY.decision(dateOf(quote.tick), subject ?? quote.kind, chosen),
      alternatives: CHRONICLE_COPY.alternatives(quote.alternatives.map(alternative => WAR_CHOICES[defId]?.[alternative] ?? label(alternative))),
      outcome: CHRONICLE_COPY.outcome(quote.predicted, quote.actual ?? null),
    }; }),
    stats: CHRONICLE_COPY.stats(end.chronicle.stats, end.chapter),
  };
}
