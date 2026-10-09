/**
 * LONGRUN-1's faction-memory fold, written with TRACE-KEEP (A5, the user's ruling 2026-10-09) so its rule is pinned before
 * it is wired in: a faction's small memories older than the given tick — those of no decision, or of a small one — fold
 * into one line per faction and year (their sum); the memories of a big decision (`isBigDecision`) never fold, so who
 * remembers it (`decisionRemembers`) stays whole to the end. LONGRUN-1 calls it on the long run's schedule.
 */
import { BALANCE } from "../content/balanceConfig";
import type { GameState } from "./engine.types";
import { isBigDecision, traceOf } from "./decisionTrace";
import type { FactionMemory } from "./faction.types";

const YEAR = BALANCE.TICKS_PER_YEAR;

/** The memory's reason once folded: `folded:<year index>` (its year counted from the scenario's start). */
export const FOLDED_MEMORY_PREFIX = "folded:";

/** A memory that may fold: older than `beforeTick`, and not a big decision's. */
export function memoryFoldable(state: GameState, memory: FactionMemory, beforeTick: number): boolean {
  if (memory.tick >= beforeTick || memory.reason.startsWith(FOLDED_MEMORY_PREFIX)) return false;
  if (memory.decisionId === undefined) return true;
  const decision = traceOf(state).decisions.find(entry => entry.id === memory.decisionId);
  return decision === undefined || !isBigDecision(decision);
}

/** Folds each faction's foldable memories into one line per year (the sum; its last record); the rest stay as they were. */
export function foldFactionMemories(state: GameState, beforeTick: number): GameState {
  const factions = state.factions;
  if (factions === undefined) return state;
  let changed = false;
  const folded = factions.factions.map(faction => {
    const kept: FactionMemory[] = [];
    const years = new Map<number, FactionMemory>();
    for (const memory of faction.memory) {
      if (!memoryFoldable(state, memory, beforeTick)) { kept.push(memory); continue; }
      changed = true;
      const year = Math.floor(memory.tick / YEAR);
      const sum = years.get(year);
      years.set(year, { recordId: memory.recordId, tick: sum?.tick ?? memory.tick, delta: (sum?.delta ?? 0) + memory.delta, reason: `${FOLDED_MEMORY_PREFIX}${year}` });
    }
    const memory = [...kept, ...years.values()].sort((left, right) => left.tick - right.tick);
    return years.size === 0 ? faction : { ...faction, memory };
  });
  return changed ? { ...state, factions: { ...factions, factions: folded } } : state;
}
