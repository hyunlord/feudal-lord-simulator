/**
 * PERSON-0 (spec docs/design/persons.md PS-2): names of southern England, 1300–1450. Given names are weighted by
 * how often they appear in lay subsidy and poll-tax rolls of the period (a handful of names carry most people: John,
 * William, Thomas, Richard, Robert; Alice, Agnes, Joan, Matilda, Margery). Surnames were still settling in 1300, so a
 * household takes one when it forms — from the head's trade, the place of the house, or the head's father — and keeps it.
 * Names are proper nouns in the period's English, not UI copy.
 */
export interface WeightedName { readonly name: string; readonly weight: number }

export const MALE_GIVEN_NAMES: readonly WeightedName[] = [
  { name: "John", weight: 200 }, { name: "William", weight: 140 }, { name: "Thomas", weight: 90 }, { name: "Richard", weight: 80 },
  { name: "Robert", weight: 70 }, { name: "Walter", weight: 45 }, { name: "Henry", weight: 40 }, { name: "Roger", weight: 35 },
  { name: "Hugh", weight: 30 }, { name: "Nicholas", weight: 30 }, { name: "Adam", weight: 28 }, { name: "Simon", weight: 25 },
  { name: "Geoffrey", weight: 22 }, { name: "Ralph", weight: 20 }, { name: "Stephen", weight: 18 }, { name: "Gilbert", weight: 16 },
  { name: "Peter", weight: 15 }, { name: "Philip", weight: 12 }, { name: "Reginald", weight: 10 }, { name: "Alan", weight: 10 },
  { name: "Laurence", weight: 9 }, { name: "Hamo", weight: 6 }, { name: "Osbert", weight: 5 }, { name: "Elias", weight: 5 },
  { name: "Jordan", weight: 5 }, { name: "Bartholomew", weight: 5 }, { name: "Martin", weight: 6 }, { name: "Andrew", weight: 6 },
  { name: "Edmund", weight: 6 }, { name: "Matthew", weight: 6 },
];

export const FEMALE_GIVEN_NAMES: readonly WeightedName[] = [
  { name: "Alice", weight: 150 }, { name: "Agnes", weight: 120 }, { name: "Joan", weight: 100 }, { name: "Matilda", weight: 80 },
  { name: "Margery", weight: 60 }, { name: "Emma", weight: 45 }, { name: "Isabel", weight: 40 }, { name: "Juliana", weight: 30 },
  { name: "Christina", weight: 28 }, { name: "Cecily", weight: 26 }, { name: "Margaret", weight: 25 }, { name: "Edith", weight: 20 },
  { name: "Beatrice", weight: 18 }, { name: "Avice", weight: 14 }, { name: "Lucy", weight: 12 }, { name: "Petronilla", weight: 10 },
  { name: "Amice", weight: 10 }, { name: "Sibyl", weight: 10 }, { name: "Mabel", weight: 9 }, { name: "Rose", weight: 9 },
  { name: "Katherine", weight: 9 }, { name: "Elena", weight: 8 }, { name: "Denise", weight: 7 }, { name: "Felicia", weight: 6 },
  { name: "Hawise", weight: 6 }, { name: "Idonea", weight: 5 }, { name: "Letitia", weight: 5 }, { name: "Gillian", weight: 6 },
  { name: "Clarice", weight: 5 }, { name: "Eleanor", weight: 5 },
];

/** Occupational surnames, by the trade a household head takes (PS-2; `labourer` heads get a place or a father's name). */
export const OCCUPATIONAL_SURNAMES: Readonly<Record<string, string>> = {
  miller: "Miller", baker: "Baker", smith: "Smith", carter: "Carter", granger: "Granger", sawyer: "Sawyer", woodward: "Woodward",
  mason: "Mason", quarrier: "Quarrier", husbandman: "Hayward", chapman: "Chapman", storekeeper: "Spenser", reeve: "Reeve",
};

export const TOPOGRAPHIC_SURNAMES: readonly string[] = [
  "atte Well", "atte Wood", "atte Brook", "atte Hill", "atte Green", "atte Mill", "atte Bridge", "atte Lane", "atte Moor", "atte Field",
  "Bywater", "Underwood", "Townsend", "Hatch", "Westbrook", "Northwood",
];

/** Patronymics from the head's father's given name (PS-2). */
export const PATRONYMIC_SURNAMES: Readonly<Record<string, string>> = {
  John: "Johnson", William: "Williamson", Thomas: "Thomson", Richard: "Richardson", Robert: "Robertson", Walter: "Watson",
  Henry: "Harrison", Roger: "Hodgson", Hugh: "Hewson", Nicholas: "Nicholson", Adam: "Adamson", Simon: "Simmonds",
  Geoffrey: "Jefferson", Ralph: "Rawlinson", Stephen: "Stevenson", Gilbert: "Gibson", Peter: "Pearson", Philip: "Phillipson",
};

/** Byname for namesakes in the town (PS-2): elder and younger first, then a byname, then an ordinal. */
export const NAMESAKE_EPITHETS: readonly string[] = [
  "the elder", "the younger", "le Rous", "le Brun", "le Blund", "le Long", "le Petit", "le Wyte", "le Neve", "le Gode",
];
export const ORDINAL_EPITHETS: readonly string[] = ["the third", "the fourth", "the fifth", "the sixth", "the seventh", "the eighth", "the ninth", "the tenth"];

export const HAIR_COLOURS: readonly string[] = ["dark brown", "black brown", "chestnut", "dark chestnut", "golden brown", "sandy brown", "copper red", "auburn brown", "ash blond", "fair"];
