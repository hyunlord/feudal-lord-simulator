import { BALANCE } from "../../../content/balanceConfig";
import { SCENARIO_COPY } from "../../../content/scenario/scenarioCopy.ko";
import type { GameState } from "../../../engine/engine.types";
import { growthBlock, type GrowthBlock } from "../../../engine/growthBlock";
import { scenarioOf } from "../../../engine/scenarioState";
import { lordMode } from "../../../engine/townAgency";
import { lordRequestView } from "../../lordCardsModel";
import { GROWTH_COPY } from "./growthCopy.ko";
import { growthRun, type GrowthRun } from "./growthTrack";

const SEASON = BALANCE.TICKS_PER_YEAR / 4;
const YEAR = BALANCE.TICKS_PER_YEAR;

/** The mark in the status pill: "정체 N년" with its whole years when known, "정체 중" when not. */
export type GrowthMark = Readonly<{ years: number | null; text: string; label: string }>;
/** Where the lord's lever leads: the existing screen of its command. */
export type GrowthLeverAction = "policy" | "wall" | "request";
export type GrowthView = Readonly<{
  block: GrowthBlock;
  reason: string;
  /** Shown once the stop has held past two seasons (LS1-3), else null. */
  mark: GrowthMark | null;
  /** Whole years of the stop when known (the engine's since, else the screen saw it begin), else null. */
  years: number | null;
  since: string;
  lever: Readonly<{ line: string; button: string | null; action: GrowthLeverAction | null }>;
}>;

/**
 * LS1-3 (lord-screen-v1.md; GB2A-7): the engine's growthBlock as the screen shows it. Its length: the engine's `since`
 * when it has one (v56), else the season closes the screen saw it hold (growthTrack) — years only when it saw it begin.
 * The lever: the engine's, but lord mode has no drawing of its own (A1: `draw_wall` is no lever here), and the timber
 * order and the request lead to the town's request card only when one waits.
 */
export function growthView(state: GameState, run: GrowthRun = growthRun(), read: GrowthBlock | null = growthBlock(state)): GrowthView | null {
  if (!lordMode(state)) return null;
  const block = read;
  if (block === null) return null;
  const reason = GROWTH_COPY.reason(block.reason, block.detail);
  const held = block.since !== null ? state.tick - block.since > 2 * SEASON : run.closes > 2;
  const years = block.since !== null ? Math.max(1, Math.floor((state.tick - block.since) / YEAR)) : run.known ? Math.max(1, Math.floor(run.closes / 4)) : null;
  const mark = !held ? null : years === null ? { years: null, text: GROWTH_COPY.stalledUnknown, label: GROWTH_COPY.stalledUnknownLabel }
    : { years, text: GROWTH_COPY.stalled(years), label: GROWTH_COPY.stalledLabel(years) };
  const sinceTick = block.since;
  const since = sinceTick !== null ? GROWTH_COPY.panel.since(yearOf(state, sinceTick), SCENARIO_COPY.seasons[seasonOf(sinceTick)])
    : run.known && run.start !== null ? GROWTH_COPY.panel.since(run.start.year, SCENARIO_COPY.seasons[run.start.season as 0 | 1 | 2 | 3]) : GROWTH_COPY.panel.sinceUnknown;
  return { block, reason, mark, years: held ? years : null, since, lever: leverOf(state, block, reason) };
}

function leverOf(state: GameState, block: GrowthBlock, reason: string): GrowthView["lever"] {
  const lever = block.lever;
  const request = lordRequestView(state);
  if (lever === null || lever.kind === "draw_wall") return { line: GROWTH_COPY.noLever(reason), button: null, action: null };
  if (lever.kind === "subsidy") { const copy = GROWTH_COPY.lever.subsidy(lever.building); return { line: copy.line, button: copy.button, action: "policy" }; }
  if (lever.kind === "wall_priority") return { ...GROWTH_COPY.lever.wall_priority, action: "wall" };
  const copy = GROWTH_COPY.lever[lever.kind];
  const waits = request !== null && (lever.kind === "answer_request" || request.kind === "order_timber");
  return { line: copy.line, button: waits ? copy.button : null, action: waits ? "request" : null };
}

const yearOf = (state: GameState, tick: number) => scenarioOf(state).startYear + Math.floor(tick / YEAR);
const seasonOf = (tick: number) => Math.floor((tick % YEAR) / SEASON) as 0 | 1 | 2 | 3;

/** The pill's mark for the state (none outside lord mode, while the town grows, or before the stop has held). */
export function growthMarkOf(state: GameState): GrowthMark | null {
  return growthView(state)?.mark ?? null;
}
