import { GIVEN_NAMES_KO } from "../../content/personNames.ko";
import type { GameState } from "../../engine/engine.types";
import { estatePerson } from "../../engine/estates";
import type { HistoryRecord } from "../../engine/history.types";
import { personById, personDisplayName } from "../../engine/persons";
import type { Person } from "../../engine/persons.types";
import { FAMILY_NEWS_COPY as COPY } from "./familyNewsCopy.ko";

// PLAY-2 (Astra's second lord-mode play, friction 9: "a first child" with no name, the parents told differently from
// screen to screen): the people a birth, a marriage or a death names — read from the record itself (its subject and its
// params: `person.born`'s mother and father, `marriage.contracted`'s groom and bride, `marriage.child_born`'s child, bride
// and father; PLAY-2 §4: `person.married`'s and `person.died`'s `spouseId`), each by the person's own display name, and
// whether a biography can open on them (a person of the town, alive or past). A record written before the engine gave
// these ids names only the people it gives (the first child's mother, the one married, the dead): nothing is inferred
// beyond what the records give (a parent the engine records wrongly is shown as recorded).

export type FamilyRole = "child" | "mother" | "father" | "groom" | "bride" | "spouse" | "deceased";
export type FamilyPerson = Readonly<{ role: FamilyRole; personId: string; name: string;
  /** The given name alone, read in Korean (a lord's moment's chip: the whole names are in its record's chronicle). */
  given: string;
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
  const spouse = idOf(params.spouseId);
  switch (record.template) {
    case "person.born": parts.push(["child", subject], ["mother", idOf(params.motherId)], ["father", idOf(params.fatherId)]); break;
    // The one married in and the household's head they married, as the groom and the bride (an older record: the one married in).
    case "person.married": if (spouse === null) parts.push(["spouse", subject]); else parts.push(...couple(state, subject, spouse)); break;
    case "person.died": parts.push(["deceased", subject], ["spouse", spouse]); break;
    case "marriage.contracted": parts.push(["groom", idOf(params.groom)], ["bride", idOf(params.bride)]); break;
    case "marriage.bride_arrived": parts.push(["bride", idOf(params.bride)]); break;
    case "marriage.brother_in_law_born": parts.push(["child", idOf(params.brotherInLaw)]); break;
    // An older record names only the bride: the child and its father are not guessed.
    case "marriage.child_born": parts.push(["child", idOf(params.child)], ["mother", idOf(params.bride)], ["father", idOf(params.father)]); break;
  }
  return parts.flatMap(([role, id]): FamilyPerson[] => {
    if (id === null) return [];
    const town = townPerson(state, id);
    const person = town ?? otherPerson(state, id);
    return person === undefined ? [] : [{ role, personId: person.id, name: personDisplayName(person), given: GIVEN_NAMES_KO[person.givenName] ?? person.givenName,
      biography: town !== undefined }];
  });
}

/** A person outside the town's own lists: the lord's family's, or a neighbour house's (a bride before she came). */
const otherPerson = (state: GameState, id: string): Person | undefined => personById(state, id) ?? estatePerson(state, id);

/** A marriage's two by their sex, the groom first. */
function couple(state: GameState, one: string | null, other: string): [FamilyRole, string | null][] {
  const parts: [FamilyRole, string | null][] = [one, other].map(id => [id !== null && (townPerson(state, id) ?? otherPerson(state, id))?.sex === "female" ? "bride" : "groom", id]);
  return parts[0]![0] === "bride" && parts[1]![0] === "groom" ? [parts[1]!, parts[0]!] : parts;
}

/** The people in one line ("아이 니컬러스 드 해버럴 · 어머니 …"), leaving out `except` (the card's own person); `given`: by
 * their given names ("아이 니컬러스 · 어머니 애그니스 · 아버지 애덤"). */
export function familyLine(people: readonly FamilyPerson[], except: string | null = null, given = false): string | null {
  const shown = people.filter(person => person.personId !== except);
  return shown.length === 0 ? null : shown.map(person => COPY.named(COPY.roles[person.role], given ? person.given : person.name)).join(COPY.joiner);
}

/** A record's sentence with the people it names after it (unchanged when it names nobody beyond `except`). */
export function withFamily(state: GameState, record: FamilyRecord, sentence: string, except: string | null = null): string {
  const line = familyLine(familyPeople(state, record), except);
  return line === null ? sentence : COPY.withPeople(sentence, line);
}
