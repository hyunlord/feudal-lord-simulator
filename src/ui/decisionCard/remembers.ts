import { factionDisplayName } from "../../content/factionCopy.ko";
import type { GameState } from "../../engine/engine.types";
import { gameReducer } from "../../state/gameStore";
import type { GameAction } from "../../state/gameStore.types";
import { DECISION_CARD_COPY as COPY } from "./decisionCardCopy.ko";
import type { Rememberer } from "./decisionCardTypes";

// DEC-CARD "who remembers": the answer run on the state (gameReducer is pure; it records the decision with recordDecision,
// which appends the faction.relation records the answer causes). The new records are who remembers it and which way —
// the engine's own, so no relation table is copied here (P-D4). DEC-TRACE's `answerOutlook` will give the same directly.

/** The state after the answer, or null when the engine refuses it (the same state back). */
export function afterAnswer(state: GameState, action: GameAction): GameState | null {
  const after = gameReducer(state, action);
  return after === state ? null : after;
}

/** The faction moves the answer writes, strongest first, in words. */
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
