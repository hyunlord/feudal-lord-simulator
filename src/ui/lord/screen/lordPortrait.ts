import type { CSSProperties } from "react";
import { PORTRAIT_POOL } from "../../../content/portraitPool";
import type { GameState } from "../../../engine/engine.types";
import type { Person } from "../../../engine/persons.types";
import { personRow, type PersonRow } from "../../persons/personModels";
import { portraitStyle } from "../../portraitArt";

// LM-R2 ("담비 없는 L3"): ermine is the earl's house's and royalty's only (docs/CHARTER.md; art bible L6). The faces
// that wear it — pool 3's earl house (I101–I103) and lineage L6 — never stand for the lord (L3 gentry) or any other
// gentry on a lord screen. Every portrait a lord screen draws goes through here (tests/lmr2LordPortraits.test.ts):
// an ermine face on anyone outside the earl's own house is drawn as no face (the name and line stay).

const ERMINE = new Set(PORTRAIT_POOL.filter(entry => entry.faction === "earl_house" || entry.lineage === "L6").map(entry => entry.identityId));
const IDENTITY = new Map(PORTRAIT_POOL.map(entry => [entry.id, entry.identityId]));
/** A portrait (entry id or identity id) that wears ermine. */
export const ermineIdentity = (portraitId: string): boolean => ERMINE.has(IDENTITY.get(portraitId) ?? portraitId.replace(/_(?:baby|toddler|child|young|mature|old)$/, ""));
/** The earl's own house: the overlord faction's people (FACTION-0 households `faction:<id>`). */
const earlsHouse = (person: Pick<Person, "householdId">): boolean => person.householdId === "faction:overlord";

export type LordPersonRow = Omit<PersonRow, "portraitId"> & { readonly portraitId: string | null };

/** A person as a lord screen's row: the town's own row, its face withheld when it would put ermine on the wrong house. */
export function lordPersonRow(state: GameState, person: Person): LordPersonRow {
  const row = personRow(state, person);
  return ermineIdentity(row.portraitId) && !earlsHouse(person) ? { ...row, portraitId: null } : row;
}

/** The row's portrait as a `size` px background (null: no face — the screen shows the name alone). */
export function lordPortraitStyle(row: LordPersonRow, size: number): CSSProperties | null {
  return row.portraitId === null ? null : portraitStyle(row.portraitId, size);
}
