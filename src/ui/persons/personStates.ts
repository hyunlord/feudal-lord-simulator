import type { CSSProperties } from "react";
import { PRESSURE_BALANCE } from "../../content/balanceConfig";
import type { GameState } from "../../engine/engine.types";
import type { HistoryRecord } from "../../engine/history.types";
import { inTown, personById } from "../../engine/persons";
import { persons } from "../../engine/personsApi";
import { MANOR_HOUSEHOLD, type Person, type PersonConditionKind } from "../../engine/persons.types";
import { assetUrlForBase } from "../../render/worldAssets";
import { WAVE23_IMAGES } from "../../render/wave23ArtManifest.generated";

// INSTALL-23 ④ person-state ornaments (Wave 23 `person_state`, docs: the artist's records/person-state-review.md): one
// ornament per portrait, drawn over the portrait frame's bottom-right (the art is a full 96 / 48 px transparent canvas
// with the ornament in its lower right, outside the face's protected circle), and for a death the portrait greyscale
// in code under the candle. Pure: the screens draw what this returns.
//
// Priority (one ornament; the first that holds wins):
//   dead > hunger > sick > injury > mourning > child_born > pregnant > marriage > pilgrim > steward > bailiff > reeve
// — a death first (it ends every other state); then what the lord can answer now (a household short of food) and
// bodily harm; then the season's family events, grief before joy; a pilgrimage (away); the lasting offices last (the
// card and biography also write them in words).
export const PERSON_STATES = [
  "dead", "hunger", "sick", "injury", "mourning", "child_born", "pregnant", "marriage", "pilgrim", "steward", "bailiff", "reeve",
] as const;
export type PersonStateId = (typeof PERSON_STATES)[number];

/** A season's ticks: mourning, a marriage and a child born show for this long after the ledger's record. */
export const PERSON_STATE_WINDOW_TICKS = PRESSURE_BALANCE.seasonTicks;

type Reader = (person: Person) => readonly PersonStateId[];

/** UI-7: the ornament of each passing state the engine keeps (`persons.condition`, PERSON-1a LN-10). */
const CONDITION_STATES: Readonly<Record<PersonConditionKind, PersonStateId>> = { sick: "sick", injury: "injury", pregnant: "pregnant", pilgrim: "pilgrim" };

/** The ledger's person records of the last season (records are appended in tick order: read from the end). */
function recentPersonRecords(state: Pick<GameState, "history" | "tick">): readonly HistoryRecord[] {
  const records = state.history?.records ?? [];
  const recent: HistoryRecord[] = [];
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index]!;
    if (state.tick - record.tick >= PERSON_STATE_WINDOW_TICKS) break;
    if (record.tick <= state.tick && record.kind === "person") recent.push(record);
  }
  return recent;
}

/** The household a person record belongs to: the person's own (living or gone), else the record's household actor. */
function recordHousehold(state: GameState, record: HistoryRecord): string | null {
  if (record.subject.type === "person") {
    const person = personById(state, record.subject.id);
    if (person !== undefined) return person.householdId;
  }
  return record.actors?.find(actor => actor.type === "household")?.id ?? null;
}

/**
 * The derivable states of the town's people, one ledger read for many portraits (a house's members, a petition's
 * heads). The rules:
 *  - dead: `alive` is false.
 *  - hunger: the person's house is short of food (the engine's FP-3 `foodShortSinceTick`, the same signal the map's
 *    cold-house sign reads), and the household has not left it.
 *  - mourning: a `person.died` record within one season for someone else of the same household (not the manor: the
 *    steward's office has no kin).
 *  - child_born: a `person.born` record within one season in the person's household, and the person is its head or
 *    the head's spouse (the child's parents; the child itself does not wear it).
 *  - marriage: a `person.married` record within one season: its subject (the spouse who joined) and the head of that
 *    household.
 *  - sick, injury, pregnant, pilgrim (UI-7, PERSON-1a LN-10): the person's passing state now (`persons.condition`).
 *  - steward: role `steward`; bailiff (UI-7): the `bailiff` tag; reeve: the `reeve` tag.
 * Someone who left the town (alive, gone) wears nothing.
 */
export function personStatesReader(state: GameState): Reader {
  const records = recentPersonRecords(state);
  const houses = new Map(state.houses.map(house => [house.buildingId, house]));
  const died: { id: string; household: string | null }[] = [];
  const born: { id: string; household: string | null }[] = [];
  const married: { id: string; household: string | null }[] = [];
  for (const record of records) {
    const entry = { id: record.subject.id, household: recordHousehold(state, record) };
    if (record.template === "person.died") died.push(entry);
    else if (record.template === "person.born") born.push(entry);
    else if (record.template === "person.married") married.push(entry);
  }
  return person => {
    if (!person.alive) return ["dead"];
    if (!inTown(person)) return [];
    const found = new Set<PersonStateId>();
    const house = houses.get(person.householdId);
    if (house !== undefined && house.foodShortSinceTick !== undefined && house.abandonedTick === undefined) found.add("hunger");
    if (person.householdId !== MANOR_HOUSEHOLD && died.some(entry => entry.id !== person.id && entry.household === person.householdId)) found.add("mourning");
    const parent = person.role === "head" || person.role === "spouse";
    if (parent && born.some(entry => entry.id !== person.id && entry.household === person.householdId)) found.add("child_born");
    if (married.some(entry => entry.id === person.id || (person.role === "head" && entry.household === person.householdId))) found.add("marriage");
    const condition = persons.condition(state, person);
    if (condition !== null) found.add(CONDITION_STATES[condition.kind]);
    if (person.role === "steward") found.add("steward");
    if (person.tags.includes("bailiff")) found.add("bailiff");
    if (person.tags.includes("reeve")) found.add("reeve");
    return PERSON_STATES.filter(id => found.has(id));
  };
}

/** Every derivable state of one person, in priority order. */
export function derivedPersonStates(state: GameState, person: Person): readonly PersonStateId[] {
  return personStatesReader(state)(person);
}

/** The one ornament a portrait wears: the first of the states in priority order (null for none). */
export function topPersonState(states: readonly PersonStateId[]): PersonStateId | null {
  return PERSON_STATES.find(id => states.includes(id)) ?? null;
}

/** The person's ornament now (null for none). */
export function personOrnament(state: GameState, person: Person, reader: Reader = personStatesReader(state)): PersonStateId | null {
  return topPersonState(reader(person));
}

const ornamentUrl = (id: PersonStateId, size: 48 | 96) => assetUrlForBase(WAVE23_IMAGES[`${id}_${size}`].url, import.meta.env?.BASE_URL ?? "/");

/**
 * The ornament layer over a `size` px portrait (the art's canvas is the portrait's square): a chip's (up to 48 px) the
 * 48 px art at 1x and the 96 at 2x, a card's or a biography's the 96 px art.
 */
export function personStateOrnamentStyle(id: PersonStateId, size: number): CSSProperties {
  const backgroundImage = size <= 48 ? `image-set(url("${ornamentUrl(id, 48)}") 1x, url("${ornamentUrl(id, 96)}") 2x)` : `url("${ornamentUrl(id, 96)}")`;
  return { backgroundImage, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" };
}

/** The class a portrait takes for its state: a death draws the face greyscale (the candle keeps its colour). */
export const personPortraitStateClass = (id: PersonStateId | null | undefined) => id === "dead" ? "person-portrait--dead" : "";
