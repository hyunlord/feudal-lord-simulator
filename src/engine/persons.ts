/**
 * PERSON-0 persons v0 (spec docs/design/persons.md PS-1…PS-9). The residents of every house are persons.
 *
 * - PS-1 the living in a house are exactly its `residents`; the household's adults (14+) and children follow from
 *   their ages, and the town's labour is its adults.
 * - PS-3 life: the old growth rule (a fed, watered house below capacity gains a resident) is a birth when the
 *   household has a mother and fewer children than adults, else a relative arriving; the first two residents of an
 *   empty house found a household (head and spouse). The old decline rule (a starving house loses a resident) is a
 *   famine death of the frailest or, among the strong, someone leaving. New: on each season's first day a person dies at
 *   the rate of their age (dearer bread weighs it: dearth × 1.5, famine × 3), and a house that burns kills some within.
 *   The season's deaths fall in households that can grow, and each fills the dead one's place at once (a birth or a
 *   relative): mortality turns the town over without changing its size. A house that cannot grow (no bread or water,
 *   leaving) declines by the old rule, whose losses are the famine deaths above; a fire's dead are residents lost.
 *   A household whose adults are gone passes to its eldest child of 12+, else it breaks up (the children go to kin).
 * - PS-4 offices: the steward (manor household, always), the reeve (a labour household head, chosen each year), a
 *   master for each staffed trade building (the nearest free household head takes the trade), petitioners (2–3
 *   heads, the most substantial first, named on each petition).
 * - PS-2 names and PS-5 portraits are fixed when a person appears (namesakes get bynames; see `personNames.ts`).
 */
import { EPITHETS_KO, GIVEN_NAMES_KO, KING_NAMES_KO, PERSON_NAME_COPY, SURNAMES_KO } from "../content/personNames.ko";
import { FEMALE_GIVEN_NAMES, MALE_GIVEN_NAMES, NAMESAKE_EPITHETS, OCCUPATIONAL_SURNAMES, ORDINAL_EPITHETS, PATRONYMIC_SURNAMES, TOPOGRAPHIC_SURNAMES, type WeightedName } from "../content/personNames";
import { BALANCE, PRESSURE_BALANCE } from "../content/balanceConfig";
import { houseHasFood } from "../population/houseFood";
import type { House } from "../population/population.types";
import type { GameState } from "./engine.types";
import { foodPricePermille } from "./eventSchedule";
import { hashSeed, rollPermille } from "./prng";
import { LEGACY_BALANCE } from "../content/legacyConfig";
import { NEIGHBOUR_SURNAMES } from "../content/gentryNames";
import type { HeirCandidate } from "./legacy.types";
import { choosePortraitIdentity, identityFaction, identityHasBand, identityLineage, portraitFor, setPlaces, youngStageOf, PORTRAIT_BAND, PORTRAIT_MIN_AGE, type PortraitChoice } from "./portraits";
import { lordHouse } from "./lordshipState";
import { calendar, scenarioOf } from "./scenarioState";
import { conscriptsAway } from "./war";
import { countPlagueDead, plagueVictims } from "./plague";
import { factionPerson, petitionFactionLeaders } from "./factions";
import type { PersonTraits } from "../content/personTraits";
import { hairWords, inheritTraits, populationTraits } from "./heredity";
import { MANOR_HOUSEHOLD, type DeathCause, type NameOrigin, type NamedLineage, type Person, type PersonAgeBand, type PersonBuild, type PersonClassBand, type PersonRole, type PersonSex, type PersonState } from "./persons.types";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = BALANCE.TICKS_PER_YEAR;
export const ADULT_AGE = 14;
export const HEIR_AGE = 12;
const YOUTH_END = 29;
const ELDER_AGE = 55;

/** PS-3: yearly death rate by age, permille (a medieval village; dearth and famine weigh it). */
// FIX-11 (item 2): the tail past 85 — at 200‰ a year from 75 on, one in two hundred lived past 100, and a town of
// thousands over 150 years showed 109- and 115-year-olds (QA-010). From 85 350‰, from 95 700‰.
const DEATH_PERMILLE_BY_AGE: readonly (readonly [number, number])[] = [[5, 40], [14, 10], [30, 8], [55, 12], [65, 40], [75, 90], [85, 200], [95, 350], [Infinity, 700]];
/** PS-3: weights on the rate, permille: bread at 1.4× or dearer (dearth), 2× or dearer (famine); a plague when there is one. */
export const MORTALITY_WEIGHTS = { dearth: 1_500, famine: 3_000, plague: 4_000 } as const;
/** PS-3: chance, permille, that a person in a house dies when it burns. */
const FIRE_DEATH_PERMILLE = 60;

/** PS-4: the trade a staffed building's master takes, and its class. */
export const MASTER_TRADES: Readonly<Record<string, { readonly occupation: string; readonly classBand: PersonClassBand }>> = {
  mill: { occupation: "miller", classBand: "artisan" }, sawmill: { occupation: "sawyer", classBand: "artisan" },
  masonry: { occupation: "mason", classBand: "artisan" }, market: { occupation: "chapman", classBand: "merchant" },
  farmstead: { occupation: "husbandman", classBand: "labour" }, logging_camp: { occupation: "woodward", classBand: "labour" },
  quarry: { occupation: "quarrier", classBand: "labour" }, granary: { occupation: "granger", classBand: "labour" },
  storehouse: { occupation: "storekeeper", classBand: "labour" },
};
const STEWARD_SURNAMES = ["de Stratton", "de Ashby", "de Wendover", "de Merton", "de Harpden", "de Cumbe"] as const;

export const EMPTY_PERSONS: PersonState = { people: [], past: [], nextOrdinal: 1 };

export function currentYear(state: Pick<GameState, "tick" | "scenarioId">): number {
  return calendar(state.tick, scenarioOf(state).startYear).year;
}
export function ageOf(person: Pick<Person, "birthYear">, year: number): number {
  return year - person.birthYear;
}
export function ageBandOf(age: number): PersonAgeBand {
  return age < ADULT_AGE ? "child" : age <= YOUTH_END ? "youth" : age < ELDER_AGE ? "adult" : "elder";
}
export function inTown(person: Person): boolean {
  return person.alive && person.leftYear === undefined;
}
/** PS-2: "John atte Well the younger". */
export function displayName(person: Pick<Person, "givenName" | "surname" | "epithet">): string {
  return [person.givenName, person.surname, person.epithet].filter(part => part !== undefined && part !== "").join(" ");
}

/**
 * FIX-6 ③ (decision FX6-4): the name every screen writes — read in Korean (`personNames.ko.ts`): a king by his regnal
 * name, anyone else as byname-epithet, given name, surname ("나이 든 토머스 애덤슨", "윌리엄 드 리종드"). A name missing
 * from the tables is written as it is (the tables are checked to cover every name the game gives).
 */
export function personDisplayName(person: Pick<Person, "givenName" | "surname" | "epithet" | "occupation">): string {
  if (person.occupation === "king") return KING_NAMES_KO[person.givenName] ?? person.givenName;
  const epithet = person.epithet === undefined || person.epithet === "" ? null
    : EPITHETS_KO[person.epithet] ?? (person.epithet.startsWith("no. ") ? PERSON_NAME_COPY.numberedEpithet(String(Number(person.epithet.slice(4)))) : person.epithet);
  const surname = person.surname === undefined || person.surname === "" ? null : SURNAMES_KO[person.surname] ?? person.surname;
  return PERSON_NAME_COPY.fullName(epithet, GIVEN_NAMES_KO[person.givenName] ?? person.givenName, surname);
}

/** A name from a weighted list by a roll (FACTION-0: the factions' people are named so too). */
export function weightedName(names: readonly WeightedName[], roll: number): string {
  const total = names.reduce((sum, entry) => sum + entry.weight, 0);
  let left = roll % total;
  for (const entry of names) { if (left < entry.weight) return entry.name; left -= entry.weight; }
  return names[0]!.name;
}

/**
 * LN-4: a newborn's name by the custom — the first son his father's (50 %) or grandfather's (20 %) name, the first
 * daughter her mother's (40 %) or grandmother's (20 %, the mother's mother, else the father's); else a godparent's
 * (30 %: one of the town's notables, the same sex first); the first daughter's last tenth, a later child's, or a birth
 * with no godparent to hand from the common names (null).
 */
export function newbornCustomName(input: { readonly seed: number; readonly key: number; readonly sex: PersonSex; readonly mother: Person | undefined;
  readonly father: Person | undefined; readonly firstOfSex: boolean; readonly find: (id: string | undefined) => Person | undefined;
  readonly notables: readonly Person[] }): { givenName: string; nameFrom: NameOrigin; godparentId?: string } | null {
  const { seed, key, sex, mother, father } = input;
  if (!input.firstOfSex) return null;
  const roll = rollPermille(seed, "name-custom", key);
  if (sex === "male") {
    if (roll < 500 && father !== undefined) return { givenName: father.givenName, nameFrom: "father" };
    const grandfather = input.find(father?.fatherId);
    if (roll >= 500 && roll < 700 && grandfather !== undefined) return { givenName: grandfather.givenName, nameFrom: "grandfather" };
  } else {
    if (roll < 400 && mother !== undefined) return { givenName: mother.givenName, nameFrom: "mother" };
    const grandmother = input.find(mother?.motherId) ?? input.find(father?.motherId);
    if (roll >= 400 && roll < 600 && grandmother !== undefined) return { givenName: grandmother.givenName, nameFrom: "grandmother" };
    if (roll >= 900) return null;
  }
  const candidates = input.notables.filter(person => person.id !== mother?.id && person.id !== father?.id);
  const sameSex = candidates.filter(person => person.sex === sex);
  const pool = (sameSex.length > 0 ? sameSex : candidates).slice().sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length === 0) return null;
  const godparent = pool[hashSeed(seed, "godparent", key) % pool.length]!;
  return { givenName: godparent.sex === sex ? godparent.givenName : weightedName(sex === "male" ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES, hashSeed(seed, "godparent-name", key)),
    nameFrom: "godparent", godparentId: godparent.id };
}

/** Working copy of the person state within one step (ordinal, the living, the gone). */
/** FIX-11 (item 3): the bynames that only mark a pair of living namesakes; the one left alone drops it. */
const PAIR_EPITHETS = new Set(["the elder", "the younger", "senior", "junior", "the father", "the son"]);

class Town {
  people: Person[];
  past: Person[];
  ordinal: number;
  reeveYear: number | undefined;
  lineages: NamedLineage[];
  reeveTerms: Record<string, number>;
  lordOrdinal: number;
  bailiffYear: number | undefined;
  constructor(readonly seed: number, readonly year: number, state: PersonState) {
    this.people = [...state.people];
    this.past = [...state.past];
    this.ordinal = state.nextOrdinal;
    this.reeveYear = state.reeveYear;
    this.lineages = [...(state.lineages ?? [])];
    this.reeveTerms = { ...(state.reeveTerms ?? {}) };
    this.lordOrdinal = state.lordOrdinal ?? 1;
    this.bailiffYear = state.bailiffYear;
  }
  result(): PersonState {
    return { people: this.people, past: this.past, nextOrdinal: this.ordinal, ...(this.reeveYear === undefined ? {} : { reeveYear: this.reeveYear }),
      ...(this.lineages.length === 0 ? {} : { lineages: this.lineages }), ...(Object.keys(this.reeveTerms).length === 0 ? {} : { reeveTerms: this.reeveTerms }),
      ...(this.lordOrdinal === 1 ? {} : { lordOrdinal: this.lordOrdinal }), ...(this.bailiffYear === undefined ? {} : { bailiffYear: this.bailiffYear }) };
  }
  /** A person by id among the living and the gone. */
  find(id: string | undefined): Person | undefined {
    if (id === undefined) return undefined;
    return this.people.find(person => person.id === id) ?? this.past.find(person => person.id === id);
  }
  household(householdId: string): Person[] {
    return this.people.filter(person => person.householdId === householdId);
  }
  replace(id: string, change: Partial<Person>): void {
    const index = this.people.findIndex(person => person.id === id);
    if (index >= 0) this.people[index] = { ...this.people[index]!, ...change };
  }
  remove(id: string, fate: { readonly died?: DeathCause; readonly left?: true }): void {
    const index = this.people.findIndex(person => person.id === id);
    if (index < 0) return;
    const person = this.people[index]!;
    this.people.splice(index, 1);
    // FIX-11: if the removed person had a paired epithet, the lone survivor loses theirs.
    if (person.epithet !== undefined && PAIR_EPITHETS.has(person.epithet)) {
      const survivors = this.people.filter(p => p.givenName === person.givenName && p.surname === person.surname);
      const survivor = survivors.length === 1 ? survivors[0]! : undefined;
      if (survivor?.epithet !== undefined && PAIR_EPITHETS.has(survivor.epithet)) {
        const at = this.people.indexOf(survivor);
        const { epithet: _dropped, ...rest } = survivor;
        this.people[at] = rest;
      }
    }
    const tags = person.tags.filter(tag => !tag.startsWith("manager:") && tag !== "reeve" && tag !== "bailiff");
    // LN-10: a passing state ends with the life or the stay in town.
    const { condition: _condition, ...kept } = person;
    this.past.push(fate.died !== undefined
      ? { ...kept, alive: false, deathYear: this.year, deathCause: fate.died, tags }
      : { ...kept, leftYear: this.year, tags });
  }

  /**
   * LN-4: a newborn's name by the custom — the first son his father's (50 %) or grandfather's (20 %) name, the first
   * daughter her mother's (40 %) or grandmother's (20 %); else a godparent's (30 %), one of the town's notables; the
   * first daughter's last tenth and the later children's from the common names. Null: the common names.
   */
  customName(sex: PersonSex, key: number, mother: Person | undefined, father: Person | undefined): { givenName: string; nameFrom: NameOrigin; godparentId?: string } | null {
    const siblings = [...this.people, ...this.past].some(person => person.sex === sex
      && ((mother !== undefined && person.motherId === mother.id) || (father !== undefined && person.fatherId === father.id)));
    const notables = this.people.filter(person => person.alive && (person.tags.includes("reeve") || person.tags.includes("bailiff")
      || person.householdId === MANOR_HOUSEHOLD || (person.role === "head" && person.classBand === "merchant")) && ageOf(person, this.year) >= 18);
    return newbornCustomName({ seed: this.seed, key, sex, mother, father, firstOfSex: !siblings, find: id => this.find(id), notables });
  }

  /** PS-2: a unique name in the town; a clash with a living namesake gives both a byname. LN-4: a newborn's by custom first. */
  name(sex: PersonSex, surname: string | undefined, householdId: string, id: string, birthYear: number,
    custom?: { readonly key: number; readonly salt: string; readonly mother?: Person; readonly father?: Person; readonly born: boolean }): { givenName: string; epithet?: string; nameFrom?: NameOrigin; godparentId?: string } {
    const pool = sex === "male" ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES;
    const kin = new Set(this.household(householdId).map(person => person.givenName));
    const key = custom?.key ?? this.ordinal;
    const salt = custom?.salt ?? "person-name";
    const byCustom = custom?.born === true && (custom.mother !== undefined || custom.father !== undefined) ? this.customName(sex, key, custom.mother, custom.father) : null;
    let givenName = byCustom?.givenName ?? weightedName(pool, hashSeed(this.seed, salt, key));
    if (byCustom === null) for (let attempt = 1; attempt < 6 && kin.has(givenName); attempt += 1) givenName = weightedName(pool, hashSeed(this.seed, salt, key, attempt));
    const origin = byCustom === null ? {} : { nameFrom: byCustom.nameFrom, ...(byCustom.godparentId === undefined ? {} : { godparentId: byCustom.godparentId }) };
    const namesakes = this.people.filter(person => person.givenName === givenName && person.surname === surname);
    if (namesakes.length === 0) return { givenName, ...origin };
    const used = new Set(namesakes.map(person => person.epithet));
    const lone = namesakes.length === 1 && namesakes[0]!.epithet === undefined ? namesakes[0]! : undefined;
    if (lone !== undefined) {
      const newerIsYounger = birthYear >= lone.birthYear;
      // FIX-11: father-son → "the father"/"the son" (checked first; father-in-same-household stays father/son).
      const isFatherSon = custom?.father?.id === lone.id;
      if (isFatherSon) {
        this.replace(lone.id, { epithet: "the father" });
        return { givenName, epithet: "the son", ...origin };
      }
      // FIX-11: same household → "senior"/"junior" instead of "the elder"/"the younger".
      if (householdId === lone.householdId) {
        this.replace(lone.id, { epithet: newerIsYounger ? "senior" : "junior" });
        return { givenName, epithet: newerIsYounger ? "junior" : "senior", ...origin };
      }
      this.replace(lone.id, { epithet: newerIsYounger ? "the elder" : "the younger" });
      return { givenName, epithet: newerIsYounger ? "the younger" : "the elder", ...origin };
    }
    const epithet = [...NAMESAKE_EPITHETS, ...ORDINAL_EPITHETS].find(candidate => !used.has(candidate)) ?? `no. ${id.slice(2)}`;
    return { givenName, epithet, ...origin };
  }

  usage(): Map<string, number> {
    const usage = new Map<string, number>();
    for (const person of this.people) usage.set(person.portraitIdentity, (usage.get(person.portraitIdentity) ?? 0) + 1);
    return usage;
  }

  /**
   * LN-2: a child's parents — the ones given (a birth), else for a child of the household its head and spouse where old
   * enough to be (14+ years older): the woman its mother, the man its father.
   */
  parentsOf(fields: { readonly householdId: string; readonly role: PersonRole; readonly birthYear: number; readonly motherId?: string; readonly fatherId?: string }):
    { readonly mother?: Person; readonly father?: Person } {
    if (fields.motherId !== undefined || fields.fatherId !== undefined) {
      const mother = this.find(fields.motherId);
      const father = this.find(fields.fatherId);
      return { ...(mother === undefined ? {} : { mother }), ...(father === undefined ? {} : { father }) };
    }
    if (fields.role !== "child") return {};
    const couple = this.household(fields.householdId).filter(person => (person.role === "head" || person.role === "spouse") && fields.birthYear - person.birthYear >= ADULT_AGE);
    const mother = couple.find(person => person.sex === "female");
    const father = couple.find(person => person.sex === "male");
    return { ...(mother === undefined ? {} : { mother }), ...(father === undefined ? {} : { father }) };
  }

  create(fields: { readonly sex: PersonSex; readonly birthYear: number; readonly householdId: string; readonly role: PersonRole;
    readonly surname?: string; readonly classBand?: PersonClassBand; readonly occupation?: string; readonly tags?: readonly string[];
    readonly motherId?: string; readonly fatherId?: string; readonly traits?: PersonTraits; readonly lineageId?: string;
    /** LN-9: one of the lord's family (its own ordinal, `m-`; the town's ordinal and rolls stay as they were). */
    readonly lord?: true }): Person {
    const lord = fields.lord === true;
    const ordinal = lord ? this.lordOrdinal : this.ordinal;
    const id = `${lord ? "m" : "p"}-${String(ordinal).padStart(6, "0")}`;
    const scope = lord ? "lord" : "town";
    const { mother, father } = this.parentsOf(fields);
    // LN-1 / LN-2: traits from the parents (a child) or the population (a founder or newcomer); the build and the hair's
    // words follow them.
    const traits = fields.traits ?? (mother !== undefined || father !== undefined
      ? inheritTraits(this.seed, scope, ordinal, mother?.traits, father?.traits) : populationTraits(this.seed, scope, ordinal));
    const build: PersonBuild = traits.buildBias;
    const hair = hairWords(traits);
    const born = fields.role === "child" && fields.birthYear === this.year;
    const named = this.name(fields.sex, fields.surname, fields.householdId, id, fields.birthYear,
      { key: ordinal, salt: lord ? "lord-person-name" : "person-name", ...(mother === undefined ? {} : { mother }), ...(father === undefined ? {} : { father }), born });
    const draft = { id, sex: fields.sex, classBand: fields.classBand ?? "labour", build, occupation: fields.occupation ?? (this.year - fields.birthYear >= ADULT_AGE ? "labourer" : "child"),
      tags: fields.tags ?? [], role: fields.role, traits };
    const portraitIdentity = choosePortraitIdentity(this.seed, draft, ageBandOf(this.year - fields.birthYear), this.usage());
    // LN-5: the father's lineage (else the mother's, else the household head's for its child); a newcomer opens one.
    const head = fields.role === "child" ? this.household(fields.householdId).find(person => person.role === "head") : undefined;
    const lineageId = fields.lineageId ?? father?.lineageId ?? mother?.lineageId ?? head?.lineageId ?? `lin:${id}`;
    const person: Person = { ...draft, givenName: named.givenName, ...(fields.surname === undefined ? {} : { surname: fields.surname }),
      ...(named.epithet === undefined ? {} : { epithet: named.epithet }), birthYear: fields.birthYear, householdId: fields.householdId,
      hair, alive: true, portraitIdentity, lineageId, ...(mother === undefined ? {} : { motherId: mother.id }), ...(father === undefined ? {} : { fatherId: father.id }),
      ...(named.nameFrom === undefined ? {} : { nameFrom: named.nameFrom }), ...(named.godparentId === undefined ? {} : { godparentId: named.godparentId }) };
    if (lord) this.lordOrdinal += 1; else this.ordinal += 1;
    this.people.push(person);
    return person;
  }

  /** PS-3: one new resident of a house (a founder, a spouse, a birth or a relative). */
  grow(householdId: string, index: number): void {
    const members = this.household(householdId);
    const roll = hashSeed(this.seed, "household-grow", this.ordinal, index);
    const head = members.find(person => person.role === "head");
    if (head === undefined) {
      // A household forms: its head (mostly a man) takes a surname from a place, a father or a family trade.
      const sex: PersonSex = roll % 10 < 8 ? "male" : "female";
      const kind = (roll >>> 3) % 3;
      const pool = kind === 0 ? TOPOGRAPHIC_SURNAMES : kind === 1 ? Object.values(PATRONYMIC_SURNAMES) : Object.values(OCCUPATIONAL_SURNAMES);
      const surname = pool[(roll >>> 5) % pool.length]!;
      this.create({ sex, birthYear: this.year - 20 - (roll >>> 9) % 21, householdId, role: "head", surname });
      return;
    }
    const spouse = members.find(person => person.role === "spouse");
    if (spouse === undefined && ageOf(head, this.year) >= 16) {
      const sex: PersonSex = head.sex === "male" ? "female" : "male";
      this.create({ sex, birthYear: head.birthYear + ((roll >>> 3) % 9) - 2 + (sex === "female" ? 2 : -2), householdId, role: "spouse", ...(head.surname === undefined ? {} : { surname: head.surname }) });
      return;
    }
    const adults = members.filter(person => ageOf(person, this.year) >= ADULT_AGE).length;
    const children = members.length - adults;
    const mother = members.some(person => person.sex === "female" && ageOf(person, this.year) >= 16 && ageOf(person, this.year) <= 44);
    if (mother && children <= adults) {
      // LN-2 / LN-10: the mother is the woman with child, else the head's or spouse's, else a kinswoman (no father known).
      const women = members.filter(person => person.sex === "female" && ageOf(person, this.year) >= 16 && ageOf(person, this.year) <= 44);
      const bearer = women.find(person => person.condition?.kind === "pregnant") ?? women.find(person => person.role === "head" || person.role === "spouse") ?? women[0]!;
      const husband = bearer.role === "head" || bearer.role === "spouse" ? members.find(person => person.sex === "male" && (person.role === "head" || person.role === "spouse")) : undefined;
      if (bearer.condition?.kind === "pregnant") { const { condition: _ended, ...delivered } = bearer; this.people[this.people.indexOf(bearer)] = delivered; }
      this.create({ sex: roll % 2 === 0 ? "female" : "male", birthYear: this.year, householdId, role: "child", ...(head.surname === undefined ? {} : { surname: head.surname }),
        motherId: bearer.id, ...(husband === undefined ? {} : { fatherId: husband.id }) });
      return;
    }
    // A relative: a young one (14–30), or one time in four a widowed parent (55–70).
    const elder = (roll >>> 8) % 4 === 0;
    this.create({ sex: roll % 2 === 0 ? "female" : "male", birthYear: this.year - (elder ? 55 + (roll >>> 3) % 16 : 14 + (roll >>> 3) % 17), householdId, role: "kin",
      ...(head.surname === undefined ? {} : { surname: head.surname }) });
  }

  /** PS-3: a starving house loses one: the frailest die of hunger; among the strong, a relative or the youngest leaves. */
  shrink(householdId: string): void {
    const members = this.household(householdId);
    if (members.length === 0) return;
    const frail = members.filter(person => { const age = ageOf(person, this.year); return age < 5 || age >= ELDER_AGE; })
      .sort((a, b) => Math.abs(ageOf(b, this.year) - 30) - Math.abs(ageOf(a, this.year) - 30) || a.id.localeCompare(b.id));
    if (frail.length > 0) { this.remove(frail[0]!.id, { died: "famine" }); return; }
    const order: PersonRole[] = ["kin", "child", "spouse", "head"];
    const leaving = [...members].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || b.birthYear - a.birthYear || a.id.localeCompare(b.id))[0]!;
    this.remove(leaving.id, { left: true });
  }

  /** PS-3: a household without a head passes to the spouse, an adult, or the eldest child of 12+. Returns false when it breaks up. */
  succession(householdId: string): boolean {
    const members = this.household(householdId);
    if (members.length === 0 || members.some(person => person.role === "head")) return true;
    const heir = members.find(person => person.role === "spouse")
      ?? [...members].filter(person => ageOf(person, this.year) >= HEIR_AGE).sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id))[0];
    if (heir === undefined) {
      for (const child of members) this.remove(child.id, { left: true });
      return false;
    }
    this.replace(heir.id, { role: "head" });
    return true;
  }
}

function deathPermille(age: number): number {
  return DEATH_PERMILLE_BY_AGE.find(([limit]) => age < limit)![1];
}

/** PS-3: the chance, permille, that a person of `age` dies at a season's start under a weight (1,000 = usual). */
export function seasonDeathPermille(age: number, weight = 1_000): number {
  return Math.ceil(deathPermille(age) * weight / 1_000 / 4);
}

/** PS-3: the season's weight on the death rate, permille. */
function mortalityWeight(state: GameState): number {
  const price = foodPricePermille(state, state.tick);
  return price >= 2_000 ? MORTALITY_WEIGHTS.famine : price >= 1_400 ? MORTALITY_WEIGHTS.dearth : 1_000;
}

/** PS-3: a house whose empty place the growth rule would fill (water, bread, not burnt, abandoned or leaving). */
function canRefill(house: House, tick: number): boolean {
  return house.hasWater && houseHasFood(house) && house.burntTick === undefined && house.abandonedTick === undefined
    && house.leavingSinceTick === undefined && tick > 0;
}

/** PS-1: a house's adults (14+) and children from its people. */
function membersOf(house: House, people: readonly Person[], year: number): House {
  const adults = people.filter(person => ageOf(person, year) >= ADULT_AGE).length;
  const children = people.length - adults;
  const members = house.members;
  if (members !== undefined && members.adults === adults && members.children === children) return house;
  return { ...house, members: { adults, children, seed: members?.seed ?? 0 } };
}

/** PS-1: the town's labour: its adults in houses. */
export function labourPool(state: Pick<GameState, "houses" | "persons" | "population"> & Partial<Pick<GameState, "war">>): number {
  // F2-A (WR-3): the men the commission of array took do not work while they are away.
  const away = conscriptsAway(state);
  if (state.persons === undefined) return Math.max(0, Math.floor(Math.max(0, state.population) * BALANCE.WORKERS_PER_RESIDENT) - away);
  return Math.max(0, state.houses.reduce((sum, house) => sum + (house.members?.adults ?? 0), 0) - away);
}

/** PS-6 (save v16 promotion, new towns): persons for the residents already in the houses, and the steward. */
export function initialPersons(state: GameState): PersonState {
  const town = new Town(state.seed, currentYear(state), EMPTY_PERSONS);
  const houses = [...state.houses].sort((a, b) => a.buildingId.localeCompare(b.buildingId));
  for (const house of houses) {
    const adults = house.members?.adults ?? Math.ceil(house.residents / 2);
    const residents = Math.max(0, house.residents);
    for (let index = 0; index < residents; index += 1) {
      if (index < 2 && index < adults) { town.grow(house.buildingId, index); continue; }
      const roll = hashSeed(state.seed, "initial-member", town.ordinal);
      const head = town.household(house.buildingId).find(person => person.role === "head");
      const surname = head?.surname;
      if (index < adults) town.create({ sex: roll % 2 === 0 ? "female" : "male", birthYear: town.year - ((roll >>> 8) % 4 === 0 ? 55 + (roll >>> 3) % 16 : 14 + (roll >>> 3) % 17), householdId: house.buildingId, role: "kin", ...(surname === undefined ? {} : { surname }) });
      else town.create({ sex: roll % 2 === 0 ? "female" : "male", birthYear: town.year - (roll >>> 3) % ADULT_AGE, householdId: house.buildingId, role: "child", ...(surname === undefined ? {} : { surname }) });
    }
  }
  appointSteward(town);
  return town.result();
}

function appointSteward(town: Town): void {
  if (town.people.some(person => person.role === "steward")) return;
  const roll = hashSeed(town.seed, "steward", town.ordinal);
  town.create({ sex: "male", birthYear: town.year - 35 - roll % 16, householdId: MANOR_HOUSEHOLD, role: "steward", surname: STEWARD_SURNAMES[(roll >>> 4) % STEWARD_SURNAMES.length]!,
    classBand: "gentry", occupation: "steward" });
}

/** PS-4: masters of staffed trade buildings, the nearest free household head. */
function appointMasters(town: Town, state: GameState): void {
  const buildings = new Map(state.buildings.map(building => [building.id, building]));
  // Masters of buildings gone or no longer staffed go back to labour.
  for (const person of [...town.people]) {
    const tag = person.tags.find(entry => entry.startsWith("manager:"));
    if (tag === undefined) continue;
    const building = buildings.get(tag.slice("manager:".length));
    if (building !== undefined && building.workers > 0) continue;
    town.replace(person.id, { tags: person.tags.filter(entry => entry !== tag), occupation: "labourer", classBand: "labour" });
  }
  const managed = new Set(town.people.flatMap(person => person.tags.filter(tag => tag.startsWith("manager:")).map(tag => tag.slice("manager:".length))));
  const homes = new Map(state.buildings.filter(building => building.kind === "house").map(building => [building.id, building]));
  for (const building of [...state.buildings].sort((a, b) => a.id.localeCompare(b.id))) {
    const trade = MASTER_TRADES[building.kind];
    if (trade === undefined || building.workers <= 0 || managed.has(building.id)) continue;
    const free = town.people.filter(person => person.role === "head" && ageOf(person, town.year) >= 18 && !person.tags.some(tag => tag.startsWith("manager:")) && homes.has(person.householdId));
    const distance = (person: Person) => { const home = homes.get(person.householdId)!; return Math.abs(home.tx - building.tx) + Math.abs(home.ty - building.ty); };
    const master = free.sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id))[0];
    if (master === undefined) continue;
    town.replace(master.id, { tags: [...master.tags, `manager:${building.id}`], occupation: trade.occupation, classBand: trade.classBand });
    managed.add(building.id);
  }
}

/** PS-4: the reeve, a labour household head of 25–60, chosen at the year's start (men first, as the manor did). */
function chooseReeve(town: Town): void {
  const current = town.people.find(person => person.tags.includes("reeve"));
  if (current !== undefined && town.reeveYear === town.year) return;
  if (current !== undefined) town.replace(current.id, { tags: current.tags.filter(tag => tag !== "reeve") });
  const candidates = town.people.filter(person => person.role === "head" && person.classBand === "labour" && person.householdId !== MANOR_HOUSEHOLD
    && ageOf(person, town.year) >= 25 && ageOf(person, town.year) <= 60);
  const men = candidates.filter(person => person.sex === "male");
  const pool = (men.length > 0 ? men : candidates).sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length === 0) return;
  const reeve = pool[hashSeed(town.seed, "reeve", town.year) % pool.length]!;
  town.replace(reeve.id, { tags: [...reeve.tags, "reeve"] });
  town.reeveYear = town.year;
  // LN-5: a lineage that gives two reeves is named.
  town.reeveTerms[reeve.lineageId] = (town.reeveTerms[reeve.lineageId] ?? 0) + 1;
}

/**
 * LN-10 / PS-4: the bailiff, the lord's man in the town — an artisan or merchant household head of 25–60 (not the
 * reeve), chosen at the year's start (men first). An office tag only (the manor's work is not simulated).
 */
function chooseBailiff(town: Town): void {
  const current = town.people.find(person => person.tags.includes("bailiff"));
  if (current !== undefined && town.bailiffYear === town.year) return;
  if (current !== undefined) town.replace(current.id, { tags: current.tags.filter(tag => tag !== "bailiff") });
  const candidates = town.people.filter(person => person.role === "head" && person.householdId !== MANOR_HOUSEHOLD && !person.tags.includes("reeve")
    && (person.classBand === "artisan" || person.classBand === "merchant") && ageOf(person, town.year) >= 25 && ageOf(person, town.year) <= 60);
  const men = candidates.filter(person => person.sex === "male");
  const pool = (men.length > 0 ? men : candidates).sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length === 0) return;
  const bailiff = pool[hashSeed(town.seed, "bailiff", town.year) % pool.length]!;
  town.replace(bailiff.id, { tags: [...bailiff.tags, "bailiff"] });
  town.bailiffYear = town.year;
}

/** LN-9: the lord's family — its members of the ruling house (tag `lord-family`, lineage `lord:<house order>`). */
export const LORD_FAMILY_TAG = "lord-family";
const LORD_BIRTH_PERMILLE = 300;

/**
 * LN-9: the ruling house's family lives in the manor (not in the town's count or labour; ids of their own). It forms
 * with the house (the lord of 30–45, his wife, two children); each year's start a wife of 16–44 who has borne fewer than
 * four bears one at 30 %, a lord of 18+ without a wife takes one, a lord who died is followed by his eldest son of 14+
 * (else the eldest child), and a child of 18 other than the heir leaves the manor (a daughter married away, a younger son
 * gone into service or the church: decision LN8). A new house (FL-7) brings its own family; the old one leaves.
 */
function keepLordFamily(town: Town, state: GameState, yearStart: boolean): void {
  const house = lordHouse(state);
  const lineageId = `lord:${house.order}`;
  const houseTag = `lord-house:${house.order}`;
  // A new house (FL-7): the old house's family leaves the manor.
  for (const person of [...town.people]) if (person.tags.includes(LORD_FAMILY_TAG) && !person.tags.includes(houseTag)) town.remove(person.id, { left: true });
  const family = () => town.people.filter(person => person.tags.includes(houseTag));
  const common = { householdId: MANOR_HOUSEHOLD, surname: house.name, classBand: "gentry" as const, lord: true as const, tags: [LORD_FAMILY_TAG, houseTag] };
  if (!town.people.some(person => person.tags.includes(houseTag)) && !town.past.some(person => person.tags.includes(houseTag))) {
    const roll = hashSeed(town.seed, "lord-family", house.order);
    const lord = town.create({ ...common, sex: "male", birthYear: town.year - 30 - roll % 16, role: "head", occupation: "lord", lineageId });
    const lady = town.create({ ...common, sex: "female", birthYear: lord.birthYear + 2 + (roll >>> 4) % 6, role: "spouse", occupation: "lady" });
    for (let child = 0; child < 2; child += 1) {
      town.create({ ...common, sex: (roll >>> (8 + child)) % 2 === 0 ? "male" : "female", birthYear: Math.max(lady.birthYear + 18, town.year - 12 + child * 4 + (roll >>> (10 + child)) % 3),
        role: "child", motherId: lady.id, fatherId: lord.id });
    }
    return;
  }
  if (!yearStart) return;
  let members = family();
  if (members.length === 0) return;
  // A lord who died: his eldest son of 14+ (else the eldest child) takes the house; the widow stays as kin.
  if (!members.some(person => person.role === "head")) {
    const children = members.filter(person => person.role === "child").sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id));
    const heir = children.find(person => person.sex === "male" && ageOf(person, town.year) >= ADULT_AGE) ?? children[0];
    const dead = [...town.past].filter(person => person.tags.includes(houseTag) && person.role === "head" && !person.alive)
      .sort((a, b) => (b.deathYear ?? 0) - (a.deathYear ?? 0) || b.id.localeCompare(a.id))[0];
    const widower = members.find(person => person.role === "spouse");
    const theirs = (person: Person) => dead !== undefined && widower !== undefined && person.alive
      && [person.fatherId, person.motherId].includes(dead.id) && [person.fatherId, person.motherId].includes(widower.id);
    // FIX-9 (decision FX9-3): the courtesy of England — an heiress's husband holds her lands for his life when a child of
    // theirs lives; the child stays the heir.
    if (dead?.sex === "female" && widower !== undefined && [...town.people, ...town.past].some(theirs)) {
      town.replace(widower.id, { role: "head", occupation: widower.sex === "male" ? "lord" : "lady" });
    } else if (heir !== undefined) {
      for (const person of members) if (person.role === "spouse") town.replace(person.id, { role: "kin" });
      town.replace(heir.id, { role: "head", occupation: heir.sex === "male" ? "lord" : "lady" });
    } else {
      // FIX-9 (FX9-3): no child — the dead lord's nearest of the blood (one who left comes home); none, the widowed spouse.
      const kin = dead === undefined ? undefined : nearestBloodKin(town, dead, houseTag);
      const next = kin ?? widower;
      if (next === undefined) return;
      if (kin !== undefined && !town.people.includes(kin)) {
        const { leftYear: _left, ...home } = kin;
        town.past.splice(town.past.indexOf(kin), 1);
        town.people.push({ ...home, householdId: MANOR_HOUSEHOLD });
      }
      if (widower !== undefined && widower !== next) town.replace(widower.id, { role: "kin" });
      town.replace(next.id, { role: "head", occupation: next.sex === "male" ? "lord" : "lady" });
    }
    members = family();
  }
  const head = members.find(person => person.role === "head")!;
  // The heir stays; his brothers and sisters of 18 leave the manor.
  const heir = members.filter(person => person.role === "child" && (person.fatherId === head.id || person.motherId === head.id))
    .sort((a, b) => (a.sex === b.sex ? 0 : a.sex === "male" ? -1 : 1) || a.birthYear - b.birthYear || a.id.localeCompare(b.id))[0];
  for (const person of members) if (person.role === "child" && person !== heir && ageOf(person, town.year) >= 18) town.remove(person.id, { left: true });
  members = family();
  const spouse = members.find(person => person.role === "spouse");
  if (spouse === undefined && ageOf(head, town.year) >= 18) {
    const sex: PersonSex = head.sex === "male" ? "female" : "male";
    town.create({ ...common, sex, birthYear: head.birthYear + (sex === "female" ? 2 : -2) + hashSeed(town.seed, "lord-spouse", town.year) % 5, role: "spouse",
      occupation: sex === "female" ? "lady" : "lord" });
    return;
  }
  const mother = [head, spouse].find(person => person !== undefined && person.sex === "female" && ageOf(person, town.year) >= 16 && ageOf(person, town.year) <= 44);
  const father = [head, spouse].find(person => person !== undefined && person.sex === "male");
  const borne = mother === undefined ? 0 : [...town.people, ...town.past].filter(person => person.motherId === mother.id).length;
  if (mother === undefined || borne >= 4 || rollPermille(town.seed, "lord-birth", town.year) >= LORD_BIRTH_PERMILLE) return;
  if (mother.condition?.kind === "pregnant") { const { condition: _ended, ...delivered } = mother; town.people[town.people.indexOf(mother)] = delivered; }
  town.create({ ...common, sex: hashSeed(town.seed, "lord-birth-sex", town.year) % 2 === 0 ? "female" : "male", birthYear: town.year, role: "child",
    motherId: mother.id, ...(father === undefined ? {} : { fatherId: father.id }) });
}

/** F5-A (LG-3): a candidate of the question carries this tag until chosen (the others leave again). */
export const HEIR_CANDIDATE_TAG = "heir-candidate";

/**
 * F5-A (LG-3): the old lord's heirs, real persons of the family — his eldest living son (in the manor first, else one
 * gone), the husband of his eldest daughter of 16+ (a gentleman of a neighbouring house, who comes with the question),
 * and the eldest son of his brother or sister (who comes with it too; a distant kinsman when he has none).
 */
/**
 * F5-A (LG-3): the lord of the manor — the house's head, else (a house whose heiress died and left her husband, LN-9
 * names no head then) its eldest living adult of the family.
 */
export function manorLord(people: readonly Person[], houseOrder: number, year: number): Person | undefined {
  const family = people.filter(person => person.tags.includes(`lord-house:${houseOrder}`) && person.householdId === MANOR_HOUSEHOLD);
  return family.find(person => person.role === "head")
    ?? family.filter(person => ageOf(person, year) >= ADULT_AGE).sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id))[0];
}

export function offerHeirs(state: GameState): { readonly state: GameState; readonly candidates: readonly HeirCandidate[] } {
  if (state.persons === undefined) return { state, candidates: [] };
  const year = currentYear(state);
  const town = new Town(state.seed, year, state.persons);
  const house = lordHouse(state);
  const head = manorLord(town.people, house.order, year);
  if (head === undefined) return { state, candidates: [] };
  const all = () => [...town.people, ...town.past];
  const byAge = (a: Person, b: Person) => a.birthYear - b.birthYear || a.id.localeCompare(b.id);
  const childrenOf = (id: string) => all().filter(person => person.alive && (person.fatherId === id || person.motherId === id)).sort(byAge);
  const candidates: HeirCandidate[] = [];
  const sons = childrenOf(head.id).filter(person => person.sex === "male");
  const son = sons.find(person => town.people.includes(person)) ?? sons[0];
  if (son !== undefined) candidates.push({ kind: "eldest_son", personId: son.id, throughId: null, relation: "son", created: false });
  const common = { householdId: MANOR_HOUSEHOLD, role: "kin" as const, classBand: "gentry" as const, occupation: "lord", lord: true as const, tags: [HEIR_CANDIDATE_TAG] };
  const roll = hashSeed(state.seed, "heir-candidates", state.tick);
  const daughter = childrenOf(head.id).find(person => person.sex === "female" && ageOf(person, year) >= LEGACY_BALANCE.daughterMinAge);
  if (daughter !== undefined) {
    const [low, high] = LEGACY_BALANCE.husbandOlder;
    const husband = town.create({ ...common, sex: "male", birthYear: daughter.birthYear - low - roll % (high - low + 1),
      surname: NEIGHBOUR_SURNAMES[(roll >>> 4) % NEIGHBOUR_SURNAMES.length]! });
    candidates.push({ kind: "daughter_husband", personId: husband.id, throughId: daughter.id, relation: "husband", created: true });
  }
  const sibling = all().filter(person => person.id !== head.id && ((head.fatherId !== undefined && person.fatherId === head.fatherId)
    || (head.motherId !== undefined && person.motherId === head.motherId))).sort(byAge)[0];
  const [young, old] = LEGACY_BALANCE.nephewAge;
  const nephew = town.create({ ...common, sex: "male", birthYear: year - young - (roll >>> 8) % (old - young + 1),
    surname: sibling === undefined || sibling.sex === "male" ? house.name : NEIGHBOUR_SURNAMES[(roll >>> 12) % NEIGHBOUR_SURNAMES.length]!,
    ...(sibling === undefined ? { lineageId: `lord:${house.order}` } : sibling.sex === "male" ? { fatherId: sibling.id } : { motherId: sibling.id }) });
  candidates.push({ kind: "nephew", personId: nephew.id, throughId: sibling?.id ?? null, relation: sibling === undefined ? "kinsman" : "nephew", created: true });
  return { state: { ...state, persons: town.result() }, candidates };
}

/**
 * F5-A (LG-3): the named heir takes the house — the head of the manor (the old lord and his wife stay as kin); a
 * daughter's husband comes with her (back to the manor as his wife); the family member who had left comes home; the
 * other candidates who came with the question leave again.
 */
export function seatHeir(state: GameState, chosen: HeirCandidate, candidates: readonly HeirCandidate[]): GameState {
  if (state.persons === undefined) return state;
  const town = new Town(state.seed, currentYear(state), state.persons);
  const houseTag = `lord-house:${lordHouse(state).order}`;
  for (const person of town.people.filter(entry => entry.tags.includes(houseTag) && (entry.role === "head" || entry.role === "spouse"))) town.replace(person.id, { role: "kin" });
  const home = (id: string, change: Partial<Person>) => {
    const gone = town.past.findIndex(person => person.id === id && person.alive);
    if (gone >= 0) {
      const { leftYear: _left, ...person } = town.past[gone]!;
      town.past.splice(gone, 1);
      town.people.push(person);
    }
    const person = town.people.find(entry => entry.id === id);
    if (person === undefined) return;
    const tags = [...new Set([...person.tags.filter(tag => tag !== HEIR_CANDIDATE_TAG), LORD_FAMILY_TAG, houseTag])];
    town.replace(id, { ...change, householdId: MANOR_HOUSEHOLD, tags });
  };
  const heir = town.find(chosen.personId);
  home(chosen.personId, { role: "head", occupation: heir?.sex === "female" ? "lady" : "lord" });
  if (chosen.kind === "daughter_husband" && chosen.throughId !== null) home(chosen.throughId, { role: "spouse", occupation: "lady" });
  for (const candidate of candidates) if (candidate.created && candidate.personId !== chosen.personId) town.remove(candidate.personId, { left: true });
  return { ...state, persons: town.result() };
}

/** FIX-9: a person who left the manor this old is taken to have died away (no longer called home). */
const KIN_HOME_MAX_AGE = 70;

/**
 * FIX-9 (FX9-3): the dead lord's nearest living kin of the blood — a descendant, or one who shares an ancestor with
 * them (the married-in share none): the fewest steps through the common ancestor; then one in the manor, a man, the elder.
 */
function nearestBloodKin(town: Town, dead: Person, houseTag: string): Person | undefined {
  const everyone = [...town.people, ...town.past].filter(person => person.tags.includes(houseTag));
  const byId = new Map(everyone.map(person => [person.id, person]));
  const ancestors = (person: Person): Map<string, number> => {
    const depth = new Map<string, number>([[person.id, 0]]);
    const queue: Person[] = [person];
    while (queue.length > 0) {
      const next = queue.shift()!;
      for (const parentId of [next.fatherId, next.motherId]) {
        const parent = parentId === undefined ? undefined : byId.get(parentId);
        if (parent === undefined || depth.has(parent.id)) continue;
        depth.set(parent.id, depth.get(next.id)! + 1);
        queue.push(parent);
      }
    }
    return depth;
  };
  const mine = ancestors(dead);
  const ranked = everyone.filter(person => person.id !== dead.id && person.alive && (town.people.includes(person) || ageOf(person, town.year) <= KIN_HOME_MAX_AGE))
    .map(person => {
      let steps = Infinity;
      for (const [id, up] of ancestors(person)) { const down = mine.get(id); if (down !== undefined) steps = Math.min(steps, up + down); }
      return { person, steps };
    }).filter(entry => entry.steps < Infinity);
  ranked.sort((a, b) => a.steps - b.steps || Number(town.people.includes(b.person)) - Number(town.people.includes(a.person))
    || (a.person.sex === b.person.sex ? 0 : a.person.sex === "male" ? -1 : 1) || a.person.birthYear - b.person.birthYear || a.person.id.localeCompare(b.person.id));
  return ranked[0]?.person;
}

/** LN-5: the town's named lineages — the lord's house, and the families of note (a merchant head, two reeves, the miller). */
const TOWN_SETS: Readonly<Record<"merchant" | "reeve" | "miller", readonly string[]>> = { merchant: ["L4", "L2"], reeve: ["L5"], miller: ["L8"] };
function nameLineages(town: Town, state: GameState): void {
  const named = new Set(town.lineages.map(lineage => lineage.id));
  const taken = new Set(town.lineages.map(lineage => lineage.set).filter((set): set is string => set !== null));
  const add = (id: string, kind: NamedLineage["kind"], sets: readonly string[], always = false) => {
    if (named.has(id)) return;
    const set = sets.find(candidate => !taken.has(candidate)) ?? null;
    // A family of note is named while its kind has a set to give (the first merchants, reeves, miller); the lord's always.
    if (set === null && !always) return;
    town.lineages.push({ id, kind, set, since: state.tick, slots: {} });
    named.add(id);
    if (set !== null) taken.add(set);
  };
  const order = lordHouse(state).order;
  add(`lord:${order}`, "lord", order === 1 ? ["L3"] : order === 2 ? ["L1"] : [], true);
  for (const head of town.people.filter(person => person.role === "head" && person.householdId !== MANOR_HOUSEHOLD).sort((a, b) => a.id.localeCompare(b.id))) {
    if (named.has(head.lineageId)) continue;
    if (head.classBand === "merchant") add(head.lineageId, "merchant", TOWN_SETS.merchant);
    else if ((town.reeveTerms[head.lineageId] ?? 0) >= 2) add(head.lineageId, "reeve", TOWN_SETS.reeve);
    else if (head.occupation === "miller") add(head.lineageId, "miller", TOWN_SETS.miller);
  }
}

/**
 * LN-7: a named lineage's family takes the places of its portrait set — the head (and spouse) of the time it was named
 * the founding couple, their children the second generation, those who married into it the in-law places, the
 * grandchildren the third — by sex, in order of age, a place whose picture fits the person's age first. A place taken
 * stays taken; when the set runs out the person keeps the town's face (trait matching).
 */
function fillSlots(town: Town, index: number): void {
  const lineage = town.lineages[index]!;
  if (lineage.set === null) return;
  const places = setPlaces(lineage.set);
  const slots: Record<string, string> = { ...lineage.slots };
  const slotOf = new Map(Object.entries(slots).map(([identity, personId]) => [personId, identity]));
  const generationOf = (identity: string | undefined) => places.find(place => place.identityId === identity)?.generation ?? 0;
  const inSet = (person: Person) => person.householdId !== MANOR_HOUSEHOLD || person.tags.includes(LORD_FAMILY_TAG);
  // The main line: the heads of the lineage's households and their spouses, their children, and so on down (the set
  // is a family's three generations: its collateral kin keep the town's faces).
  const heads = town.people.filter(person => person.lineageId === lineage.id && person.role === "head" && inSet(person));
  const households = new Set(heads.map(person => person.householdId));
  const couple = town.people.filter(person => households.has(person.householdId) && (person.role === "head" || person.role === "spouse") && inSet(person));
  const line = new Set([...couple.map(person => person.id), ...Object.values(slots)]);
  const born = town.people.filter(person => person.lineageId === lineage.id && inSet(person) && [person.fatherId, person.motherId].some(id => id !== undefined && line.has(id)));
  const family = [...couple, ...born.filter(person => !line.has(person.id))].sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id));
  let changed = false;
  for (const person of family) {
    if (slotOf.has(person.id)) continue;
    const current = identityLineage(person.portraitIdentity);
    if (current !== undefined && current !== "common") continue;
    const inLaw = person.lineageId !== lineage.id;
    const parentGeneration = Math.max(0, ...[person.fatherId, person.motherId].map(id => generationOf(id === undefined ? undefined : slotOf.get(id))));
    const partner = inLaw ? couple.find(other => other.lineageId === lineage.id && other.householdId === person.householdId) : undefined;
    const generation = inLaw ? generationOf(partner === undefined ? undefined : slotOf.get(partner.id)) || 1
      : parentGeneration > 0 ? parentGeneration + 1 : 1;
    const age = ageOf(person, town.year);
    const band = age < PORTRAIT_MIN_AGE ? youngStageOf(age) : PORTRAIT_BAND[ageBandOf(age)];
    const free = places.filter(place => place.sex === person.sex && place.generation === generation && slots[place.identityId] === undefined
      && (generation !== 2 || place.inLaw === inLaw));
    // The generation's places all given (a large family): the nearest generation's free place with a picture of the
    // person's age (a face is never given twice: the dead keep theirs).
    const spare = places.filter(place => place.sex === person.sex && slots[place.identityId] === undefined && place.inLaw === inLaw && place.bands.has(band))
      .sort((a, b) => Math.abs(a.generation - generation) - Math.abs(b.generation - generation) || a.identityId.localeCompare(b.identityId));
    const place = free.find(candidate => candidate.bands.has(band)) ?? free[0] ?? spare[0];
    if (place === undefined) continue;
    slots[place.identityId] = person.id;
    slotOf.set(person.id, place.identityId);
    town.replace(person.id, { portraitIdentity: place.identityId });
    changed = true;
  }
  if (changed) town.lineages[index] = { ...lineage, slots };
}

/**
 * LN-10: the season's passing states (no effect on the simulation — work, residence and death are as they were): an
 * illness at five times the season's death rate for the age (at most 15 %), an injury at 3 % for the working 14–60
 * (6 % in the quarry, the masonry, the woods), a pregnancy at 15 % for a wife of 16–44 in a household that can grow,
 * and at the year's start a pilgrimage at 1 % for an adult of 18–60. One state at a time; each ends at its tick.
 */
const CONDITION_LENGTH = { sick: SEASON, injury: SEASON, pregnant: 3 * SEASON, pilgrim: 2 * SEASON } as const;
function advanceConditions(town: Town, state: GameState, yearStart: boolean): void {
  const houses = new Map(state.houses.map(house => [house.buildingId, house]));
  for (const person of [...town.people]) {
    if (person.condition !== undefined && person.condition.until <= state.tick) {
      const { condition: _ended, ...well } = person;
      town.people[town.people.indexOf(person)] = well;
      continue;
    }
    if (person.condition !== undefined) continue;
    const age = ageOf(person, town.year);
    const key = Number(person.id.slice(2)) + (person.id.startsWith("m-") ? 1_000_000 : 0);
    const start = (kind: keyof typeof CONDITION_LENGTH) => town.replace(person.id, { condition: { kind, since: state.tick, until: state.tick + CONDITION_LENGTH[kind] } });
    if (rollPermille(town.seed, "person-state:sick", key, state.tick) < Math.min(150, 5 * seasonDeathPermille(age))) { start("sick"); continue; }
    const hard = ["mason", "quarrier", "woodward", "sawyer"].includes(person.occupation);
    if (age >= ADULT_AGE && age <= 60 && person.occupation !== "child" && rollPermille(town.seed, "person-state:injury", key, state.tick) < (hard ? 60 : 30)) { start("injury"); continue; }
    const home = houses.get(person.householdId);
    const wife = person.sex === "female" && age >= 16 && age <= 44 && (person.role === "head" || person.role === "spouse")
      && town.household(person.householdId).some(other => other.sex === "male" && (other.role === "head" || other.role === "spouse"));
    const canGrow = person.householdId === MANOR_HOUSEHOLD || (home !== undefined && canRefill(home, state.tick));
    if (wife && canGrow && rollPermille(town.seed, "person-state:pregnant", key, state.tick) < 150) { start("pregnant"); continue; }
    if (yearStart && age >= 18 && age <= 60 && rollPermille(town.seed, "person-state:pilgrim", key, state.tick) < 10) start("pilgrim");
  }
}

/** PS-4: each petition names 2–3 heads, the most substantial (merchant, artisan) first. */
function namePetitioners(town: Town, state: GameState): GameState {
  const petitions = state.politics?.petitions ?? [];
  if (!petitions.some(petition => petition.petitionerIds === undefined)) return state;
  const rank: Readonly<Record<string, number>> = { merchant: 0, artisan: 1, labour: 2, poor_servant: 3, gentry: 4, clerical: 5 };
  const next = petitions.map(petition => {
    if (petition.petitionerIds !== undefined) return petition;
    // FACTION-0 (FX-3): an outside faction's petition is brought in its leader's name (the king's writ, the earl, the bishop's letter).
    const leaders = petitionFactionLeaders(state, petition.petitioner);
    if (leaders !== null) return { ...petition, petitionerIds: leaders };
    const heads = town.people.filter(person => person.role === "head" && person.householdId !== MANOR_HOUSEHOLD && ageOf(person, town.year) >= 18)
      .sort((a, b) => (rank[a.classBand] ?? 9) - (rank[b.classBand] ?? 9) || (hashSeed(town.seed, petition.id, Number(a.id.slice(2))) - hashSeed(town.seed, petition.id, Number(b.id.slice(2)))));
    const count = 2 + hashSeed(town.seed, `petitioners:${petition.id}`) % 2;
    // FIX-4 (HR-12): the petitioners stand side by side, so no two of them show the same face (identity).
    const chosen: Person[] = [];
    for (const head of heads) {
      if (chosen.length >= count) break;
      if (!chosen.some(other => other.portraitIdentity === head.portraitIdentity)) chosen.push(head);
    }
    for (const person of chosen) town.replace(person.id, { tags: [...person.tags, `petitioner:${petition.id}`] });
    return { ...petition, petitionerIds: chosen.map(person => person.id) };
  });
  return { ...state, politics: { ...state.politics!, petitions: next } };
}

/**
 * One tick of persons (after the housing, seasons and events of the tick; before politics). Returns the state with
 * its persons, houses (residents after deaths, members from ages) and population.
 */
export function advancePersons(state: GameState): GameState {
  const base = state.persons ?? initialPersons(state);
  const year = currentYear(state);
  const seasonStart = state.tick > 0 && state.tick % SEASON === 0;
  // PS-3: the season's deaths fall on its first day (after the ledger closed the last season).
  const deathDay = state.tick > 0 && state.tick % SEASON === 1;
  const burning = state.houses.some(house => house.burntTick === state.tick);
  // Fast path: nothing to change when every house holds its people and it is not a season's start.
  if (state.persons !== undefined && !seasonStart && !deathDay && !burning) {
    const counts = new Map<string, number>();
    for (const person of base.people) counts.set(person.householdId, (counts.get(person.householdId) ?? 0) + 1);
    const settled = state.houses.every(house => (counts.get(house.buildingId) ?? 0) === Math.max(0, house.residents))
      && [...counts.keys()].every(id => id === MANOR_HOUSEHOLD || state.houses.some(house => house.buildingId === id));
    const petitionsNamed = !(state.politics?.petitions ?? []).some(petition => petition.petitionerIds === undefined);
    const headed = [...counts.keys()].every(id => id === MANOR_HOUSEHOLD || base.people.some(person => person.householdId === id && person.role === "head"));
    if (settled && petitionsNamed && headed) return state;
  }
  const town = new Town(state.seed, year, base);
  const residents = new Map(state.houses.map(house => [house.buildingId, Math.max(0, house.residents)]));
  const houseById = new Map(state.houses.map(house => [house.buildingId, house]));
  const houseIds = new Set(state.houses.map(house => house.buildingId));

  // PS-3 deaths of the season and of fire (they take residents from the houses).
  let plagueTown = 0, plagueManor = 0;
  if (deathDay || burning) {
    const weight = deathDay ? mortalityWeight(state) : 0;
    const burnt = new Set(state.houses.filter(house => house.burntTick === state.tick).map(house => house.buildingId));
    // F3-A (PL-2): the pestilence's dead of the death day (drawn by weight; residents lost, never refilled).
    const plague = deathDay ? plagueVictims(state, town.people, year) : new Set<string>();
    for (const person of [...town.people]) {
      if (person.householdId === MANOR_HOUSEHOLD && !deathDay) continue;
      let cause: DeathCause | null = null;
      const home = houseById.get(person.householdId);
      if (plague.has(person.id)) {
        town.remove(person.id, { died: "plague" });
        if (person.householdId === MANOR_HOUSEHOLD) plagueManor += 1;
        else { plagueTown += 1; if (home !== undefined) residents.set(person.householdId, Math.max(0, residents.get(person.householdId)! - 1)); }
        continue;
      }
      if (burnt.has(person.householdId) && rollPermille(state.seed, "fire-death", Number(person.id.slice(2)), state.tick) < FIRE_DEATH_PERMILLE) cause = "fire";
      // FIX-11: all houses' people are eligible for age-death regardless of refill state.
      else if (deathDay) {
        // A season is a quarter of the year's rate; the deaths dear bread adds on top are famine deaths.
        const usual = seasonDeathPermille(ageOf(person, year));
        const weighted = seasonDeathPermille(ageOf(person, year), weight);
        const roll = rollPermille(state.seed, "death", Number(person.id.slice(2)), state.tick);
        if (roll < usual) cause = "age";
        else if (roll < weighted) cause = "famine";
      }
      if (cause === null) continue;
      town.remove(person.id, { died: cause });
      // A household that can grow (fed, watered, not burnt, not leaving) fills the place at once — a birth or a
      // relative, as the growth rule would within its interval. A fire's dead are residents lost.
      if (home !== undefined && !canRefill(home, state.tick)) residents.set(person.householdId, Math.max(0, residents.get(person.householdId)! - 1));
    }
    // FIX-11 (item 2): those who left town grow old too — the same table, so no one comes back as heir or mayor at 110.
    if (deathDay) town.past.forEach((person, index) => {
      if (!person.alive || person.leftYear === undefined) return;
      if (rollPermille(state.seed, "death", Number(person.id.slice(2)), state.tick) >= seasonDeathPermille(ageOf(person, year))) return;
      const { leftYear: _left, ...gone } = person;
      town.past[index] = { ...gone, alive: false, deathYear: year, deathCause: "age" };
    });
  }

  // PS-1: households of houses that are gone leave the town.
  for (const person of [...town.people]) if (person.householdId !== MANOR_HOUSEHOLD && !houseIds.has(person.householdId)) town.remove(person.id, { left: true });

  // PS-1 / PS-3: each house holds exactly its residents.
  for (const house of [...state.houses].sort((a, b) => a.buildingId.localeCompare(b.buildingId))) {
    let count = town.household(house.buildingId).length;
    const target = residents.get(house.buildingId)!;
    if (count > target) {
      if (house.abandonedTick !== undefined) {
        for (const person of town.household(house.buildingId).slice(target)) town.remove(person.id, { left: true });
      } else while (town.household(house.buildingId).length > target) town.shrink(house.buildingId);
    }
    if (!town.succession(house.buildingId)) residents.set(house.buildingId, 0);
    count = town.household(house.buildingId).length;
    for (let index = count; index < residents.get(house.buildingId)!; index += 1) town.grow(house.buildingId, index);
  }

  // PS-5: at the year's start, a person whose face no longer matches (a new age band the identity lacks, or a class
  // the picture does not show) takes a better one if the pool has it; a child of 14 becomes a labourer. CODE-1a: a
  // faction leader's pool-3 face is kept while it has the age band (its class is the faction's, not the trade's).
  if (seasonStart && state.tick % YEAR === 0) {
    for (const person of [...town.people]) {
      const band = ageBandOf(ageOf(person, year));
      const grown = person.occupation === "child" && band !== "child" ? { occupation: "labourer" } : {};
      const current = { ...person, ...grown };
      // PERSON-1a (LN-7): a lineage set's face is the family's; it is never traded for the town's.
      const setFace = identityLineage(current.portraitIdentity) !== undefined && identityLineage(current.portraitIdentity) !== "common";
      if (setFace || (identityHasBand(current.portraitIdentity, band) && (portraitFor(current, band).exact || identityFaction(current.portraitIdentity) !== undefined))) {
        if (grown.occupation !== undefined) town.replace(person.id, grown);
        continue;
      }
      const usage = town.usage();
      usage.set(current.portraitIdentity, Math.max(0, (usage.get(current.portraitIdentity) ?? 1) - 1));
      const candidate = choosePortraitIdentity(state.seed, current, band, usage);
      const better = portraitFor({ ...current, portraitIdentity: candidate }, band).exact || !identityHasBand(current.portraitIdentity, band);
      town.replace(person.id, { ...grown, ...(better ? { portraitIdentity: candidate } : {}) });
    }
  }

  // PS-4 offices.
  appointSteward(town);
  if (seasonStart || state.persons === undefined) {
    appointMasters(town, state);
    chooseReeve(town);
    // PERSON-1a: the lord's family, the bailiff, the named lineages and their faces, the season's passing states.
    const yearStart = state.tick % YEAR === 0;
    keepLordFamily(town, state, yearStart);
    if (yearStart || state.persons === undefined) chooseBailiff(town);
    nameLineages(town, state);
    town.lineages.forEach((_lineage, index) => fillSlots(town, index));
    if (seasonStart) advanceConditions(town, state, yearStart);
  }
  const named = namePetitioners(town, state);

  const byHouse = new Map<string, Person[]>();
  for (const person of town.people) byHouse.set(person.householdId, [...(byHouse.get(person.householdId) ?? []), person]);
  const houses = state.houses.map(house => {
    const target = residents.get(house.buildingId)!;
    const withResidents = target === house.residents ? house : { ...house, residents: target };
    return membersOf(withResidents, byHouse.get(house.buildingId) ?? [], year);
  });
  const population = houses.reduce((sum, house) => sum + Math.max(0, house.residents), 0);
  // PL-2: the households the death day took whole (their houses had people and have none).
  const wiped = plagueTown === 0 ? 0 : state.houses.filter(house => house.residents > 0 && residents.get(house.buildingId) === 0).length;
  return countPlagueDead({ ...named, houses, population, persons: town.result() }, plagueTown, plagueManor, wiped);
}

/** PS-7 `persons.of`: the living members of a household, head first. */
export function personsOf(state: Pick<GameState, "persons">, householdId: string): readonly Person[] {
  const order: PersonRole[] = ["head", "steward", "spouse", "kin", "child"];
  return (state.persons?.people ?? []).filter(person => person.householdId === householdId)
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.birthYear - b.birthYear || a.id.localeCompare(b.id));
}

/** PS-7 `persons.byRole`: the living with a household role or an office (`reeve`, `manager`, `petitioner`). */
export function personsByRole(state: Pick<GameState, "persons">, role: PersonRole | "reeve" | "manager" | "petitioner"): readonly Person[] {
  return (state.persons?.people ?? []).filter(person => person.role === role || person.tags.some(tag => tag === role || tag.startsWith(`${role}:`)));
}

export function personById(state: Pick<GameState, "persons"> & Partial<Pick<GameState, "factions">>, id: string): Person | undefined {
  // FACTION-0 (FX-2): the outside factions' leaders are persons too.
  return state.persons?.people.find(person => person.id === id) ?? state.persons?.past.find(person => person.id === id) ?? factionPerson(state, id);
}

export function personPortrait(state: Pick<GameState, "tick" | "scenarioId">, person: Person): PortraitChoice {
  const age = ageOf(person, person.deathYear ?? currentYear(state));
  return portraitFor(person, ageBandOf(age), age);
}
