import { PRESSURE_BALANCE } from "../content/balanceConfig";
import type { GameState } from "../engine/engine.types";

// Render fix R0-1 (user judgement 2026-09-26): a world signal — S2 road cut, S4 cold house, S8 stopped site — shows
// only once its condition has held for one distribution cycle, a quarter of a season (SIGNAL_PERSIST_TICKS). A new
// game's houses, empty until the first bread round, raise nothing; a stall that clears within the round never shows.
// The engine's own "since" is used where it keeps one (S4: `foodShortSinceTick`); otherwise the first tick this
// session saw the condition, kept per signal family and key. That memory is presentation only: it restarts when the
// clock goes backwards (a new game or a loaded save), so after a load a condition shows one cycle later.
export const SIGNAL_PERSIST_TICKS = PRESSURE_BALANCE.seasonTicks / 4;

type Family = { readonly since: Map<string, number>; lastTick: number; readonly byState: WeakMap<GameState, ReadonlySet<string>> };
const families = new Map<string, Family>();

/**
 * The keys of `present` (condition true in `state`) that have held for a cycle. `engineSince(key)` may give the
 * engine's own start tick. Cache: keyed by the state object per family (every input is in the state, a new object
 * every tick or edit), so a frame's several readers agree and the memory advances once per state.
 */
export function persistentSignals(family: string, state: GameState, present: Iterable<string>,
  engineSince: (key: string) => number | undefined = () => undefined): ReadonlySet<string> {
  let memory = families.get(family);
  if (memory === undefined) { memory = { since: new Map(), lastTick: state.tick, byState: new WeakMap() }; families.set(family, memory); }
  const hit = memory.byState.get(state);
  if (hit !== undefined) return hit;
  if (state.tick < memory.lastTick) memory.since.clear();
  memory.lastTick = state.tick;
  const now = new Set(present);
  for (const key of [...memory.since.keys()]) if (!now.has(key)) memory.since.delete(key);
  const shown = new Set<string>();
  for (const key of now) {
    const seen = memory.since.get(key) ?? state.tick;
    memory.since.set(key, seen);
    const start = Math.min(seen, engineSince(key) ?? seen);
    if (state.tick - start >= SIGNAL_PERSIST_TICKS) shown.add(key);
  }
  memory.byState.set(state, shown);
  return shown;
}
