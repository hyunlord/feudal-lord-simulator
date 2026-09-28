/**
 * PERSON-1a heredity (spec docs/design/lineage.md LN-1…LN-3): traits drawn from the population (a founder, a
 * newcomer) or taken from the parents (a birth), and a person's resemblance to another. Every roll has its own salt
 * (`trait:*`), so no roll of PERSON-0 moves (decision LN2).
 */
import {
  HAIR_WORDS, TRAIT_KEYS, TRAIT_MUTATION_PERMILLE, TRAIT_POPULATION, type PersonTraits, type TraitKey,
} from "../content/personTraits";
import { hashSeed, rollPermille } from "./prng";

function weightedPick<T>(entries: readonly (readonly [T, number])[], roll: number): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let left = roll % total;
  for (const [value, weight] of entries) { if (left < weight) return value; left -= weight; }
  return entries[0]![0];
}

/** LN-3: one trait from the population. */
function populationTrait<K extends TraitKey>(key: K, roll: number): PersonTraits[K] {
  return weightedPick(TRAIT_POPULATION[key] as unknown as readonly (readonly [PersonTraits[K], number])[], roll);
}

/** LN-3: a founder's or newcomer's traits (`subject` names the person: their ordinal, and a scope for other id spaces). */
export function populationTraits(seed: number, scope: string, subject: number): PersonTraits {
  return Object.fromEntries(TRAIT_KEYS.map((key, index) => [key, populationTrait(key, hashSeed(seed, `trait:founder:${scope}`, subject, index))])) as unknown as PersonTraits;
}

/** A partial set of traits (a portrait's record) completed from the population. */
export function completeTraits(partial: Partial<PersonTraits>, seed: number, scope: string, subject: number): PersonTraits {
  const drawn = populationTraits(seed, scope, subject);
  return { ...drawn, ...Object.fromEntries(Object.entries(partial).filter(([, value]) => value !== undefined)) } as PersonTraits;
}

/**
 * LN-2: a child's traits — each from the father or the mother (a fair roll), one in twenty drawn from the population
 * instead (a mutation). With one parent known, each trait is that parent's or the population's by halves.
 */
export function inheritTraits(seed: number, scope: string, subject: number, mother: PersonTraits | undefined, father: PersonTraits | undefined): PersonTraits {
  if (mother === undefined && father === undefined) return populationTraits(seed, scope, subject);
  const traits: Record<string, unknown> = {};
  TRAIT_KEYS.forEach((key, index) => {
    const population = populationTrait(key, hashSeed(seed, `trait:mutation-value:${scope}`, subject, index));
    if (rollPermille(seed, `trait:mutation:${scope}`, subject, index) < TRAIT_MUTATION_PERMILLE) { traits[key] = population; return; }
    const fromFather = hashSeed(seed, `trait:parent:${scope}`, subject, index) % 2 === 0;
    if (mother !== undefined && father !== undefined) traits[key] = (fromFather ? father : mother)[key];
    else traits[key] = fromFather ? (mother ?? father)![key] : population;
  });
  return traits as unknown as PersonTraits;
}

/** LN-1: the person's `hair` words for their hair trait. */
export const hairWords = (traits: PersonTraits): string => HAIR_WORDS[traits.hair];

/** LN-11 `persons.resemblance`: the traits two people share. */
export function sharedTraits(a: PersonTraits, b: PersonTraits): readonly TraitKey[] {
  return TRAIT_KEYS.filter(key => (key === "skin" ? Math.abs(a.skin - b.skin) <= 1 : a[key] === b[key]));
}
