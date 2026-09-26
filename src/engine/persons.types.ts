/**
 * PERSON-0 persons v0 (spec docs/design/persons.md PS-1…PS-9, save v16): the people of the town. Every resident of a
 * house is a person with a name, a sex, a birth year, a household role, a class, a trade and a portrait identity;
 * the lord's steward lives in the manor household. The living in town are `people`; the dead and those who left are
 * kept in `past` for their biographies.
 */
export type PersonSex = "female" | "male";
/** PS-3: child < 14 · youth 14–29 · adult 30–54 · elder 55+. */
export type PersonAgeBand = "child" | "youth" | "adult" | "elder";
/** Matches the portrait pool's classes. */
export type PersonClassBand = "labour" | "poor_servant" | "artisan" | "merchant" | "gentry" | "clerical";
export type PersonBuild = "thin" | "average" | "heavy";
/** PS-1: the person's place in the household (offices are tags: `reeve`, `manager:<buildingId>`, `petitioner:<petitionId>`). */
export type PersonRole = "head" | "spouse" | "child" | "kin" | "steward";
export type DeathCause = "age" | "famine" | "fire" | "plague";

/** The manor household (the lord's steward). */
export const MANOR_HOUSEHOLD = "manor";

export interface Person {
  /** `p-000001`, in order. */
  readonly id: string;
  readonly givenName: string;
  readonly surname?: string;
  /** PS-2: byname that tells namesakes in the town apart ("the elder", "le Rous"). */
  readonly epithet?: string;
  readonly sex: PersonSex;
  readonly birthYear: number;
  /** A house's building id, or `manor`. */
  readonly householdId: string;
  readonly role: PersonRole;
  readonly classBand: PersonClassBand;
  readonly occupation: string;
  readonly build: PersonBuild;
  readonly hair: string;
  readonly alive: boolean;
  readonly deathYear?: number;
  readonly deathCause?: DeathCause;
  /** The year the person left the town (alive, gone). */
  readonly leftYear?: number;
  /** PS-5: the portrait identity (its stage follows the person's age). */
  readonly portraitIdentity: string;
  readonly tags: readonly string[];
}

export interface PersonState {
  /** The living in town (houses and the manor), in id order. */
  readonly people: readonly Person[];
  /** The dead and those who left, in the order they went. */
  readonly past: readonly Person[];
  readonly nextOrdinal: number;
  /** PS-4: the year the reeve was last chosen. */
  readonly reeveYear?: number;
}
