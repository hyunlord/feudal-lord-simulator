/**
 * v54 is SUIT-THREAD's defence (decisions DTR-22, DTR-23) and Astra lordplay2's fixes: a piece's or estate's remembered
 * right (`former`), a novel disseisin's claim (`novel`), the lord's defence in a suit (`defenceEvidence`,
 * `defencePatron`, `defenceSupport`, `settled`, `heldTick`, `fast`), the forcible entries forewarned
 * (`estates.threats`) and a will's lapsed answer (`marriage.willLapsed`) — all new and optional: a v53 save has none.
 * One correction: a marriage's child born to a groom who is not the lord was kept as the lord's child (role `child`);
 * it becomes kin of the house (its parents stay its father and mother).
 */
interface PersonLike { readonly id?: unknown; readonly role?: unknown; readonly fatherId?: unknown; readonly tags?: unknown }

export function migrateV53ToV54(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v53 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v53 save has no state");
  const state = envelope.state as { readonly persons?: { readonly people?: readonly PersonLike[] } };
  const people = state.persons?.people;
  if (!Array.isArray(people)) return { ...envelope, schemaVersion: 54 };
  const byId = new Map(people.map(person => [person.id, person] as const));
  const lordFamily = (person: PersonLike) => Array.isArray(person.tags) && person.tags.includes("lord-family");
  let changed = false;
  const fixed = people.map(person => {
    if (person.role !== "child" || !lordFamily(person) || typeof person.fatherId !== "string") return person;
    const father = byId.get(person.fatherId);
    if (father === undefined || !lordFamily(father) || father.role === "head") return person;
    changed = true;
    const fatherKin = (Array.isArray(father.tags) ? father.tags as string[] : []).find(tag => tag.startsWith("lord-kin:"))?.slice("lord-kin:".length);
    const kin = father.role === "child" ? "grandchild" : `${fatherKin ?? "kin"}_child`;
    return { ...person, role: "kin", tags: [...(person.tags as string[]), `lord-kin:${kin}`] };
  });
  if (!changed) return { ...envelope, schemaVersion: 54 };
  return { ...envelope, schemaVersion: 54, state: { ...state, persons: { ...state.persons, people: fixed } } };
}
