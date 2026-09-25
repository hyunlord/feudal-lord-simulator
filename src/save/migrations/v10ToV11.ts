/**
 * v11 adds households (spec `docs/design/labour.md`, LB-1 and LB-10): each house gets `members` (adults, children
 * and a seed from the game seed and its building id), so the adults add up to the old labour pool and population
 * and residents stay as they are. `GameState.labour`, `Building.fieldHands`/`haulers`, `House.crafts` and
 * `CarterWalker.cart` are optional; absent means none, and the next tick fills what the rules need.
 */
import type { GameState } from "../../engine/engine.types";
import { withHouseholdMembers } from "../../population/householdMembers";

export function migrateStateV10ToV11(state: GameState): GameState {
  return { ...state, houses: [...withHouseholdMembers(state.houses, state.seed)] };
}

export function migrateV10ToV11(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v10 save must be an envelope object');
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v10 save has no state');
  return { ...envelope, schemaVersion: 11, state: migrateStateV10ToV11(envelope.state as GameState) };
}
