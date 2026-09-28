import { TRAIT_POPULATION, type PersonTraits, type TraitKey } from "../../content/personTraits";
import type { GameState } from "../../engine/engine.types";
import { persons } from "../../engine/personsApi";
import type { Person } from "../../engine/persons.types";
import type { ResemblancePart } from "./personTraitCopy.ko";

/**
 * UI-7 닮은 점 (PERSON-1a LN-11 `persons.resemblance`): which of the traits a person shares with each parent the
 * biography names — at most one per parent, the most distinctive first. A trait is as distinctive as the person's own
 * value is rare in the population (LN-3 `TRAIT_POPULATION`: red hair 4 %, a hooked nose 18 % before brown hair 24 % or an
 * average build 50 %); an equal share goes by the family look's weight (`traitDistance`: hair, nose, face, skin, eyes,
 * build). The mother's is her most distinctive trait other than the one named for the father ("아버지의 매부리코,
 * 어머니의 매부리코" says nothing new); an unknown parent or one who shares nothing gives none.
 */
const TIE_ORDER: readonly TraitKey[] = ["hair", "nose", "faceShape", "skin", "eye", "buildBias"];

/** The share (0…1) of the population with this value of the trait. */
function frequency(trait: TraitKey, traits: PersonTraits): number {
  const weights = TRAIT_POPULATION[trait] as readonly (readonly [string | number, number])[];
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  return (weights.find(([value]) => value === traits[trait])?.[1] ?? 0) / total;
}

/** A person's shared traits with a parent, the most distinctive first. */
export function distinctiveShared(state: GameState, person: Person, parentId: string): readonly TraitKey[] {
  return [...persons.resemblance(state, person.id, parentId)]
    .sort((a, b) => frequency(a, person.traits) - frequency(b, person.traits) || TIE_ORDER.indexOf(a) - TIE_ORDER.indexOf(b));
}

/** The biography's resemblance: the father's part, then the mother's (empty when neither is known or shares a trait). */
export function resemblanceParts(state: GameState, person: Person): readonly ResemblancePart[] {
  const parts: ResemblancePart[] = [];
  const pick = (parent: ResemblancePart["parent"], id: string | undefined) => {
    if (id === undefined) return;
    const trait = distinctiveShared(state, person, id).find(key => parts.every(part => part.trait !== key));
    if (trait !== undefined) parts.push({ parent, trait, value: person.traits[trait] });
  };
  pick("father", person.fatherId);
  pick("mother", person.motherId);
  return parts;
}
