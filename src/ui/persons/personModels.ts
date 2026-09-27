import type { Walker } from "../../agents/walker.types";
import { BUILDING_CONFIG_BY_KIND } from "../../content/buildingConfig";
import type { GameState } from "../../engine/engine.types";
import { hashSeed } from "../../engine/prng";
import { ageOf, currentYear, displayName, inTown, personById } from "../../engine/persons";
import { persons } from "../../engine/personsApi";
import { MANOR_HOUSEHOLD, type Person, type PersonClassBand } from "../../engine/persons.types";
import type { PetitionRecord } from "../../engine/politics.types";
import { walkerLook, type WalkerClassBand } from "../../render/walkerLook";
import { armsRecipe, merchantRecipe } from "../heraldry/heraldry";
import type { EmblemSpec } from "../heraldry/EmblemImage";
import { RESOURCE_NAMES } from "../hud/hudCopy.ko";
import { drawnPortraitId } from "../portraitArt";
import { PERSONS_COPY } from "./personsCopy.ko";

// UI-5 people on screen (PERSON-0 persons, spec docs/design/persons.md): the rows and cards the screens show — a
// house's members, a petition's petitioners, the steward, the person behind a walker, a person's card with the
// lord's arms (the manor household) or a merchant's mark (a merchant household), and how many portraits match.

export type PersonRow = Readonly<{ id: string; name: string; line: string; portraitId: string; exact: boolean }>;
export type PersonCardView = Readonly<{
  id: string; name: string; role: string; life: string; household: string; portraitId: string; exact: boolean; match: string;
  emblem: EmblemSpec | null; emblemLabel: string;
}>;

const ROLE_ORDER: Readonly<Record<string, number>> = { steward: 0, head: 1, spouse: 2, kin: 3, child: 4 };
/** The trade worth naming beside the role (not a labourer's or a child's, not the role again: the steward). */
const occupationOf = (person: Person) => person.occupation === "labourer" || person.occupation === "child" || person.occupation === ""
  || PERSONS_COPY.occupation(person.occupation) === PERSONS_COPY.role(person.role) ? null : PERSONS_COPY.occupation(person.occupation);

/** The picture a person is drawn with: the pool's pick for their age, or the steward's fixed portrait (the office's own, so it matches). */
function drawnPortrait(state: GameState, person: Person) {
  const pick = persons.portrait(state, person);
  const fixed = person.role === "steward";
  return { ...pick, portraitId: drawnPortraitId(person, pick.portraitId), exact: fixed || pick.exact, fixed };
}

export function personRow(state: GameState, person: Person): PersonRow {
  const portrait = drawnPortrait(state, person);
  const age = ageOf(person, person.deathYear ?? person.leftYear ?? currentYear(state));
  return { id: person.id, name: displayName(person), line: PERSONS_COPY.memberLine(PERSONS_COPY.role(person.role), PERSONS_COPY.age(age), occupationOf(person)),
    portraitId: portrait.portraitId, exact: portrait.exact };
}

/** A house's members as the inspector lists them: head, spouse, kin, children (then by age). */
export function householdRows(state: GameState, houseId: string): readonly PersonRow[] {
  return persons.of(state, houseId).slice().sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.birthYear - b.birthYear)
    .map(person => personRow(state, person));
}

/** The petition's petitioners (PERSON-0 PS-4: two or three household heads, the most substantial first). */
export function petitionerRows(state: GameState, petition: Pick<PetitionRecord, "petitionerIds">): readonly PersonRow[] {
  return (petition.petitionerIds ?? []).flatMap(id => { const person = personById(state, id); return person === undefined ? [] : [personRow(state, person)]; });
}

/** The lord's steward (the manor household's steward; PERSON-0 keeps one in office). */
export function stewardPerson(state: Pick<GameState, "persons">): Person | null {
  return state.persons?.people.find(person => person.role === "steward" && inTown(person)) ?? null;
}

/** A walker look's class band as a person's class (the bands without one match any class). */
const LOOK_CLASS: Readonly<Partial<Record<WalkerClassBand, PersonClassBand>>> = {
  labor: "labour", servant: "poor_servant", poor: "poor_servant", textile: "artisan", artisan: "artisan", merchant: "merchant", gentry: "gentry",
  priest: "clerical", monk: "clerical", nun: "clerical",
};

/**
 * The person behind a carter or a distributor: a working-age townsperson (14–54: the walker bodies are adults) of the
 * look's sex — and of its class when the town has one — so the card's portrait is the figure on the road. The pick is
 * the candidate with the lowest hash of (walker, person): the same walker is the same person, and a birth, a death or a
 * birthday elsewhere in town moves no other walker's pick (only a candidate who arrives with a lower hash, or the
 * chosen one leaving, changes it).
 */
export function walkerPerson(state: GameState, walker: Walker): Person | null {
  const look = walkerLook(state, walker);
  const year = currentYear(state);
  const working = (state.persons?.people ?? []).filter(person => person.householdId !== MANOR_HOUSEHOLD && ageOf(person, year) >= 14 && ageOf(person, year) < 55);
  const sameSex = working.filter(person => person.sex === look.sex);
  const sameClass = sameSex.filter(person => person.classBand === LOOK_CLASS[look.band]);
  const pool = sameClass.length > 0 ? sameClass : sameSex.length > 0 ? sameSex : working;
  const key = hashSeed(state.seed, "walker-person", ...Array.from(walker.id, char => char.charCodeAt(0)));
  let chosen: Person | null = null; let lowest = Infinity;
  for (const person of pool) {
    const rank = hashSeed(key, "walker-person", ...Array.from(person.id, char => char.charCodeAt(0)));
    if (rank < lowest) { lowest = rank; chosen = person; }
  }
  return chosen;
}

/** The emblem a person's card shows: the lord's arms for the manor household, its mark for a merchant household (one with a merchant). */
export function personEmblem(state: Pick<GameState, "seed" | "persons">, person: Person): EmblemSpec | null {
  if (person.householdId === MANOR_HOUSEHOLD) return { kind: "arms", recipe: armsRecipe(state.seed, MANOR_HOUSEHOLD) };
  const merchant = person.classBand === "merchant" || persons.of(state as GameState, person.householdId).some(member => member.classBand === "merchant");
  return merchant ? { kind: "merchant", recipe: merchantRecipe(state.seed, person.householdId) } : null;
}

export function personCardView(state: GameState, personId: string): PersonCardView | null {
  const person = personById(state, personId);
  if (person === undefined) return null;
  const portrait = drawnPortrait(state, person);
  const year = person.deathYear ?? person.leftYear ?? currentYear(state);
  const head = persons.of(state, person.householdId).find(member => member.role === "head");
  const emblem = personEmblem(state, person);
  return {
    id: person.id, name: displayName(person), role: PERSONS_COPY.cardRole(PERSONS_COPY.role(person.role), occupationOf(person)),
    life: PERSONS_COPY.cardLife(person.birthYear, ageOf(person, year)),
    household: person.householdId === MANOR_HOUSEHOLD ? PERSONS_COPY.manor : PERSONS_COPY.householdOf(displayName(head ?? person)),
    portraitId: portrait.portraitId, exact: portrait.exact,
    match: portrait.fixed ? PERSONS_COPY.stewardPortrait : PERSONS_COPY.portraitMatch(portrait.identityId, portrait.stage, portrait.exact),
    emblem, emblemLabel: emblem === null ? PERSONS_COPY.noEmblem : emblem.kind === "arms" ? PERSONS_COPY.arms : PERSONS_COPY.merchantMark,
  };
}

/** Gate ②: how many of the living in town are drawn with a portrait that matches them (sex, age band, class; the steward's fixed one). */
export function portraitMatchRate(state: GameState): Readonly<{ exact: number; total: number; percent: number }> {
  const living = (state.persons?.people ?? []).filter(inTown);
  const exact = living.filter(person => drawnPortrait(state, person).exact).length;
  return { exact, total: living.length, percent: living.length === 0 ? 100 : Math.floor((exact / living.length) * 1000) / 10 };
}

export type WalkerHeadline = Readonly<{ personId: string | null; name: string | null; portraitId: string | null; exact: boolean; line: string }>;

/**
 * Visibility design 4절: a carrier's card says who, and verb + what + where + progress ("목재를 방앗간 공사장으로
 * 나르는 중 · 12/20": the site's delivered and required amounts of that material).
 */
export function walkerHeadline(state: GameState, walkerId: string): WalkerHeadline | null {
  const walker = state.walkers.find(candidate => candidate.id === walkerId);
  if (walker === undefined || walker.kind === "builder") return null;
  const person = walkerPerson(state, walker);
  const portrait = person === null ? null : drawnPortrait(state, person);
  const who = { personId: person?.id ?? null, name: person === null ? null : displayName(person), portraitId: portrait?.portraitId ?? null, exact: portrait?.exact ?? false };
  const cargo = walker.cargo === null ? null : RESOURCE_NAMES[walker.cargo.resource];
  if (walker.kind === "distributor") return { ...who, line: cargo === null ? PERSONS_COPY.returningHome : PERSONS_COPY.delivering(cargo) };
  const home = state.buildings.find(building => building.id === walker.homeBuildingId);
  if (cargo === null || walker.phase === "returning") return { ...who, line: PERSONS_COPY.returning(home === undefined ? null : BUILDING_CONFIG_BY_KIND[home.kind].name) };
  if (walker.destination.kind === "building") {
    const destinationId = walker.destination.buildingId;
    const target = state.buildings.find(building => building.id === destinationId);
    return { ...who, line: PERSONS_COPY.carrying(cargo, target === undefined ? PERSONS_COPY.somewhere : BUILDING_CONFIG_BY_KIND[target.kind].name) };
  }
  const siteId = walker.destination.siteId;
  const site = state.constructionSites.find(candidate => candidate.id === siteId);
  if (site === undefined) return { ...who, line: PERSONS_COPY.carrying(cargo, PERSONS_COPY.somewhere) };
  const place = site.kind === "palisade_segment" ? PERSONS_COPY.palisadeSite : site.kind === "stone_wall_segment" ? PERSONS_COPY.stoneWallSite
    : PERSONS_COPY.site(BUILDING_CONFIG_BY_KIND[site.kind].name);
  const resource = walker.cargo!.resource as keyof typeof site.required;
  const required = site.required[resource] ?? 0;
  const line = PERSONS_COPY.carrying(cargo, place);
  return { ...who, line: required > 0 ? PERSONS_COPY.progress(line, site.delivered[resource] ?? 0, required) : line };
}
