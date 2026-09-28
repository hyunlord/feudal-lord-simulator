import type { GameState } from "./engine.types";
import { historyDate, historyQuery, historySummary } from "./history";
import type { TraitKey } from "../content/personTraits";
import { sharedTraits } from "./heredity";
import { ageBandOf, ageOf, currentYear, displayName, personById, personDisplayName, personPortrait, personsByRole, personsOf } from "./persons";
import type { NamedLineage, Person, PersonCondition } from "./persons.types";

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

/** Everyone the state knows: the town (living and gone) and the factions' people. */
function everyone(state: GameState): readonly Person[] {
  return [...(state.persons?.people ?? []), ...(state.persons?.past ?? []), ...(state.factions?.people ?? [])];
}

/** LN-11 `persons.parents`: a person's mother and father (null where not known). */
export function personParents(state: GameState, id: string): { readonly mother: Person | null; readonly father: Person | null } {
  const person = personById(state, id);
  const find = (other: string | undefined) => (other === undefined ? null : personById(state, other) ?? null);
  return { mother: find(person?.motherId), father: find(person?.fatherId) };
}

/** LN-11 `persons.children`: a person's children, eldest first. */
export function personChildren(state: GameState, id: string): readonly Person[] {
  return everyone(state).filter(person => person.motherId === id || person.fatherId === id).sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id));
}

/**
 * LN-11 `persons.lineage`: a lineage's people by generation — the first generation those whose parents are not of it,
 * each next one their children (eldest first within a generation).
 */
export function lineageGenerations(state: GameState, lineageId: string): readonly (readonly Person[])[] {
  const members = everyone(state).filter(person => person.lineageId === lineageId);
  const ids = new Set(members.map(person => person.id));
  const generation = new Map<string, number>();
  const depth = (person: Person): number => {
    const known = generation.get(person.id);
    if (known !== undefined) return known;
    const parent = [person.fatherId, person.motherId].find(parentId => parentId !== undefined && ids.has(parentId));
    const value = parent === undefined ? 0 : depth(members.find(other => other.id === parent)!) + 1;
    generation.set(person.id, value);
    return value;
  };
  const rows: Person[][] = [];
  for (const person of [...members].sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id))) (rows[depth(person)] ??= []).push(person);
  return rows.filter(row => row !== undefined);
}

/** LN-11 `persons.resemblance`: the traits two people share (the biography's "닮은 점"). */
export function personResemblance(state: GameState, a: string, b: string): readonly TraitKey[] {
  const first = personById(state, a);
  const second = personById(state, b);
  return first === undefined || second === undefined ? [] : sharedTraits(first.traits, second.traits);
}

/** LN-11 `persons.condition`: a person's passing state now (ill, injured, with child, on pilgrimage), or null. */
export function personCondition(state: Pick<GameState, "tick">, person: Person): PersonCondition | null {
  return person.condition !== undefined && person.condition.until > state.tick ? person.condition : null;
}

/** LN-11 `persons.lineageSet`: a named lineage (its kind and portrait set), or null for a lineage without a name. */
export function namedLineage(state: GameState, lineageId: string): NamedLineage | null {
  return state.persons?.lineages?.find(lineage => lineage.id === lineageId) ?? null;
}

// FIX-6 ③: `displayName` is the name the screens write (Korean readings, `personDisplayName`); `name` the period English.
export const persons = { of: personsOf, byRole: personsByRole, biography: personBiography, portrait: personPortrait, name: displayName,
  displayName: personDisplayName, parents: personParents, children: personChildren, lineage: lineageGenerations, resemblance: personResemblance,
  condition: personCondition, lineageSet: namedLineage } as const;
