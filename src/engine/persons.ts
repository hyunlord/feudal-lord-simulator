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
 *   A household whose adults are gone passes to its eldest child of 12+, else it breaks up (the children go to kin).
 * - PS-4 offices: the steward (manor household, always), the reeve (a labour household head, chosen each year), a
 *   master for each staffed trade building (the nearest free household head takes the trade), petitioners (2–3
 *   heads, the most substantial first, named on each petition).
 * - PS-2 names and PS-5 portraits are fixed when a person appears (namesakes get bynames; see `personNames.ts`).
 */
import { FEMALE_GIVEN_NAMES, HAIR_COLOURS, MALE_GIVEN_NAMES, NAMESAKE_EPITHETS, OCCUPATIONAL_SURNAMES, ORDINAL_EPITHETS, PATRONYMIC_SURNAMES, TOPOGRAPHIC_SURNAMES, type WeightedName } from "../content/personNames";
import { BALANCE, PRESSURE_BALANCE } from "../content/balanceConfig";
import type { House } from "../population/population.types";
import type { GameState } from "./engine.types";
import { foodPricePermille } from "./eventSchedule";
import { hashSeed, rollPermille } from "./prng";
import { choosePortraitIdentity, identityHasBand, portraitFor, type PortraitChoice } from "./portraits";
import { calendar, scenarioOf } from "./scenarioState";
import { MANOR_HOUSEHOLD, type DeathCause, type Person, type PersonAgeBand, type PersonBuild, type PersonClassBand, type PersonRole, type PersonSex, type PersonState } from "./persons.types";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = BALANCE.TICKS_PER_YEAR;
export const ADULT_AGE = 14;
export const HEIR_AGE = 12;
const YOUTH_END = 29;
const ELDER_AGE = 55;

/** PS-3: yearly death rate by age, permille (a medieval village; dearth and famine weigh it). */
const DEATH_PERMILLE_BY_AGE: readonly (readonly [number, number])[] = [[5, 40], [14, 10], [30, 8], [55, 12], [65, 40], [75, 90], [Infinity, 200]];
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

function weighted(names: readonly WeightedName[], roll: number): string {
  const total = names.reduce((sum, entry) => sum + entry.weight, 0);
  let left = roll % total;
  for (const entry of names) { if (left < entry.weight) return entry.name; left -= entry.weight; }
  return names[0]!.name;
}

/** Working copy of the person state within one step (ordinal, the living, the gone). */
class Town {
  people: Person[];
  past: Person[];
  ordinal: number;
  reeveYear: number | undefined;
  constructor(readonly seed: number, readonly year: number, state: PersonState) {
    this.people = [...state.people];
    this.past = [...state.past];
    this.ordinal = state.nextOrdinal;
    this.reeveYear = state.reeveYear;
  }
  result(): PersonState {
    return { people: this.people, past: this.past, nextOrdinal: this.ordinal, ...(this.reeveYear === undefined ? {} : { reeveYear: this.reeveYear }) };
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
    const tags = person.tags.filter(tag => !tag.startsWith("manager:") && tag !== "reeve");
    this.past.push(fate.died !== undefined
      ? { ...person, alive: false, deathYear: this.year, deathCause: fate.died, tags }
      : { ...person, leftYear: this.year, tags });
  }

  /** PS-2: a unique name in the town; a clash with a living namesake gives both a byname. */
  name(sex: PersonSex, surname: string | undefined, householdId: string, id: string, birthYear: number): { givenName: string; epithet?: string } {
    const pool = sex === "male" ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES;
    const kin = new Set(this.household(householdId).map(person => person.givenName));
    let givenName = weighted(pool, hashSeed(this.seed, "person-name", this.ordinal));
    for (let attempt = 1; attempt < 6 && kin.has(givenName); attempt += 1) givenName = weighted(pool, hashSeed(this.seed, "person-name", this.ordinal, attempt));
    const namesakes = this.people.filter(person => person.givenName === givenName && person.surname === surname);
    if (namesakes.length === 0) return { givenName };
    const used = new Set(namesakes.map(person => person.epithet));
    const lone = namesakes.length === 1 && namesakes[0]!.epithet === undefined ? namesakes[0]! : undefined;
    if (lone !== undefined) {
      const newerIsYounger = birthYear >= lone.birthYear;
      this.replace(lone.id, { epithet: newerIsYounger ? "the elder" : "the younger" });
      return { givenName, epithet: newerIsYounger ? "the younger" : "the elder" };
    }
    const epithet = [...NAMESAKE_EPITHETS, ...ORDINAL_EPITHETS].find(candidate => !used.has(candidate)) ?? `no. ${id.slice(2)}`;
    return { givenName, epithet };
  }

  usage(): Map<string, number> {
    const usage = new Map<string, number>();
    for (const person of this.people) usage.set(person.portraitIdentity, (usage.get(person.portraitIdentity) ?? 0) + 1);
    return usage;
  }

  create(fields: { readonly sex: PersonSex; readonly birthYear: number; readonly householdId: string; readonly role: PersonRole;
    readonly surname?: string; readonly classBand?: PersonClassBand; readonly occupation?: string; readonly tags?: readonly string[] }): Person {
    const id = `p-${String(this.ordinal).padStart(6, "0")}`;
    const roll = hashSeed(this.seed, "person", this.ordinal);
    const build: PersonBuild = (["thin", "average", "average", "heavy"] as const)[roll % 4]!;
    const hair = HAIR_COLOURS[(roll >>> 4) % HAIR_COLOURS.length]!;
    const named = this.name(fields.sex, fields.surname, fields.householdId, id, fields.birthYear);
    const draft = { id, sex: fields.sex, classBand: fields.classBand ?? "labour", build, occupation: fields.occupation ?? (this.year - fields.birthYear >= ADULT_AGE ? "labourer" : "child"),
      tags: fields.tags ?? [], role: fields.role };
    const portraitIdentity = choosePortraitIdentity(this.seed, draft, ageBandOf(this.year - fields.birthYear), this.usage());
    const person: Person = { ...draft, givenName: named.givenName, ...(fields.surname === undefined ? {} : { surname: fields.surname }),
      ...(named.epithet === undefined ? {} : { epithet: named.epithet }), birthYear: fields.birthYear, householdId: fields.householdId,
      hair, alive: true, portraitIdentity };
    this.ordinal += 1;
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
      this.create({ sex: roll % 2 === 0 ? "female" : "male", birthYear: this.year, householdId, role: "child", ...(head.surname === undefined ? {} : { surname: head.surname }) });
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

/** PS-1: a house's adults (14+) and children from its people. */
function membersOf(house: House, people: readonly Person[], year: number): House {
  const adults = people.filter(person => ageOf(person, year) >= ADULT_AGE).length;
  const children = people.length - adults;
  const members = house.members;
  if (members !== undefined && members.adults === adults && members.children === children) return house;
  return { ...house, members: { adults, children, seed: members?.seed ?? 0 } };
}

/** PS-1: the town's labour: its adults in houses. */
export function labourPool(state: Pick<GameState, "houses" | "persons" | "population">): number {
  if (state.persons === undefined) return Math.floor(Math.max(0, state.population) * BALANCE.WORKERS_PER_RESIDENT);
  return state.houses.reduce((sum, house) => sum + (house.members?.adults ?? 0), 0);
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
}

/** PS-4: each petition names 2–3 heads, the most substantial (merchant, artisan) first. */
function namePetitioners(town: Town, state: GameState): GameState {
  const petitions = state.politics?.petitions ?? [];
  if (!petitions.some(petition => petition.petitionerIds === undefined)) return state;
  const rank: Readonly<Record<string, number>> = { merchant: 0, artisan: 1, labour: 2, poor_servant: 3, gentry: 4, clerical: 5 };
  const next = petitions.map(petition => {
    if (petition.petitionerIds !== undefined) return petition;
    const heads = town.people.filter(person => person.role === "head" && person.householdId !== MANOR_HOUSEHOLD && ageOf(person, town.year) >= 18)
      .sort((a, b) => (rank[a.classBand] ?? 9) - (rank[b.classBand] ?? 9) || (hashSeed(town.seed, petition.id, Number(a.id.slice(2))) - hashSeed(town.seed, petition.id, Number(b.id.slice(2)))));
    const count = 2 + hashSeed(town.seed, `petitioners:${petition.id}`) % 2;
    const chosen = heads.slice(0, count);
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
  const houseIds = new Set(state.houses.map(house => house.buildingId));

  // PS-3 deaths of the season and of fire (they take residents from the houses).
  if (deathDay || burning) {
    const weight = deathDay ? mortalityWeight(state) : 0;
    const burnt = new Set(state.houses.filter(house => house.burntTick === state.tick).map(house => house.buildingId));
    for (const person of [...town.people]) {
      if (person.householdId === MANOR_HOUSEHOLD && !deathDay) continue;
      let cause: DeathCause | null = null;
      if (burnt.has(person.householdId) && rollPermille(state.seed, "fire-death", Number(person.id.slice(2)), state.tick) < FIRE_DEATH_PERMILLE) cause = "fire";
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
      if (residents.has(person.householdId)) residents.set(person.householdId, Math.max(0, residents.get(person.householdId)! - 1));
    }
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
  // the picture does not show) takes a better one if the pool has it; a child of 14 becomes a labourer.
  if (seasonStart && state.tick % YEAR === 0) {
    for (const person of [...town.people]) {
      const band = ageBandOf(ageOf(person, year));
      const grown = person.occupation === "child" && band !== "child" ? { occupation: "labourer" } : {};
      const current = { ...person, ...grown };
      if (identityHasBand(current.portraitIdentity, band) && portraitFor(current, band).exact) {
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
  return { ...named, houses, population, persons: town.result() };
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

export function personById(state: Pick<GameState, "persons">, id: string): Person | undefined {
  return state.persons?.people.find(person => person.id === id) ?? state.persons?.past.find(person => person.id === id);
}

export function personPortrait(state: Pick<GameState, "tick" | "scenarioId">, person: Person): PortraitChoice {
  return portraitFor(person, ageBandOf(ageOf(person, person.deathYear ?? currentYear(state))));
}
