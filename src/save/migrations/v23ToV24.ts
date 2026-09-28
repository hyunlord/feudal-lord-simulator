/**
 * v24 adds PERSON-1a's lineage (spec `docs/design/lineage.md` LN-1…LN-12): a person's `traits` (hair, skin, eyes, face,
 * nose, build tendency), `lineageId`, `motherId`/`fatherId`, a passing `condition`, and a newborn's name origin; the
 * person state's named lineages, reeve terms per lineage, the lord's family's ordinal and the bailiff's year.
 *
 * LN-12: every v23 person takes the traits their portrait shows (the pool's record of the face; a trait the record does
 * not name is drawn from the population by the person's id), a lineage, and — for a child of a household — its head and
 * spouse (14+ years older) as mother and father. The named lineages, the lord's family and the bailiff come at the first
 * season after loading.
 */
import { TRAIT_KEYS, TRAIT_POPULATION, type PersonTraits } from "../../content/personTraits";
import { PORTRAIT_POOL } from "../../content/portraitPool";

type Row = Record<string, unknown> & { readonly id: string; readonly householdId: string; readonly role: string; readonly sex: string;
  readonly birthYear: number; readonly portraitIdentity: string };

const TRAITS_OF_IDENTITY = new Map<string, Partial<PersonTraits>>();
for (const entry of PORTRAIT_POOL) if (!TRAITS_OF_IDENTITY.has(entry.identityId)) TRAITS_OF_IDENTITY.set(entry.identityId, entry.traits);

/** A trait not on the face's record: drawn from the population by a hash of the person's id (no game roll). */
function drawn(id: string, index: number): number {
  let hash = 2166136261;
  for (const char of `${id}:${index}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
function traitsOf(row: Row): PersonTraits {
  const known = TRAITS_OF_IDENTITY.get(row.portraitIdentity) ?? {};
  const traits: Record<string, unknown> = {};
  TRAIT_KEYS.forEach((key, index) => {
    const value = known[key];
    if (value !== undefined) { traits[key] = value; return; }
    const entries = TRAIT_POPULATION[key] as unknown as readonly (readonly [unknown, number])[];
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let left = drawn(row.id, index) % total;
    traits[key] = entries.find(([, weight]) => { if (left < weight) return true; left -= weight; return false; })![0];
  });
  return traits as unknown as PersonTraits;
}

function promotePeople(people: readonly Row[], faction: boolean): Row[] {
  const byHousehold = new Map<string, Row[]>();
  for (const row of people) byHousehold.set(row.householdId, [...(byHousehold.get(row.householdId) ?? []), row]);
  const parents = new Map<string, { motherId?: string; fatherId?: string }>();
  if (!faction) for (const [householdId, members] of byHousehold) {
    if (householdId === "manor") continue;
    const couple = members.filter(row => row.role === "head" || row.role === "spouse");
    for (const child of members.filter(row => row.role === "child")) {
      const mother = couple.find(row => row.sex === "female" && child.birthYear - row.birthYear >= 14);
      const father = couple.find(row => row.sex === "male" && child.birthYear - row.birthYear >= 14);
      parents.set(child.id, { ...(mother === undefined ? {} : { motherId: mother.id }), ...(father === undefined ? {} : { fatherId: father.id }) });
    }
  }
  const lineage = new Map<string, string>();
  const lineageOf = (row: Row): string => {
    if (faction) return row.householdId;
    const known = lineage.get(row.id);
    if (known !== undefined) return known;
    const link = parents.get(row.id);
    const father = link?.fatherId === undefined ? undefined : people.find(other => other.id === link.fatherId);
    const mother = link?.motherId === undefined ? undefined : people.find(other => other.id === link.motherId);
    const head = row.role === "child" ? byHousehold.get(row.householdId)?.find(other => other.role === "head") : undefined;
    const id = father !== undefined ? lineageOf(father) : mother !== undefined ? lineageOf(mother) : head !== undefined && head.id !== row.id ? lineageOf(head) : `lin:${row.id}`;
    lineage.set(row.id, id);
    return id;
  };
  // A person made by an earlier step of this load (v15 → v16 builds the town's persons with today's rules) already has
  // their traits, lineage and parents: kept as made.
  return people.map(row => (row.traits !== undefined && row.lineageId !== undefined ? row
    : { ...row, ...(parents.get(row.id) ?? {}), lineageId: lineageOf(row), traits: traitsOf(row) }));
}

export function migrateV23ToV24(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v23 save must be an envelope object");
  const envelope = input as { readonly state?: Record<string, unknown> };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v23 save has no state");
  const state = envelope.state;
  const persons = state.persons as { readonly people: readonly Row[]; readonly past: readonly Row[] } | undefined;
  const factions = state.factions as { readonly people: readonly Row[] } | undefined;
  const next = {
    ...state,
    ...(persons === undefined ? {} : { persons: { ...persons, people: promotePeople(persons.people, false), past: promotePeople(persons.past, false) } }),
    ...(factions === undefined ? {} : { factions: { ...factions, people: promotePeople(factions.people, true) } }),
  };
  return { ...envelope, schemaVersion: 24, state: next };
}
