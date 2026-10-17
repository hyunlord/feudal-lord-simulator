import type { StoryBeat } from "../eventStory";
import { DEADLINE_COPY } from "../lord/decisions/deadlinesCopy.ko";

// LS1-12 (the user's ruling 2026-10-17; render-VIS-ls110-7222860, seed 4: 38 off-map petitions over twenty years, the
// chip budget over 8 a year in 8 years): held decisions of one kind fold into one chip — "영지 밖 청원 3건" — its time
// left the earliest deadline's; its card lists them, each answered from there. One past its deadline leaves the fold
// and changes in its own place (LS1-10); the others stay folded. LS1-13 (the user's ruling 2026-10-17, seed 4's budget:
// off-map petitions come one at a time): a kind's chip keeps its one id even for a single decision — its own words and
// card then — so a year counts the kind once; a decision newly come into it is told on the chip (EventCards).

/** The held kinds that fold, by their chips' id prefix. */
const FOLDS: ReadonlySet<string> = new Set(["estate-petition", "registry", "home-petition", "audit", "petition"]);
const prefixOf = (id: string): string => id.slice(0, id.indexOf(":"));

/** The folded chip's id for a kind (one chip id, whatever its count). */
export const heldFoldId = (prefix: string): string => `held:${prefix}`;

/**
 * The held chips of a foldable kind as one chip with the kind's id, at the place of the first — a single one in its own
 * words, two or more counted with their list; a chip whose deadline passed (`fated`, LS1-10) never folds.
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
    if (group === undefined || beat.fated === true) { out.push(beat); continue; }
    if (group[0] !== beat) continue;
    if (group.length === 1) { out.push({ ...beat, id: heldFoldId(prefixOf(beat.id)), members: group }); continue; }
    out.push({ id: heldFoldId(prefixOf(beat.id)), kind: beat.kind, illustration: null, tile: null, decision: null,
      title: DEADLINE_COPY.heldFold(prefixOf(beat.id), group.length), line: DEADLINE_COPY.heldFoldLine(group.length), facts: [], advice: DEADLINE_COPY.lapsedAdvice,
      members: group });
  }
  return out;
}
