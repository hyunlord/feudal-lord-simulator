/**
 * LM-R2-E ① (render request docs/requests/engine-lmr2-seen-and-reads.md §1, the user's request 2026-10-06): the stories
 * the screen has shown, kept in the save — so a loaded game does not raise a chip again, pause again or open a card by
 * itself again. The id is the screen's story id (opaque, at most 128 characters). Only the screen marks; the bot and the
 * harnesses never do, and no rule reads `seen` — a seed's result is unchanged. Not a decision (no ledger line).
 */
import type { GameState } from "./engine.types";

export type StorySeenHow = "seen" | "opened" | "dismissed";

export interface StorySeenMark {
  readonly id: string;
  /** The tick the story was first marked. */
  readonly tick: number;
  readonly opened?: true;
  readonly dismissed?: true;
}

export interface StorySeenState {
  readonly marks: readonly StorySeenMark[];
}

/** Marks older than this are dropped at each write (two years; a story lasts four seasons at most). */
export const STORY_SEEN_KEEP_TICKS = 8_000;
/** At most this many marks are kept (the oldest go first). */
export const STORY_SEEN_MAX = 256;
const MAX_ID_LENGTH = 128;
const HOWS: ReadonlySet<string> = new Set<StorySeenHow>(["seen", "opened", "dismissed"]);

/** The story's mark, or null if the screen has not shown it. */
export function storySeen(state: Pick<GameState, "seen">, id: string): StorySeenMark | null {
  return state.seen?.marks.find(mark => mark.id === id) ?? null;
}

/**
 * Marks a story: a new mark at this tick, with `opened` or `dismissed` added. The same mark again returns the same
 * state object; an unknown `how`, an empty or too long id change nothing. Each write drops marks older than two years
 * and keeps the newest 256.
 */
export function markStorySeen(state: GameState, id: string, how: string): GameState {
  if (!HOWS.has(how) || id.length === 0 || id.length > MAX_ID_LENGTH) return state;
  const current = storySeen(state, id);
  if (current !== null && (how === "seen" || (how === "opened" && current.opened === true) || (how === "dismissed" && current.dismissed === true))) return state;
  const mark: StorySeenMark = {
    ...(current ?? { id, tick: state.tick }),
    ...(how === "opened" ? { opened: true as const } : {}),
    ...(how === "dismissed" ? { dismissed: true as const } : {}),
  };
  const others = (state.seen?.marks ?? []).filter(entry => entry.id !== id && entry.tick >= state.tick - STORY_SEEN_KEEP_TICKS);
  const marks = [...others, mark].sort((left, right) => left.tick - right.tick || left.id.localeCompare(right.id)).slice(-STORY_SEEN_MAX);
  return { ...state, seen: { marks } };
}
