import { factionDisplayName } from "../../content/factionCopy.ko";
import type { GameState } from "../../engine/engine.types";
import { lordMode } from "../../engine/townAgency";
import { gameReducer } from "../../state/gameStore";
import type { GameAction } from "../../state/gameStore.types";
import { DECISION_CARD_COPY as COPY } from "./decisionCardCopy.ko";
import type { Rememberer } from "./decisionCardTypes";
import { outlookRemembers, type AnswerOutlook } from "./outlook";

// DEC-CARD "who remembers": in lord mode the engine's outlook (`answerOutlook().remembers`, the decision's own faction
// memories; outlook.ts). Outside lord mode the outlook gives only the treasury (the trace is lord mode's, DC-D7), so the
// campaign's cards keep the dry run: the answer run on the state (gameReducer is pure; it records the decision with
// recordDecision, which appends the faction.relation records the answer causes) — the engine's own, so no relation table
// is copied here (P-D4). The dry run also gives each family what the outlook lacks (DC-D7: claims, suits, the forecast…).

/** The state after the answer, or null when the engine refuses it (the same state back): the dry run for what the outlook lacks. */
export function afterAnswer(state: GameState, action: GameAction): GameState | null {
  const after = gameReducer(state, action);
  return after === state ? null : after;
}

/** Who remembers an answer the engine takes: the outlook in lord mode, else the dry run's faction records. */
export function remembersFor(state: GameState, outlook: AnswerOutlook, after: GameState | null): readonly Rememberer[] {
  return lordMode(state) ? outlookRemembers(state, outlook) : remembersOf(state, after);
}

/** The faction moves the answer writes (the dry run), strongest first, in words. */
export function remembersOf(before: GameState, after: GameState | null): readonly Rememberer[] {
  if (after === null) return [];
  const known = new Set((before.history?.records ?? []).map(record => record.id));
  const moves = new Map<string, { name: string; delta: number }>();
  for (const record of after.history?.records ?? []) {
    if (known.has(record.id) || record.template !== "faction.relation") continue;
    const id = String(record.params?.faction ?? record.subject.id);
    const delta = Number(record.params?.delta ?? 0);
    if (!Number.isFinite(delta) || delta === 0) continue;
    const name = factionDisplayName(id, String(record.params?.name ?? id));
    const was = moves.get(id);
    moves.set(id, { name, delta: (was?.delta ?? 0) + delta });
  }
  return [...moves.values()].filter(move => move.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .map(move => ({ who: move.name, how: COPY.feels(move.delta), delta: move.delta }));
}
