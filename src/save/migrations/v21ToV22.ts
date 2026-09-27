import { RETIRED_NAMES } from "../../content/gentryNames";
import type { GameState } from "../../engine/engine.types";

/**
 * v22 is FIX-5's invented names (decision FN11, roadmap "실존 인물·가문 복원 안 함"): the state's shape is v21's, and a
 * v21 save's real houses, earldoms, sees and bishops become the invented ones at the same place in their lists — the
 * lord's houses (current and past), the factions' names and outside people's surnames, and the history ledger's
 * sentences that name them (`house.*`, `faction.relation`). Kings and the world's events are history's and stay.
 */
const rename = (table: Readonly<Record<string, string>>, name: string | undefined) => (name === undefined ? undefined : table[name] ?? name);
const FACTION_TABLE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  overlord: RETIRED_NAMES.earldoms, neighbour_1: RETIRED_NAMES.neighbours, neighbour_2: RETIRED_NAMES.neighbours, bishop: RETIRED_NAMES.sees,
};
const PEOPLE_TABLE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "faction:overlord": RETIRED_NAMES.earls, "faction:neighbour_1": RETIRED_NAMES.neighbours, "faction:neighbour_2": RETIRED_NAMES.neighbours,
  "faction:bishop": RETIRED_NAMES.bishops,
};

export function migrateStateV21ToV22<T extends GameState>(state: T): T {
  let next: T = state;
  const lordship = state.lordship;
  if (lordship !== undefined) {
    next = { ...next, lordship: { ...lordship, house: { ...lordship.house, name: rename(RETIRED_NAMES.lordHouses, lordship.house.name)! },
      pastHouses: lordship.pastHouses.map(house => ({ ...house, name: rename(RETIRED_NAMES.lordHouses, house.name)! })) } };
  }
  const factions = state.factions;
  if (factions !== undefined) {
    next = { ...next, factions: { ...factions,
      factions: factions.factions.map(faction => FACTION_TABLE[faction.id] === undefined ? faction : { ...faction, name: rename(FACTION_TABLE[faction.id]!, faction.name)! }),
      people: factions.people.map(person => {
        const table = PEOPLE_TABLE[person.householdId];
        return table === undefined || person.surname === undefined ? person : { ...person, surname: rename(table, person.surname)! };
      }) } };
  }
  const history = state.history;
  if (history !== undefined) {
    next = { ...next, history: { ...history, records: history.records.map(record => {
      const name = record.params?.name;
      if (typeof name !== "string") return record;
      const table = record.template.startsWith("house.") ? RETIRED_NAMES.lordHouses
        : record.template === "faction.relation" ? FACTION_TABLE[String(record.params?.faction ?? "")] : undefined;
      return table === undefined ? record : { ...record, params: { ...record.params, name: rename(table, name)! } };
    }) } };
  }
  return next;
}

export function migrateV21ToV22(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v21 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v21 save has no state");
  return { ...envelope, schemaVersion: 22, state: migrateStateV21ToV22(envelope.state as GameState) };
}
