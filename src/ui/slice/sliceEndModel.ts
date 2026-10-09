import { BALANCE } from "../../content/balanceConfig";
import { factionDisplayName } from "../../content/factionCopy.ko";
import { decisionRemembers, traceInRange, yearReview } from "../../engine/decisionReads";
import { isBigDecision, traceOf } from "../../engine/decisionTrace";
import type { GameState } from "../../engine/engine.types";
import { historySummary } from "../../engine/history";
import type { HistoryRecord } from "../../engine/history.types";
import { lordSliceOutcome, lordSliceStart } from "../../engine/lordSlice";
import { scenarioOf } from "../../engine/scenarioState";
import { CHRONICLE_SCREEN_COPY } from "../chronicle/chronicleScreenCopy.ko";
import { chronicleDate, snapshotFor, yearOfTick, type SnapshotRef } from "../chronicle/chronicleScreenModel";
import { decisionBy, recordIndex } from "../chronicle/historyIndex";
import { DECISION_CARD_COPY } from "../decisionCard/decisionCardCopy.ko";
import { estateCards } from "../lord/estates/estatesModel";
import { NEGOTIATION_COPY } from "../lord/negotiation/negotiationCopy.ko";
import { moneyFull } from "../money.ko";
import { perState } from "../perState";
import { decisionAbout, decisionSubjectWords, onlyMinds, preparedOnly, threadLines, traceGroups, traceTitle } from "../results/decisionThread";
import { lordYearReview } from "../results/lordYearReview";
import { RESULTS_COPY } from "../results/resultsCopy.ko";
import type { YearReviewView } from "../results/yearReview";
import { SLICE_COPY } from "./sliceCopy.ko";

// LM-R3 phase 2a: the slice's end — "이 도시가 내 결정의 결과인가" (docs/design/lord-slice.md LS-5, DEC-TRACE §2–§4). From
// the engine only, side by side, no verdict (A4: the player answers):
// - why it ended (`lordSliceOutcome`'s reason) and when (its end tick);
// - then and now: the chronicle's first season (its population and the first map) against the outcome's summary —
//   the start's houses and treasury are not kept by the engine, so "then" says only what the chronicle holds;
// - the decisions that shaped the town: `traceInRange` over the slice, grouped by the decision behind each row and
//   ranked by how many rows followed it (the steward's answers that only moved minds stay out, as on the year card);
//   each says who decided (DC-D14: "당신의 결정" only for the lord's own) and opens its record in the chronicle;
// - who remembers: `decisionRemembers` of those decisions, summed per faction and decision, the strongest first;
// - the years at a glance: a line a year — the year's house news (`yearReview`), its big decisions' count, what followed
//   that year (`yearReview`'s rows) and the year's last season population (the chronicle's season line); under it the
//   year's big decisions as the thread keeps them to the end (TRACE-KEEP, DTR-24: the engine's `isBigDecision` over
//   `yearReview`'s decisions — 1300–1308 too in the twentieth year), each with what followed it over the slice, and one
//   line of the year's small matters counted by who handled them (the thread's small decisions of the year and
//   `yearReview.summarised`, the ones it no longer keeps; DC-D14: the steward's handling and the unanswered said as such,
//   zero counts not said); the slice's small matters summed in one line above the years.
// The user's ruling (2026-10-09): at the top, the last year as its year card shows it (`lordYearReview`) — the house's
// news, the lord's decisions and what followed — with the year card and the end season's card as links (the page takes
// their place at the live end).
// Once per state.

const SHAPED_MAX = 6;
/** The last year's groups of what followed shown on the page (its card holds them all). */
const LAST_GROUPS = 3;
const SEASON = BALANCE.TICKS_PER_YEAR / 4;
const LINES_MAX = 4;
/** What followed a year's big decision, shown under it (the decision's record in the chronicle holds it all). */
const BIG_LINES_MAX = 3;
const REMEMBERS_MAX = 5;

export type SliceShapedDecision = Readonly<{ id: string; tick: number; heading: string; followed: string; lines: readonly string[] }>;
/** A year's big decision (TRACE-KEEP): what it was, dated, and what followed it over the slice. */
export type SliceYearDecision = Readonly<{ id: string; line: string; followed: string; lines: readonly string[] }>;
export type SliceYear = Readonly<{ year: number; line: string; big: readonly SliceYearDecision[]; small: string | null }>;
export type SliceEndView = Readonly<{
  title: string;
  why: string;
  fromYear: number;
  toYear: number;
  then: Readonly<{ heading: string; lines: readonly string[]; snapshot: SnapshotRef | null }>;
  now: Readonly<{ heading: string; lines: readonly string[] }>;
  shaped: readonly SliceShapedDecision[];
  remembers: readonly string[];
  years: readonly SliceYear[];
  /** The slice's small matters summed (null when none). */
  smallTotal: string | null;
  /** The user's ruling (2026-10-09): the last year first, as its year card shows it (the card itself is a link). */
  last: Readonly<{ year: number; heading: string; house: readonly string[]; decisions: readonly string[];
    changed: readonly Readonly<{ key: string; heading: string; lines: readonly string[] }>[]; more: string | null; empty: string | null }>;
  /** The season card of the end's season can be opened (it is still the last season closed). */
  seasonCard: boolean;
}>;

/** The last year's card (the engine's yearReview, as the year card shows it), once per state: the end page's link opens it. */
export const sliceYearCard = perState((state: GameState): YearReviewView | null => {
  const outcome = lordSliceOutcome(state);
  return outcome === null || !outcome.ended ? null : lordYearReview(state, yearOfTick(state, outcome.endTick - 1));
});

const capped = (lines: readonly string[], max = LINES_MAX): readonly string[] =>
  lines.length <= max ? lines : [...lines.slice(0, max - 1), RESULTS_COPY.year.more(lines.length - max + 1)];

/** The chronicle's season lines (a season's ledger, or its folded summary), which carry the season's population. */
const seasonLine = (record: HistoryRecord) => (record.template === "ledger.season" || record.template === "ledger.rollup") && typeof record.params?.population === "number";

/** A season line's own season (its record is written at the season's close, the next season's first tick). */
const seasonDate = (record: HistoryRecord) => CHRONICLE_SCREEN_COPY.date(Number(record.params?.year), (Number(record.params?.season ?? 0) % 4) as 0 | 1 | 2 | 3);

export const sliceEndView = perState((state: GameState): SliceEndView | null => {
  const outcome = lordSliceOutcome(state);
  if (outcome === null || !outcome.ended) return null;
  const copy = SLICE_COPY.end;
  const start = lordSliceStart(state);
  const startYear = scenarioOf(state).startYear;
  const lastYear = yearOfTick(state, outcome.endTick - 1);
  const endDate = chronicleDate(state, outcome.endTick);
  const { summary } = outcome;
  const why = outcome.reason === "second_estate" && summary.secondEstateYear !== null
    ? copy.second(start.end.afterSecondEstateYears, summary.secondEstateYear, endDate) : copy.years(start.end.years, endDate);
  const records = state.history?.records ?? [];
  const index = recordIndex(state);
  const first = records.find(seasonLine);
  const cards = new Map(estateCards(state).map(card => [card.estateId, card.name] as const));
  const then = {
    heading: copy.then,
    lines: [...(first === undefined ? [] : [copy.thenPopulation(seasonDate(first), Number(first.params!.population))]),
      copy.estates(copy.list([cards.get(start.home.estateId) ?? start.home.name]))],
    snapshot: snapshotFor(state, 0),
  };
  const now = {
    heading: copy.now(chronicleDate(state, state.tick)),
    lines: [
      copy.nowPopulation(summary.population, summary.houses, moneyFull(summary.treasury)),
      copy.estates(copy.list(summary.estatesHeld.map(id => cards.get(id) ?? id))),
      ...(summary.secondEstateYear === null ? [] : [copy.secondYear(summary.secondEstateYear)]),
      copy.projects(summary.projects, summary.projectsByLord),
      summary.promises.kept + summary.promises.broken + summary.promises.open === 0 ? copy.noPromises : copy.promises(summary.promises.kept, summary.promises.broken, summary.promises.open),
      summary.marriage === null ? copy.noMarriage : copy.marriage(NEGOTIATION_COPY.stages[summary.marriage as keyof typeof NEGOTIATION_COPY.stages] ?? summary.marriage),
    ],
  };
  // What followed the decisions over the slice, by the decision behind it, the most first.
  const groups = traceGroups(state, traceInRange(state, 0, outcome.endTick));
  const ranked = groups.filter(group => !onlyMinds(group)).sort((left, right) => right.rows.length - left.rows.length || left.decisionTick - right.decisionTick);
  // SUIT-THREAD (§6): a decision that only prepared the town heads "○○년 결정이 남긴 대비", not "때문에".
  const titled = (group: (typeof ranked)[number]) => traceTitle(yearOfTick(state, group.decisionTick), group.by, preparedOnly(group.rows));
  const shaped = ranked.slice(0, SHAPED_MAX).map(group => {
    const lines = threadLines(state, group.rows);
    return { id: group.decisionId, tick: group.decisionTick, followed: copy.followed(group.rows.length),
      heading: RESULTS_COPY.trace.prefixed(titled(group), decisionAbout(state, index.get(group.decisionId)!)),
      lines: capped([...lines.lines, ...lines.feelings]) };
  });
  // Who remembers: each decision's memories within the slice, summed per faction.
  const memories = groups.flatMap(group => {
    const sums = new Map<string, number>();
    for (const memory of decisionRemembers(state, group.decisionId)) if (memory.tick < outcome.endTick) sums.set(memory.actor, (sums.get(memory.actor) ?? 0) + memory.delta);
    return [...sums].filter(([, delta]) => delta !== 0).map(([actor, delta]) => ({ actor, delta, group }));
  }).sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.group.decisionTick - right.group.decisionTick);
  const factionName = (id: string) => {
    const faction = state.factions?.factions.find(entry => entry.id === id);
    return faction === undefined ? id : factionDisplayName(faction.id, faction.name);
  };
  const remembers = memories.slice(0, REMEMBERS_MAX).map(memory => copy.remembersLine(factionName(memory.actor), DECISION_CARD_COPY.feels(memory.delta),
    RESULTS_COPY.trace.chipTitle(yearOfTick(state, memory.group.decisionTick), memory.group.by, decisionSubjectWords(state, index.get(memory.group.decisionId)!))));
  // A line a year: the big decisions as the thread keeps them, the small counted (TRACE-KEEP).
  const kept = new Map(traceOf(state).decisions.map(decision => [decision.id, decision] as const));
  const followedBy = new Map(groups.map(group => [group.decisionId, group] as const));
  const population = new Map<number, number>();
  // A season's line belongs to its own year (the winter's close is written at the next year's first tick).
  for (const record of records) if (seasonLine(record) && record.params?.year !== undefined) population.set(Number(record.params.year), Number(record.params.population));
  const total = { lord: 0, steward: 0, lapsed: 0 };
  const years: SliceYear[] = [];
  for (let year = startYear; year <= lastYear; year += 1) {
    const review = yearReview(state, year);
    const small = { ...review.summarised };
    const big: SliceYearDecision[] = [];
    for (const decision of review.decisions) {
      const record = index.get(decision.decisionId);
      const traced = kept.get(decision.decisionId);
      if (record === undefined || traced === undefined || decision.tick >= outcome.endTick) continue;
      if (!isBigDecision(traced)) { small[decisionBy(record)] += 1; continue; }
      const group = followedBy.get(decision.decisionId);
      const lines = group === undefined ? null : threadLines(state, group.rows);
      big.push({ id: decision.decisionId, line: RESULTS_COPY.year.dated(chronicleDate(state, decision.tick), decisionAbout(state, record)),
        followed: group === undefined ? copy.noFollowed : copy.followed(group.rows.length), lines: lines === null ? [] : capped([...lines.lines, ...lines.feelings], BIG_LINES_MAX) });
    }
    total.lord += small.lord; total.steward += small.steward; total.lapsed += small.lapsed;
    const house = review.house[0];
    const parts = [
      ...(house === undefined ? [] : [copy.yearHouse(historySummary(house, state))]),
      ...(big.length > 0 ? [copy.yearBig(big.length)] : small.lord + small.steward + small.lapsed === 0 ? [copy.yearQuiet] : []),
      ...(review.consequences.length === 0 ? [] : [copy.yearFollowed(review.consequences.length)]),
      ...(population.has(year) ? [copy.yearPopulation(population.get(year)!)] : []),
    ];
    years.push({ year, line: copy.yearLine(year, parts), big, small: small.lord + small.steward + small.lapsed === 0 ? null : copy.small(small.lord, small.steward, small.lapsed) });
  }
  const smallTotal = total.lord + total.steward + total.lapsed === 0 ? null : copy.smallSlice(startYear, lastYear, copy.small(total.lord, total.steward, total.lapsed));
  const card = sliceYearCard(state)!;
  const last = {
    year: lastYear, heading: copy.lastYear(lastYear), house: card.house,
    decisions: card.decisions.map(entry => entry.outcome === "" ? entry.line : copy.withOutcome(entry.line, entry.outcome)),
    changed: card.threads.slice(0, LAST_GROUPS).map(group => ({ key: group.key, heading: group.heading, lines: capped(group.lines) })),
    more: card.threads.length > LAST_GROUPS ? copy.lastMore(card.threads.length - LAST_GROUPS) : null, empty: card.empty,
  };
  const closed = state.seasons?.history.at(-1)?.endTick ?? null;
  const seasonCard = closed !== null && closed <= outcome.endTick && closed > outcome.endTick - SEASON;
  return { title: copy.title, why, fromYear: startYear, toYear: lastYear, then, now, shaped, remembers, years, smallTotal, last, seasonCard };
});
