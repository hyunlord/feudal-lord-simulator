/**
 * FIX-12 (item 4, spec docs/design/history-ledger.md HL-1a, QA-010): a ledger record names a person by id; the name —
 * with the epithet the person has now (큰/작은) — is drawn when the record is read, never kept as text.
 */
import { PERSON_NAME_FALLBACK } from "../content/historyCopy.ko";
import type { GameState } from "./engine.types";
import type { HistoryParams, HistoryRecord } from "./history.types";
import { personDisplayName } from "./persons";
import type { Person } from "./persons.types";

/**
 * FIX-12 (item 4, HL-1a, QA-010): the parameters that name a person by id, and the name each one gives the sentence.
 * A record keeps the id; the name (with its epithet as it is now — 큰/작은) is drawn when the record is read.
 */
const PERSON_PARAMS: Readonly<Record<string, string>> = {
  lordId: "lord", guardianId: "guardian", candidateId: "candidate", heirId: "heir", mayorId: "mayor", leaderId: "leader", predecessorId: "predecessor",
  // LM-E4: the steward of an estate (an estate person).
  stewardId: "steward",
};
export type PersonReader = Partial<Pick<GameState, "persons" | "factions" | "estates">>;
export const namesPerson = (record: Pick<HistoryRecord, "params">) => record.params !== undefined && Object.keys(record.params).some(key => key in PERSON_PARAMS);
const personIndex = new WeakMap<object, { readonly factions: unknown; readonly estates: unknown; readonly byId: Map<string, Person> }>();

/** The town's people (living and past), the factions' and the neighbour estates' — by id (rebuilt when one of them changes). */
function personNamed(state: PersonReader, id: string): Person | undefined {
  const key = state.persons ?? state;
  const factions = state.factions?.people, estates = state.estates?.people;
  let entry = personIndex.get(key);
  if (entry === undefined || entry.factions !== factions || entry.estates !== estates) {
    entry = { factions, estates, byId: new Map([...(estates ?? []), ...(factions ?? []), ...(state.persons?.past ?? []), ...(state.persons?.people ?? [])]
      .map(person => [person.id, person])) };
    personIndex.set(key, entry);
  }
  return entry.byId.get(id);
}

/**
 * FIX-12 (item 4) API: a record's parameters with each person named now — `lordId` gives `lord`, and so on. An id no
 * reader knows keeps the name the record was written with (a save before FIX-12) or the copy's fallback word.
 */
export function historyParams(record: Pick<HistoryRecord, "params">, state?: PersonReader): HistoryParams {
  const params = record.params ?? {};
  if (!namesPerson(record)) return params;
  const named: Record<string, string | number> = { ...params };
  for (const [idKey, nameKey] of Object.entries(PERSON_PARAMS)) {
    const id = params[idKey];
    if (typeof id !== "string") continue;
    const person = state === undefined || id === "" ? undefined : personNamed(state, id);
    named[nameKey] = person !== undefined ? personDisplayName(person) : typeof params[nameKey] === "string" ? params[nameKey] : PERSON_NAME_FALLBACK[nameKey] ?? "";
  }
  return named;
}
