import type { StoryBeat } from "../eventStory";
import { RESULTS_COPY } from "../results/resultsCopy.ko";

/**
 * CHIP-FOLD (user 2026-10-11; VIS-1: of 320 chips over twenty years at 10x most were one cause again — "N년 당신의 결정
 * 때문에: 시장 부담" — and the rail's three slots buried the news): the chips of one cause (`fold`) fold into one, at the
 * newest's place, its title the cause and how many ("당신의 결정 때문에: 시장 부담 ×12"); `folded` names them all.
 */
export function foldChips(beats: readonly StoryBeat[]): readonly StoryBeat[] {
  const groups = new Map<string, StoryBeat[]>();
  for (const beat of beats) if (beat.fold !== undefined) groups.set(beat.fold.key, [...(groups.get(beat.fold.key) ?? []), beat]);
  return beats.flatMap(beat => {
    const group = beat.fold === undefined ? undefined : groups.get(beat.fold.key);
    if (beat.fold === undefined || group === undefined) return [beat];
    if (group[group.length - 1] !== beat) return [];
    // One chip per cause, its id the cause's (`fold:<key>`): the next season's consequence counts on the same chip instead
    // of coming as a new one (a new chip each season re-announced it and shut its open card).
    return [{ ...beat, id: `fold:${beat.fold.key}`, title: group.length < 2 ? beat.title : RESULTS_COPY.trace.folded(beat.fold.title, group.length),
      folded: group.map(entry => entry.id) }];
  });
}
