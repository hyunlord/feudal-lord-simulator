import type { StoryBeat } from "../eventStory";
import { foldChips } from "./chipFold";

// The rail's chips (UI-4; out of useStoryPresentation.ts, LS1-8): which beats show as chips now, in what order, at most
// MAX_CHIPS — the held first, then the year's results chip, then the newest of the rest.
export const LINGER_MS = 60_000;
const MAX_CHIPS = 3;
/** Beats whose chip goes the moment the beat is over: a decision once answered; the year's results chip (LS1-4) once the
 * year turns — the year card takes the year before, so the rail holds one results chip at a time (LS1-6). */
const NO_LINGER: ReadonlySet<StoryBeat["kind"]> = new Set(["lord_decision", "decision_trace"]);

/**
 * The chips shown now, at most MAX_CHIPS: each beat seen `delayMs` ago, not put away, still current or within its minute
 * after. DEC-CARD (A3): a house change's chip is never pushed out by newer chips (at 10× a season's chips come fast).
 * PLAY-2 (friction 8): a house matter due with a deadline (`due`: heldChipIds, LS1-7 — SUIT-THREAD: the engine's
 * `lordMattersDue`, the will, the contested inheritance, a suit against the lord, an entry forewarned; and an audit, an
 * off-map estate's petition; LS1-7: a home petition, a registry offer) stays among the chips until answered or past: closing its card does not put it away,
 * newer chips do not push it out, and it goes the moment it is answered (no lingering). SUIT-THREAD: the lord's loss of
 * a possession (`lasting`) is pinned as a house change is, until put away.
 */
export function storyChips(entries: readonly Readonly<{ beat: StoryBeat; firstSeenMs: number; lastSeenMs: number; dismissed: boolean }>[],
  current: ReadonlySet<string>, nowMs: number, delayMs: number, houseRead: (id: string) => boolean, due: ReadonlySet<string> = new Set()): readonly StoryBeat[] {
  const unanswered = (beat: StoryBeat) => due.has(beat.id) && current.has(beat.id);
  const shown = entries
    .filter(entry => (!entry.dismissed || unanswered(entry.beat)) && !(entry.beat.kind === "house_change" && houseRead(entry.beat.id)) && nowMs - entry.firstSeenMs >= delayMs
      && (current.has(entry.beat.id) || (!NO_LINGER.has(entry.beat.kind) && nowMs - entry.lastSeenMs < LINGER_MS)))
    .map(entry => entry.beat);
  const held = (beat: StoryBeat) => beat.kind === "house_change" || beat.lasting === true || unanswered(beat);
  // LS1-8: the rail's order — the held chips, then the year's results chip (the lord's decisions, LS1-4), then the rest,
  // the newest that fit (the oldest go first): no other chip keeps the results chip off the rail.
  const pinned = shown.filter(held);
  // LS1-11: a decision left past its deadline is one of the lord's results too (what came of his silence).
  const isResults = (beat: StoryBeat) => !held(beat) && ((beat.kind === "decision_trace" && beat.fold === undefined) || beat.kind === "decision_lapsed");
  const results = shown.filter(isResults);
  const rest = foldChips(shown.filter(beat => !held(beat) && !isResults(beat)));
  const room = Math.max(0, MAX_CHIPS - pinned.length - results.length);
  // The newest that fit (CHIP-FOLD: never a negative start — with fewer chips than room it took from the end).
  return [...pinned, ...results, ...rest.slice(Math.max(0, rest.length - room))].slice(0, MAX_CHIPS);
}
