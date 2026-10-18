import { useEffect, useRef } from "react";
import type { GameState } from "../../../engine/engine.types";
import { SEASON_TICKS } from "../../../engine/eventSchedule";
import type { StoryBeat } from "../../eventStory";
import { heldDeadlines, type ChipDue, type HeldDeadline } from "./deadlines";
import { DEADLINE_COPY } from "./deadlinesCopy.ko";
import { lapseLine, lapses, type Lapse } from "./lapseBeats";

// LS1-10 (the user's ruling 2026-10-17, render-VIS-ls111-682d366: a registry offer's chip left the rail at its deadline
// and nothing showed for a season until the engine settled it): a held chip past its deadline changes in place. Until the
// engine settles it, it stays where it stood, "기한 지남 — 철 말에 정리" — the screen remembers it once the engine's open
// list lets it go; once the engine writes its lapse, the same chip says what came of it. So a held decision's lapse takes
// no second place on the rail, and no season shows nothing. The engine's values only: its deadlines and its lapses.

/** What became of a held chip with a deadline: past it and not yet settled, or settled by the engine. */
export type DeadlineFate =
  | { readonly stage: "past"; readonly deadline: HeldDeadline }
  | { readonly stage: "lapsed"; readonly deadline: HeldDeadline; readonly lapse: Lapse };

/** How long past its deadline a chip waits for the engine to settle it (it settles at its next season step). */
const SETTLE_TICKS = 2 * SEASON_TICKS;
/** A remembered deadline; `settled` once its lapse was seen (its lapse chip's season over, it is forgotten, not past again). */
type Remembered = HeldDeadline & { readonly settled?: true };

/**
 * Each remembered held deadline's fate now, and the memory after this state: the held ones taken in; an unheld one kept
 * while past its deadline or settled (the lapse's season), and forgotten once answered in time or over.
 */
export function deadlineFates(memory: ReadonlyMap<string, Remembered>, state: GameState): { readonly memory: ReadonlyMap<string, Remembered>; readonly fates: ReadonlyMap<string, DeadlineFate> } {
  const next = new Map<string, Remembered>(memory);
  const held = heldDeadlines(state);
  for (const deadline of held) next.set(deadline.chipId, deadline);
  const settled = new Map(lapses(state).map(lapse => [lapse.subjectId, lapse] as const));
  const fates = new Map<string, DeadlineFate>();
  for (const [chipId, deadline] of next) {
    const lapse = settled.get(deadline.subjectId);
    if (lapse !== undefined) { fates.set(chipId, { stage: "lapsed", deadline, lapse }); if (deadline.settled !== true) next.set(chipId, { ...deadline, settled: true }); }
    else if (deadline.settled === true) next.delete(chipId);
    else if (state.tick > deadline.dueTick && state.tick <= deadline.dueTick + SETTLE_TICKS) fates.set(chipId, { stage: "past", deadline });
    else if (!held.some(entry => entry.chipId === chipId)) next.delete(chipId);
  }
  return { memory: next, fates };
}

/** The screen's memory of the held deadlines (kept from render to render), and their fates now. */
export function useDeadlineFates(state: GameState): ReadonlyMap<string, DeadlineFate> {
  const memoryRef = useRef<ReadonlyMap<string, Remembered>>(new Map());
  const { memory, fates } = deadlineFates(memoryRef.current, state);
  useEffect(() => { memoryRef.current = memory; });
  return fates;
}

/** A chip's beat as its fate shows it: past, no longer a decision to open; settled, the lapse's own words. */
export function fatedBeat(beat: StoryBeat, fate: DeadlineFate | undefined): StoryBeat {
  if (fate === undefined) return beat;
  const { screen, openLabel, ...rest } = beat;
  void screen; void openLabel;
  if (fate.stage === "past") return { ...rest, decision: null, fated: true };
  const line = lapseLine(fate.lapse);
  return { ...rest, kind: "decision_lapsed", illustration: null, decision: null, fated: true, title: line, chip: DEADLINE_COPY.lapsedShort(fate.lapse.kind, fate.lapse.answered), line: DEADLINE_COPY.lapsedLine(1), facts: [line],
    advice: DEADLINE_COPY.lapsedAdvice, ...(fate.lapse.recordId === null ? {} : { chronicle: { recordId: fate.lapse.recordId, tick: fate.lapse.tick, label: DEADLINE_COPY.openLabel } }) };
}

/**
 * The held chips' time left with their fates: past, "기한 지남 — 철 말에 정리"; settled, none. LS1-12: a folded chip says
 * its earliest member's (and is near when that one is).
 */
export function fatedDues(dues: ReadonlyMap<string, ChipDue>, fates: ReadonlyMap<string, DeadlineFate>, visible: readonly StoryBeat[] = []): ReadonlyMap<string, ChipDue> {
  const out = new Map(dues);
  for (const [chipId, fate] of fates) {
    if (fate.stage === "past") out.set(chipId, { left: DEADLINE_COPY.pastSettling, short: DEADLINE_COPY.short.past, near: true });
    else out.delete(chipId);
  }
  for (const beat of visible) {
    const members = (beat.members ?? []).flatMap(member => { const due = out.get(member.id); return due === undefined ? [] : [due]; });
    const earliest = members.reduce<ChipDue | null>((best, due) => best === null || (due.dueTick ?? Infinity) < (best.dueTick ?? Infinity) ? due : best, null);
    if (earliest !== null) out.set(beat.id, earliest);
  }
  return out;
}
