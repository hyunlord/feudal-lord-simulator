import type { GameState } from "../../engine/engine.types";
import { estatePerson } from "../../engine/estates";
import type { HistoryRecord } from "../../engine/history.types";
import { personById, personDisplayName } from "../../engine/persons";
import type { Person } from "../../engine/persons.types";
import { calendar, scenarioOf } from "../../engine/scenarioState";
import { FAMILY_NEWS_COPY as COPY } from "./familyNewsCopy.ko";

// PLAY-2 (Astra's second lord-mode play, friction 9: "a first child" with no name, the parents told differently from
// screen to screen): the people a birth, a marriage or a death names — read from the record itself (its subject and its
// params: `person.born`'s mother and father, `marriage.contracted`'s groom and bride, `marriage.child_born`'s bride),
// each by the person's own display name, and whether a biography can open on them (a person of the town, alive or past).
// `marriage.child_born` names only the bride: its child is the town's person whose mother she is, born in the record's
// year (the youngest, when more were) — a lookup, not a rule. Nothing is inferred beyond what the records and the persons
// give (a parent the engine records wrongly is shown as recorded: engine request, docs/requests/engine-play2-reads.md).

export type FamilyRole = "child" | "mother" | "father" | "groom" | "bride" | "spouse" | "deceased";
export type FamilyPerson = Readonly<{ role: FamilyRole; personId: string; name: string;
  /** A biography opens on this person (a town person, not a neighbour's house only). */
  biography: boolean }>;

/** A record as these read it (the marriage's timeline passes its own event: no subject). */
type FamilyRecord = Pick<HistoryRecord, "template" | "params" | "tick"> & Partial<Pick<HistoryRecord, "subject">>;

const FAMILY_TEMPLATES: ReadonlySet<string> = new Set(["person.born", "person.married", "person.died", "marriage.contracted", "marriage.bride_arrived", "marriage.child_born",
  "marriage.brother_in_law_born"]);

const idOf = (value: unknown): string | null => typeof value === "string" && value !== "" ? value.replace(/^person:/, "") : null;

function townPerson(state: GameState, id: string): Person | undefined {
  return state.persons?.people.find(person => person.id === id) ?? state.persons?.past.find(person => person.id === id);
}

/** The people this record names, in the record's order; [] for any other record. */
export function familyPeople(state: GameState, record: FamilyRecord): readonly FamilyPerson[] {
  if (!FAMILY_TEMPLATES.has(record.template)) return [];
  const params = record.params ?? {};
  const subject = record.subject?.type === "person" ? record.subject.id : null;
  const parts: [FamilyRole, string | null][] = [];
  switch (record.template) {
    case "person.born": parts.push(["child", subject], ["mother", idOf(params.motherId)], ["father", idOf(params.fatherId)]); break;
    case "person.married": parts.push(["spouse", subject]); break;
    case "person.died": parts.push(["deceased", subject]); break;
    case "marriage.contracted": parts.push(["groom", idOf(params.groom)], ["bride", idOf(params.bride)]); break;
    case "marriage.bride_arrived": parts.push(["bride", idOf(params.bride)]); break;
    case "marriage.brother_in_law_born": parts.push(["child", idOf(params.brotherInLaw)]); break;
    case "marriage.child_born": {
      const bride = idOf(params.bride);
      const year = calendar(record.tick, scenarioOf(state).startYear).year;
      const child = bride === null ? undefined : [...(state.persons?.people ?? []), ...(state.persons?.past ?? [])]
        .filter(person => person.motherId === bride && person.birthYear === year).sort((a, b) => b.id.localeCompare(a.id))[0];
      parts.push(["child", child?.id ?? null], ["mother", bride], ["father", child?.fatherId ?? null]);
      break;
    }
  }
  return parts.flatMap(([role, id]): FamilyPerson[] => {
    if (id === null) return [];
    const town = townPerson(state, id);
    const person = town ?? personById(state, id) ?? estatePerson(state, id);
    return person === undefined ? [] : [{ role, personId: person.id, name: personDisplayName(person), biography: town !== undefined }];
  });
}

/** The people in one line ("아이 니컬러스 · 어머니 앨리스 · 아버지 윌리엄"), leaving out `except` (the card's own person). */
export function familyLine(people: readonly FamilyPerson[], except: string | null = null): string | null {
  const shown = people.filter(person => person.personId !== except);
  return shown.length === 0 ? null : shown.map(person => COPY.named(COPY.roles[person.role], person.name)).join(COPY.joiner);
}

/** A record's sentence with the people it names after it (unchanged when it names nobody beyond `except`). */
export function withFamily(state: GameState, record: FamilyRecord, sentence: string, except: string | null = null): string {
  const line = familyLine(familyPeople(state, record), except);
  return line === null ? sentence : COPY.withPeople(sentence, line);
}
