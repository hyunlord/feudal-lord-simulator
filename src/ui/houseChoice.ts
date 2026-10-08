// LM-R3 (HOUSE-1, MNR-3): the new game's house choice — one of the lordship's twenty house names and the arms drawn
// for it. The engine takes the pair as `NewGameOptions.house` and makes it the lord's first house in every mode; the
// screens draw its arms as `armsRecipe(armsHeraldrySeed(arms), MANOR_HOUSEHOLD)`, as the lordship's screens do.
// Arms candidates are ids, deterministic per name: `<name-key>`, `<name-key>-2`, `<name-key>-3`, … — the default house's
// key is its own arms' id (`haverel`), so de Haverel's first candidate is its arms.
import { GENTRY_NAMES_KO } from "../content/gentryNames";
import { DEFAULT_PLAYER_HOUSE, LORD_HOUSE_NAMES } from "../content/lordshipConfig";
import { armsHeraldrySeed } from "../engine/lordshipState";
import { MANOR_HOUSEHOLD } from "../engine/persons.types";
import { armsRecipe, type ArmsRecipe } from "./heraldry/heraldry";

export type HouseChoice = { readonly name: string; readonly arms: string };

/** Arms candidates side by side on one page of the choice. */
export const ARMS_PAGE_SIZE = 4;

/** The default house (HOUSE-1): de Haverel with its `haverel` arms. */
export const DEFAULT_HOUSE_CHOICE: HouseChoice = { name: DEFAULT_PLAYER_HOUSE.name, arms: DEFAULT_PLAYER_HOUSE.arms };

/** The twenty names, in the lordship's order, each with its Korean reading. */
export function houseNames(): readonly { readonly name: string; readonly ko: string }[] {
  return LORD_HOUSE_NAMES.map(name => ({ name, ko: GENTRY_NAMES_KO[name] ?? name }));
}

/** The name's key for arms ids: lower case, letters only, without the particle "de" ("de Haverel" → "haverel"). */
export function houseNameKey(name: string): string {
  return name.toLowerCase().replace(/^de\s+/, "").replace(/[^a-z]/g, "");
}

/** The `index`-th arms id (from 0) for the name: the key, then the key with -2, -3, … */
export function armsCandidate(name: string, index: number): string {
  const key = houseNameKey(name);
  return index === 0 ? key : `${key}-${index + 1}`;
}

/** The arms ids on page `page` (from 0) of the name's candidates. */
export function armsCandidates(name: string, page: number): readonly string[] {
  return Array.from({ length: ARMS_PAGE_SIZE }, (_, at) => armsCandidate(name, page * ARMS_PAGE_SIZE + at));
}

/** Choosing a name takes its first arms (the default house's own for de Haverel). */
export function chooseHouseName(name: string): HouseChoice {
  return { name, arms: armsCandidate(name, 0) };
}

/** The arms these ids draw — the lordship screens' recipe for the player's house. */
export function houseArmsRecipe(arms: string): ArmsRecipe {
  return armsRecipe(armsHeraldrySeed(arms), MANOR_HOUSEHOLD);
}

