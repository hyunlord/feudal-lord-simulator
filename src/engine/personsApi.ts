import type { GameState } from "./engine.types";
import { historyDate, historyQuery, historySummary } from "./history";
import { ageBandOf, ageOf, currentYear, displayName, personById, personPortrait, personsByRole, personsOf } from "./persons";

/**
 * PERSON-0 PS-7: the persons API for the render (UI-5 portraits, CHRON-1 biographies): `persons.of(state, household)`,
 * `persons.byRole(state, role)`, `persons.biography(state, id)`, `persons.portrait(state, person)`.
 */

/** PS-7: a person's life — their facts, their portrait now, and every ledger record about them, oldest first. */
export function personBiography(state: GameState, id: string) {
  const person = personById(state, id);
  if (person === undefined) return null;
  const year = person.deathYear ?? person.leftYear ?? currentYear(state);
  const records = historyQuery(state, { actors: [{ type: "person", id }] });
  return {
    person, name: displayName(person), age: ageOf(person, year), ageBand: ageBandOf(ageOf(person, year)),
    born: person.birthYear, died: person.deathYear ?? null, left: person.leftYear ?? null, portrait: personPortrait(state, person),
    events: records.map(record => ({ id: record.id, tick: record.tick, date: historyDate(record, state), template: record.template, summary: historySummary(record) })),
  };
}

export const persons = { of: personsOf, byRole: personsByRole, biography: personBiography, portrait: personPortrait, name: displayName } as const;
