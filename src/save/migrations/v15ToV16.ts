import type { GameState } from "../../engine/engine.types";
import { initialPersons } from "../../engine/persons";

/**
 * v16 adds PERSON-0's persons (spec `docs/design/persons.md`, PS-1…PS-9): `GameState.persons` (the named people of the
 * town, the dead and those who left) and `PetitionRecord.petitionerIds`. A v15 town's residents become persons here,
 * deterministically from the game seed (names, birth years, roles, portraits) with the steward; the offices (masters,
 * reeve, petitioners) are filled on the first tick after loading.
 */
export function migrateV15ToV16(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v15 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v15 save has no state");
  const state = envelope.state as GameState;
  return { ...envelope, schemaVersion: 16, state: { ...state, persons: initialPersons(state) } };
}
