import type { GameState } from "../../../engine/engine.types";
import { SEASON_TICKS } from "../../../engine/eventSchedule";
import { lordMode } from "../../../engine/townAgency";
import type { StoryBeat } from "../../eventStory";
import { DEADLINE_COPY, type LapseKind } from "./deadlinesCopy.ko";

// LS1-11 (the user's ruling 2026-10-16, item 4 — "플레이어가 놓친 것을 알게 하는 것"): a decision left past its deadline
// used to go quietly; now a chip says what the engine did with it. Read from the engine's own settling: its
// `decision.lapsed` records (a home or off-map petition, a registry offer, a political petition, the will) and an audit
// tolerated with no one's answer (lapseAudits: no record of its own). One chip for the lapses a season settled, shown
// for a season after; its card lists each, the first's record in the chronicle.

const LAPSE_KINDS: ReadonlySet<string> = new Set<LapseKind>(["manor_petition", "estate_petition", "registry", "chapter_petition", "marriage"]);

/** One lapse the engine settled: its kind, when, its record (none for an audit), its matter's id. */
export interface Lapse { readonly kind: LapseKind; readonly tick: number; readonly recordId: string | null; readonly answered: boolean; readonly subjectId: string }

/** The lapses settled in the season gone (the lapse chip's window). */
export function lapses(state: GameState): readonly Lapse[] {
  const since = state.tick - SEASON_TICKS;
  const out: Lapse[] = [];
  for (const record of state.history?.records ?? []) {
    if (record.template !== "decision.lapsed" || record.tick <= since) continue;
    const kind = String(record.params?.decisionKind ?? "");
    if (!LAPSE_KINDS.has(kind)) continue;
    // A registry offer's lapse answer, when its entry has one, is in its source (`registry:<entry>:<choice>`).
    const answered = kind === "registry" && !String(record.params?.source ?? "").endsWith(":lapsed");
    out.push({ kind: kind as LapseKind, tick: record.tick, recordId: record.id, answered, subjectId: String(record.params?.subjectId ?? "") });
  }
  // An audit the lord left: tolerated at its deadline by lapseAudits, with no one's answer on it.
  for (const audit of state.stewardship?.audits ?? []) {
    if (audit.status !== "tolerated" || audit.decidedBy !== undefined || audit.superseded === true || audit.policyAuditId !== undefined) continue;
    if (audit.deadline >= state.tick || audit.deadline < since) continue;
    out.push({ kind: "audit", tick: audit.deadline + 1, recordId: null, answered: false, subjectId: audit.id });
  }
  return out.sort((a, b) => a.tick - b.tick);
}

/** What a lapse came to, in a line. */
export const lapseLine = (lapse: Lapse): string => lapse.answered ? DEADLINE_COPY.lapsedRegistryAnswered : DEADLINE_COPY.lapsedOne(lapse.kind);

/**
 * The season's lapse chip (lord mode): its title the lapse itself, or how many; its card each one. LS1-10: a lapse whose
 * held chip turns into it in place (`inPlace`, by matter id) is not told again here.
 */
export function lapseBeats(state: GameState, inPlace: ReadonlySet<string> = new Set()): readonly StoryBeat[] {
  if (!lordMode(state)) return [];
  const bySeason = new Map<number, Lapse[]>();
  for (const lapse of lapses(state)) {
    if (inPlace.has(lapse.subjectId)) continue;
    const season = Math.floor(lapse.tick / SEASON_TICKS);
    bySeason.set(season, [...(bySeason.get(season) ?? []), lapse]);
  }
  return [...bySeason].map(([season, group]) => {
    const say = lapseLine;
    const first = group.find(lapse => lapse.recordId !== null);
    return {
      id: `lapsed:${season}`, kind: "decision_lapsed", illustration: null, tile: null, decision: null,
      title: group.length === 1 ? say(group[0]!) : DEADLINE_COPY.lapsedMany(group.length),
      line: DEADLINE_COPY.lapsedLine(group.length), facts: group.map(say), advice: DEADLINE_COPY.lapsedAdvice,
      ...(first === undefined ? {} : { chronicle: { recordId: first.recordId!, tick: first.tick, label: DEADLINE_COPY.openLabel } }),
    } satisfies StoryBeat;
  });
}
