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
export type DeathCause = "age" | "deposed" | "famine" | "fire" | "plague";

import type { PersonTraits } from "../content/personTraits";

/** PERSON-1a (LN-10): a person's passing state — ill, injured, with child, away on pilgrimage (the bailiff is an office tag). */
export type PersonConditionKind = "sick" | "injury" | "pregnant" | "pilgrim";
export interface PersonCondition {
  readonly kind: PersonConditionKind;
  readonly since: number;
  /** The tick it ends (a pregnancy ends sooner at the household's next birth). */
  readonly until: number;
}

/** PERSON-1a (LN-5): a lineage with a name — the lord's house, a faction's, a town family of note — and its portrait set. */
export type NamedLineageKind = "lord" | "overlord" | "neighbour" | "merchant" | "reeve" | "miller";
export interface NamedLineage {
  readonly id: string;
  readonly kind: NamedLineageKind;
  /** The lineage portrait set it draws its faces from (L1–L8), or null (no set: trait matching). */
  readonly set: string | null;
  readonly since: number;
  /** LN-7: the set's places (identity → person id) already given. */
  readonly slots: Readonly<Record<string, string>>;
}

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
  /** PERSON-1a (LN-2): the parents, when the person was born in town (or inferred in the household, save v24). */
  readonly motherId?: string;
  readonly fatherId?: string;
  /** LN-5: the lineage (the father's; a founder's own `lin:<id>`; a named lineage keeps its id). */
  readonly lineageId: string;
  /** LN-1: the traits born with (from the parents, or the population). */
  readonly traits: PersonTraits;
  /** LN-10: ill, injured, with child or on pilgrimage, until a tick. */
  readonly condition?: PersonCondition;
  /** LN-4: whose name a child born in town was given (absent: the common names). */
  readonly nameFrom?: NameOrigin;
  /** LN-4: the godparent the name came from. */
  readonly godparentId?: string;
}

/** LN-4: where a child's name came from. */
export type NameOrigin = "father" | "grandfather" | "mother" | "grandmother" | "godparent";

export interface PersonState {
  /** The living in town (houses and the manor), in id order. */
  readonly people: readonly Person[];
  /** The dead and those who left, in the order they went. */
  readonly past: readonly Person[];
  readonly nextOrdinal: number;
  /** PS-4: the year the reeve was last chosen. */
  readonly reeveYear?: number;
  /** PERSON-1a (LN-5): the lineages with a name, in the order they were named. */
  readonly lineages?: readonly NamedLineage[];
  /** LN-5: reeve terms by lineage (a lineage that gave two reeves is named). */
  readonly reeveTerms?: Readonly<Record<string, number>>;
  /** LN-9: the lord's family's own ordinal (`m-000001`), apart from the town's so the town's rolls stay as they were. */
  readonly lordOrdinal?: number;
  /** LN-10 / PS-4: the year the bailiff was last appointed. */
  readonly bailiffYear?: number;
}
