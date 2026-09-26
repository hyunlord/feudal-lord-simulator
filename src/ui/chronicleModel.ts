import { HISTORY_CHOICE_LABELS } from "../content/historyCopy.ko";
import type { GameState } from "../engine/engine.types";
import { history } from "../engine/history";
import type { HistoryRecord } from "../engine/history.types";
import { chapterEnd } from "../engine/politics";
import { CHRONICLE_COPY } from "./chronicleCopy.ko";
import type { Wave16ImageId } from "./wave16Art";

// UI-4 chronicle page (CHRONICLE_DESIGN 2.1 timeline v0, one chapter): at the end of chapter 1 (F0-C1 `chapterEnd`),
// the chapter as a timeline edited from the F0-C2 history ledger (`history.query`: the chapter's records of severity 1
// and up — events, eras, milestones, the big decisions — the weightiest CHRONICLE_ENTRIES in order of time), each with
// its Wave 16 chronicle illustration, the three decisions the chapter page quotes (chosen, the alternatives, predicted
// and actual) and the chapter's numbers. Sentences are the ledger's own (`history.summary`).
export const CHRONICLE_ENTRIES = 8;

export type ChronicleView = Readonly<{
  chapter: number;
  title: string;
  entries: readonly { readonly id: string; readonly date: string; readonly sentence: string; readonly illustration: Wave16ImageId }[];
  decisions: readonly { readonly id: string; readonly sentence: string; readonly alternatives: string; readonly outcome: string }[];
  stats: readonly string[];
}>;

/** The chronicle illustration for a ledger record (the chapter's settlement when nothing fits better). */
export function chronicleIllustration(record: Pick<HistoryRecord, "template" | "params">): Wave16ImageId {
  const param = (key: string) => String(record.params?.[key] ?? "");
  switch (record.template) {
    case "event.arrived": case "event.recovered":
      return param("defId") === "great_famine" ? (record.template === "event.recovered" ? "chronicle_survival_spring" : "chronicle_famine")
        : param("defId") === "dearth_rehearsal" ? "chronicle_bad_harvest" : "chronicle_first_fire";
    case "decision.famine_response": return param("chosen") === "relief" ? "chronicle_relief" : "chronicle_famine";
    case "decision.petition_response": return param("chosen") === "refuse" ? "chronicle_petition" : "chronicle_charter";
    case "decision.market_town": case "milestone.market_town": return "chronicle_market_town";
    case "decision.rebuild": return "chronicle_rebuilding";
    case "milestone.first_building": {
      const building = param("building");
      return building === "mill" ? "chronicle_first_mill" : building === "farmstead" ? "chronicle_first_plough" : building === "market" ? "chronicle_market_day"
        : building === "chapel" || building === "church" ? "chronicle_church_dedication" : "chronicle_settlement";
    }
    case "milestone.chapter_end": return "chronicle_survival_spring";
    case "era.entered": return param("eraId") === "famine" ? "chronicle_famine" : param("eraId") === "saturation" ? "chronicle_settlement" : "chronicle_palisade";
    default: return "chronicle_settlement";
  }
}

export function chronicleView(state: GameState): ChronicleView | null {
  const end = chapterEnd(state);
  if (end === null) return null;
  const from = state.politics?.chapter.startTick ?? 0;
  const records = history.query(state, { severity: 1, range: { from, to: end.tick } })
    .filter(record => record.kind !== "person" && record.kind !== "ledger");
  const chosen = [...records].sort((a, b) => b.severity - a.severity || a.tick - b.tick).slice(0, CHRONICLE_ENTRIES).sort((a, b) => a.tick - b.tick);
  const dateOf = (tick: number) => { const date = history.date({ tick }, state); return CHRONICLE_COPY.date(date.year, date.season); };
  const label = (key: string) => HISTORY_CHOICE_LABELS[key] ?? key;
  return {
    chapter: end.chapter,
    title: CHRONICLE_COPY.title(end.chapter, end.chronicle.fromYear, end.chronicle.toYear),
    entries: chosen.map(record => ({ id: record.id, date: dateOf(record.tick), sentence: history.summary(record), illustration: chronicleIllustration(record) })),
    decisions: end.chronicle.decisions.map(quote => ({
      id: quote.recordId,
      sentence: CHRONICLE_COPY.decision(dateOf(quote.tick), quote.kind, label(quote.chosen)),
      alternatives: CHRONICLE_COPY.alternatives(quote.alternatives.map(label)),
      outcome: CHRONICLE_COPY.outcome(quote.predicted, quote.actual ?? null),
    })),
    stats: CHRONICLE_COPY.stats(end.chronicle.stats),
  };
}
