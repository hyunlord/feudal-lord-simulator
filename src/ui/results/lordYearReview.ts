import { yearReview as engineYearReview, type YearDecision } from "../../engine/decisionReads";
import type { GameState } from "../../engine/engine.types";
import { historySummary } from "../../engine/history";
import { stateCalendar } from "../../engine/scenarioState";
import { lordMode } from "../../engine/townAgency";
import { CHRONICLE_SCREEN_COPY } from "../chronicle/chronicleScreenCopy.ko";
import { chronicleDate, yearOfTick } from "../chronicle/chronicleScreenModel";
import { recordIndex } from "../chronicle/historyIndex";
import { townYearEnds } from "../lord/seasonBand/townCloses";
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
  const decided = (entry: YearDecision): YearReviewDecision => {
    const record = index.get(entry.decisionId);
    const line = copy.dated(chronicleDate(state, entry.tick), record === undefined ? entry.kind : decisionAbout(state, record));
    const outcome = entry.actual !== null ? copy.outcome(metricsLine(entry.predicted), metricsLine(entry.actual))
      : entry.actualDueTick !== null ? CHRONICLE_SCREEN_COPY.actualPending(chronicleDate(state, entry.actualDueTick)) : "";
    return { id: entry.decisionId, line, outcome };
  };
  const decisions = review.decisions.filter(entry => entry.by === "lord").map(decided);
  const steward = review.decisions.filter(entry => entry.by === "steward").map(decided);
  // What followed (the year's consequences of this year's decisions and the years before), by the decision behind it;
  // the community's building is its own section.
  const groups = traceGroups(state, review.consequences.filter(row => row.key !== "community_built"));
  const threads: YearReviewGroup[] = groups.filter(group => !onlyMinds(group)).flatMap(group => {
    const record = index.get(group.decisionId);
    const lines = threadLines(state, group.rows);
    const all = [...lines.lines, ...lines.feelings];
    if (record === undefined || all.length === 0) return [];
    return [{ key: group.decisionId, heading: RESULTS_COPY.trace.prefixed(traceTitle(yearOfTick(state, group.decisionTick), group.by, preparedOnly(group.rows)), decisionAbout(state, record)),
      lines: capped(all) }];
  });
  const minds = threadLines(state, groups.filter(onlyMinds).flatMap(group => group.rows)).feelings;
  if (minds.length > 0) threads.push({ key: "steward-minds", heading: copy.stewardMinds, lines: capped(minds) });
  const community = review.communityBuilt.map(entry => copy.dated(chronicleDate(state, entry.tick), historySummary({ template: "consequence", params: entry.params }, state)));
  // LS1-5: the town's year start → end when the screen saw both (its season closes), else the engine's seasons' sums.
  const town = [...(lordTownYear(year) ?? yearTown(state, year)), ...growthYearLine(year)];
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
export function growthYearLine(year: number): readonly string[] {
  const held = growthYear(year);
  return held.seasons === 0 || held.last === null ? [] : [GROWTH_COPY.year(held.seasons, GROWTH_COPY.reason(held.last.reason!, held.last.detail))];
}
