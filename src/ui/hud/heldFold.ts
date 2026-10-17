import type { StoryBeat } from "../eventStory";
import { DEADLINE_COPY } from "../lord/decisions/deadlinesCopy.ko";

// LS1-12 (the user's ruling 2026-10-17; render-VIS-ls110-7222860, seed 4: 38 off-map petitions over twenty years, the
// chip budget over 8 a year in 8 years): held decisions of one kind fold into one chip — "영지 밖 청원 3건" — its time
// left the earliest deadline's; its card lists them, each answered from there. One past its deadline leaves the fold
// and changes in its own place (LS1-10); the others stay folded.

/** The held kinds that fold, by their chips' id prefix. */
const FOLDS: ReadonlySet<string> = new Set(["estate-petition", "registry", "home-petition", "audit", "petition"]);
const prefixOf = (id: string): string => id.slice(0, id.indexOf(":"));

/** The folded chip's id for a kind (one chip id, whatever its count). */
export const heldFoldId = (prefix: string): string => `held:${prefix}`;

/**
 * The held chips with two or more of a foldable kind folded into one, at the place of the first; a chip whose deadline
 * passed (`fated`, LS1-10) never folds.
 */
export function foldHeld(pinned: readonly StoryBeat[]): readonly StoryBeat[] {
  const groups = new Map<string, StoryBeat[]>();
  for (const beat of pinned) {
    const prefix = prefixOf(beat.id);
    if (!FOLDS.has(prefix) || beat.fated === true) continue;
    groups.set(prefix, [...(groups.get(prefix) ?? []), beat]);
  }
  const out: StoryBeat[] = [];
  for (const beat of pinned) {
    const group = groups.get(prefixOf(beat.id));
    if (group === undefined || group.length < 2 || beat.fated === true) { out.push(beat); continue; }
    if (group[0] !== beat) continue;
    out.push({ id: heldFoldId(prefixOf(beat.id)), kind: beat.kind, illustration: null, tile: null, decision: null,
      title: DEADLINE_COPY.heldFold(prefixOf(beat.id), group.length), line: DEADLINE_COPY.heldFoldLine(group.length), facts: [], advice: DEADLINE_COPY.lapsedAdvice,
      members: group });
  }
  return out;
}
