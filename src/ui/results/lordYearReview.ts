import { yearReview as engineYearReview, type YearDecision } from "../../engine/decisionReads";
import type { GameState } from "../../engine/engine.types";
import { historySummary } from "../../engine/history";
import { stateCalendar } from "../../engine/scenarioState";
import { lordMode } from "../../engine/townAgency";
import { CHRONICLE_SCREEN_COPY } from "../chronicle/chronicleScreenCopy.ko";
import { chronicleDate, yearOfTick } from "../chronicle/chronicleScreenModel";
import { recordIndex } from "../chronicle/historyIndex";
import { townYearEnds, wallKindAt, wallProgressAt } from "../lord/seasonBand/townCloses";
import { wallKindNow } from "../lord/growth/growthMark";
import { GROWTH_COPY } from "../lord/growth/growthCopy.ko";
import { growthYear } from "../lord/growth/growthTrack";
import { moneyFull } from "../money.ko";
import { perState } from "../perState";
import { metricsLine } from "./actualNews";
import { decisionAbout, onlyMinds, preparedOnly, threadLines, traceGroups, traceTitle } from "./decisionThread";
import { RESULTS_COPY } from "./resultsCopy.ko";
import { lastYearReview, yearTown, type YearReviewDecision, type YearReviewGroup, type YearReviewView } from "./yearReview";

// DEC-CARD-2 (lord mode): the year's card on the engine's `yearReview` (DEC-TRACE §3, renamed on import — the screen's v1
// is `yearReview` too). The house first (a succession, a house come or gone), then the year's decisions — the lord's
// (what he chose, the actual or the day it is written) and the steward's by the standing policies — then what followed,
// grouped by the decision behind it (the steward's answers that only moved minds as one group), what the community built
// in a refusing builder's place (DTR-15), and the town's year (P-T1). A year with none of it says so in one line. The
// sandbox and the campaign keep v1 (the engine's thread is lord mode's). Once per state.

/** A section shows this many lines; the rest are counted (the chronicle holds them all). */
const MAX_LINES = 8;
const capped = (lines: readonly string[]): readonly string[] =>
  lines.length <= MAX_LINES ? lines : [...lines.slice(0, MAX_LINES - 1), RESULTS_COPY.year.more(lines.length - MAX_LINES + 1)];

export function lordYearReview(state: GameState, year: number): YearReviewView {
  const copy = RESULTS_COPY.year;
  const review = engineYearReview(state, year);
  const index = recordIndex(state);
  const house = review.house.map(entry => copy.dated(chronicleDate(state, entry.tick), historySummary(entry, state)));
  // LS1-16 (render-VIS-checkup-d7f391e: "목재 주문을 정했다" twice in 1316): the same decision with the same outcome is one
  // line, its first date and its count.
  const decided = (entries: readonly YearDecision[]): YearReviewDecision[] => {
    const merged = new Map<string, { id: string; date: string; about: string; outcome: string; count: number }>();
    for (const entry of entries) {
      const record = index.get(entry.decisionId);
      const about = record === undefined ? entry.kind : decisionAbout(state, record);
      const outcome = entry.actual !== null ? copy.outcome(metricsLine(entry.predicted), metricsLine(entry.actual))
        : entry.actualDueTick !== null ? CHRONICLE_SCREEN_COPY.actualPending(chronicleDate(state, entry.actualDueTick)) : "";
      const key = `${about}\u0000${outcome}`; const seen = merged.get(key);
      if (seen !== undefined) seen.count += 1;
      else merged.set(key, { id: entry.decisionId, date: chronicleDate(state, entry.tick), about, outcome, count: 1 });
    }
    return [...merged.values()].map(row => ({ id: row.id, line: copy.times(copy.dated(row.date, row.about), row.count), outcome: row.outcome }));
  };
  const decisions = decided(review.decisions.filter(entry => entry.by === "lord"));
  const steward = decided(review.decisions.filter(entry => entry.by === "steward"));
  // What followed (the year's consequences of this year's decisions and the years before), by the decision behind it;
  // the community's building is its own section.
  const groups = traceGroups(state, review.consequences.filter(row => row.key !== "community_built"));
  // LS1-16 (render-VIS-checkup-d7f391e: "약속을 지켰다" three groups, "목재 주문을 정했다" two, each its own lines): decisions
  // whose heading reads the same are one group — their rows together, so a repeated line is counted once ("(36건)").
  const byHeading = new Map<string, { key: string; heading: string; rows: (typeof groups)[number]["rows"][number][] }>();
  for (const group of groups.filter(entry => !onlyMinds(entry))) {
    const record = index.get(group.decisionId);
    if (record === undefined) continue;
    const heading = RESULTS_COPY.trace.prefixed(traceTitle(yearOfTick(state, group.decisionTick), group.by, preparedOnly(group.rows)), decisionAbout(state, record));
    const seen = byHeading.get(heading);
    if (seen !== undefined) seen.rows.push(...group.rows);
    else byHeading.set(heading, { key: group.decisionId, heading, rows: [...group.rows] });
  }
  // Then decisions whose lines say the same (counts aside: "혼인이 한 걸음 나아갔다" after the proposal, the counter-offer
  // and each promise kept) are one group too, its first heading and how many more ("… 외 3건").
  const bySaying = new Map<string, { key: string; heading: string; more: number; rows: (typeof groups)[number]["rows"][number][] }>();
  for (const group of byHeading.values()) {
    const lines = threadLines(state, group.rows);
    const saying = [...lines.lines.map(line => line.replace(/ \(\d+건\)$/, "")), ...lines.feelings].join("\n");
    if (saying === "") continue;
    const seen = bySaying.get(saying);
    if (seen !== undefined) { seen.rows.push(...group.rows); seen.more += 1; }
    else bySaying.set(saying, { key: group.key, heading: group.heading, more: 0, rows: [...group.rows] });
  }
  const threads: YearReviewGroup[] = [...bySaying.values()].map(group => {
    const lines = threadLines(state, group.rows);
    return { key: group.key, heading: RESULTS_COPY.trace.andMore(group.heading, group.more), lines: capped([...lines.lines, ...lines.feelings]) };
  });
  const minds = threadLines(state, groups.filter(onlyMinds).flatMap(group => group.rows)).feelings;
  if (minds.length > 0) threads.push({ key: "steward-minds", heading: copy.stewardMinds, lines: capped(minds) });
  const community = review.communityBuilt.map(entry => copy.dated(chronicleDate(state, entry.tick), historySummary({ template: "consequence", params: entry.params }, state)));
  // LS1-5: the town's year start → end when the screen saw both (its season closes), else the engine's seasons' sums.
  const town = [...(lordTownYear(year) ?? yearTown(state, year)), ...growthYearLine(year, state)];
  const quiet = house.length === 0 && decisions.length === 0 && steward.length === 0 && threads.length === 0 && community.length === 0;
  return { year, title: copy.title(year), lord: true, house, decisions: cappedDecisions(decisions), steward: cappedDecisions(steward), answers: [], relations: [], receipts: [], threads, community: capped(community),
    town, empty: quiet && town.length === 0 ? copy.nothing : null };
}

/** The decisions kept to MAX_LINES, the rest counted in a last line. */
function cappedDecisions(entries: readonly YearReviewDecision[]): readonly YearReviewDecision[] {
  return entries.length <= MAX_LINES ? entries
    : [...entries.slice(0, MAX_LINES - 1), { id: "more", line: RESULTS_COPY.year.more(entries.length - MAX_LINES + 1), outcome: "" }];
}

/** The card the hook opens for the year just ended: the engine's review in lord mode, else v1. Once per state. */
export const yearCard = perState((state: GameState): YearReviewView =>
  lordMode(state) ? lordYearReview(state, stateCalendar(state).year - 1) : lastYearReview(state));

/** LS1-5 (lord-screen-v1.md): "마을의 한 해" — people, houses, fields and the treasury at the year's start and end (the
 * town at the closes the screen saw: townCloses); null when it did not see both. */
export function lordTownYear(year: number): readonly string[] | null {
  const ends = townYearEnds(year);
  if (ends === null) return null;
  const line = RESULTS_COPY.year.townLine;
  return [line.population(ends.start.population, ends.end.population),
    line.houses(Object.keys(ends.start.levels).length, Object.keys(ends.end.levels).length),
    line.fields(ends.start.fields, ends.end.fields),
    line.coin(moneyFull(ends.start.coin), moneyFull(ends.end.coin))];
}

/** LS1-3 / LS1-5: the year's stop of the town's growth — the season closes the screen saw it held at, and its last cause. */
export function growthYearLine(year: number, state?: Pick<GameState, "constructionSites" | "era">): readonly string[] {
  const held = growthYear(year);
  if (held.seasons === 0 || held.last === null) return [];
  // LS1-19: the wall of that close (its snapshot), else the town's now.
  const wallKind = wallKindAt(held.last.year, held.last.season) ?? (state === undefined ? "palisade" : wallKindNow(state));
  if (held.last.reason === "town_full") return [GROWTH_COPY.complete.year(held.seasons)];
  return [GROWTH_COPY.year(held.seasons, GROWTH_COPY.reason(held.last.reason!, held.last.detail, wallProgressAt(held.last.year, held.last.season), wallKind))];
}
