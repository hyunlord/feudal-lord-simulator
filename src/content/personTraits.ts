/**
 * PERSON-1a heredity (spec docs/design/lineage.md LN-1): the traits a person is born with and passes on — hair, skin
 * (an eight-step ramp within the light skins of 1300 southern England), eyes, face shape, nose and a build tendency —
 * the population the town's founders and newcomers are drawn from, the words of the portrait records each trait is read
 * from, and the distance a portrait is chosen by. Values are the period's appearance vocabulary, not screen copy.
 */
export const HAIR_TRAITS = ["black", "dark_brown", "brown", "chestnut", "auburn", "red", "blond", "flaxen"] as const;
export const EYE_TRAITS = ["blue", "grey", "green", "hazel", "brown", "dark_brown"] as const;
export const FACE_TRAITS = ["long", "round", "square", "pointed"] as const;
export const NOSE_TRAITS = ["straight", "hooked", "snub", "bulbous"] as const;
export const BUILD_TRAITS = ["thin", "average", "heavy"] as const;
/** Skin: 0 (the palest) … 7 (weathered olive), all within the light skins. */
export const SKIN_STEPS = 8;

export type HairTrait = (typeof HAIR_TRAITS)[number];
export type EyeTrait = (typeof EYE_TRAITS)[number];
export type FaceTrait = (typeof FACE_TRAITS)[number];
export type NoseTrait = (typeof NOSE_TRAITS)[number];
export type BuildTrait = (typeof BUILD_TRAITS)[number];

export interface PersonTraits {
  readonly hair: HairTrait;
  readonly skin: number;
  readonly eye: EyeTrait;
  readonly faceShape: FaceTrait;
  readonly nose: NoseTrait;
  readonly buildBias: BuildTrait;
}
export const TRAIT_KEYS = ["hair", "skin", "eye", "faceShape", "nose", "buildBias"] as const;
export type TraitKey = (typeof TRAIT_KEYS)[number];

/**
 * LN-3: the founders' and newcomers' population, weights (southern England c. 1300: mostly brown and dark hair, a tenth
 * fair; light skins in eight steps; brown and grey-blue eyes). A hypothesis to tune after play (decision LN1).
 */
export const TRAIT_POPULATION = {
  hair: [["black", 8], ["dark_brown", 30], ["brown", 24], ["chestnut", 12], ["auburn", 7], ["red", 4], ["blond", 10], ["flaxen", 5]],
  skin: [[0, 4], [1, 12], [2, 22], [3, 24], [4, 18], [5, 12], [6, 6], [7, 2]],
  eye: [["blue", 20], ["grey", 20], ["green", 8], ["hazel", 14], ["brown", 24], ["dark_brown", 14]],
  faceShape: [["long", 28], ["round", 26], ["square", 26], ["pointed", 20]],
  nose: [["straight", 34], ["hooked", 18], ["snub", 24], ["bulbous", 24]],
  buildBias: [["thin", 25], ["average", 50], ["heavy", 25]],
} as const satisfies { readonly [K in TraitKey]: readonly (readonly [PersonTraits[K], number])[] };

/** LN-2: the chance, permille, that a trait is not taken from a parent but drawn from the population (a mutation). */
export const TRAIT_MUTATION_PERMILLE = 50;

/** The person's `hair` words (the walker looks and cards read them) for each hair trait. */
export const HAIR_WORDS: Readonly<Record<HairTrait, string>> = {
  black: "black brown", dark_brown: "dark brown", brown: "golden brown", chestnut: "chestnut", auburn: "auburn brown",
  red: "copper red", blond: "ash blond", flaxen: "fair",
};

const has = (text: string, ...words: string[]) => words.some(word => text.includes(word));

/** A hair trait from a record's words (grey or white hair reads as the colour it had: "remnants of …", "… with grey"). */
export function hairFromWords(words: string): HairTrait | undefined {
  let text = words.toLowerCase();
  const remnant = /remnants? of (?:original )?([a-z -]+)/.exec(text);
  if (remnant !== null) text = remnant[1]!;
  text = text.replace(/with (?:scattered )?gr[ae]y strands|grey|gray|white|silver/g, " ");
  if (has(text, "flaxen", "fair", "pale", "straw")) return "flaxen";
  if (has(text, "copper red", "red wisp", "ginger") || /\bred\b/.test(text) && !has(text, "red brown", "red-brown")) return "red";
  if (has(text, "auburn", "copper", "red brown", "red-brown")) return "auburn";
  if (has(text, "blond", "sandy", "golden")) return text.includes("golden brown") ? "brown" : "blond";
  if (has(text, "chestnut")) return "chestnut";
  if (has(text, "black")) return has(text, "brown") ? "dark_brown" : "black";
  if (has(text, "dark brown", "dark ash brown", "dark-brown")) return "dark_brown";
  if (has(text, "brown")) return "brown";
  return undefined;
}

/** A skin step from a record's words. */
export function skinFromWords(words: string): number | undefined {
  const text = words.toLowerCase();
  if (text.trim() === "") return undefined;
  if (has(text, "deep", "dark")) return 7;
  if (has(text, "medium olive", "olive brown", "medium brown", "medium warm brown", "ruddy light brown")) return 6;
  if (has(text, "olive", "tan", "tawny", "sun-", "weathered", "medium warm", "medium")) return 5;
  if (has(text, "ruddy", "golden", "ochre", "warm beige", "light warm")) return 4;
  if (has(text, "beige", "peach", "rosy", "rose")) return 3;
  if (has(text, "very fair", "porcelain")) return 0;
  if (has(text, "cool pale", "pale")) return 1;
  if (has(text, "fair", "ivory", "cream", "pink")) return 2;
  return 3;
}

export function eyeFromWords(words: string): EyeTrait | undefined {
  const text = words.toLowerCase();
  if (has(text, "dark brown eye", "deep brown eye", "black eye", "dark eyes")) return "dark_brown";
  if (has(text, "hazel")) return "hazel";
  if (has(text, "green")) return "green";
  if (has(text, "blue")) return "blue";
  if (has(text, "grey", "gray")) return "grey";
  if (has(text, "brown eye", "brown")) return "brown";
  return undefined;
}

export function faceFromWords(words: string): FaceTrait | undefined {
  const text = words.toLowerCase();
  if (has(text, "heart", "triangular", "pointed", "wedge", "narrow chin", "tapered")) return "pointed";
  if (has(text, "square", "rectangular", "angular", "broad jaw", "wide jaw", "wide angular")) return "square";
  if (has(text, "round", "broad oval", "full cheeks", "short broad")) return "round";
  if (has(text, "long", "oblong", "narrow", "oval")) return "long";
  return undefined;
}

export function noseFromWords(words: string): NoseTrait | undefined {
  const text = words.toLowerCase();
  if (has(text, "aquiline", "hook", "roman", "beak", "arched nose")) return "hooked";
  if (has(text, "snub", "upturned", "button", "turned-up", "short nose", "short upturned")) return "snub";
  if (has(text, "bulbous", "broad nose", "wide nose", "fleshy", "broad flattened", "wide tip", "bulb", "flat nasal")) return "bulbous";
  if (has(text, "straight", "narrow nose", "long nose", "fine")) return "straight";
  return undefined;
}

export function buildFromWords(words: string): BuildTrait | undefined {
  const text = words.toLowerCase();
  if (has(text, "heavy", "fat", "stout", "broad fleshy")) return "heavy";
  if (has(text, "thin", "slender", "lean", "slim", "bony")) return "thin";
  if (has(text, "average", "sturdy", "broad")) return "average";
  return undefined;
}

/** LN-6: how far apart two sets of traits are (0 = the same; hair, face and nose weigh most — they carry the family look). */
export function traitDistance(a: Partial<PersonTraits>, b: Partial<PersonTraits>): number {
  let distance = 0;
  if (a.hair !== undefined && b.hair !== undefined && a.hair !== b.hair) distance += 3;
  if (a.skin !== undefined && b.skin !== undefined) distance += Math.min(3, Math.abs(a.skin - b.skin));
  if (a.eye !== undefined && b.eye !== undefined && a.eye !== b.eye) distance += 1;
  if (a.faceShape !== undefined && b.faceShape !== undefined && a.faceShape !== b.faceShape) distance += 2;
  if (a.nose !== undefined && b.nose !== undefined && a.nose !== b.nose) distance += 2;
  if (a.buildBias !== undefined && b.buildBias !== undefined && a.buildBias !== b.buildBias) distance += 1;
  return distance;
}
/** The largest `traitDistance` (every trait apart). */
export const MAX_TRAIT_DISTANCE = 12;
