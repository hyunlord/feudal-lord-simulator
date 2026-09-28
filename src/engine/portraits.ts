import { FACTION_HEAD_RANKS } from "../content/factionConfig";
import { MAX_TRAIT_DISTANCE, traitDistance, type PersonTraits } from "../content/personTraits";
import { PORTRAIT_POOL, type PortraitEntry } from "../content/portraitPool";
import { hashSeed } from "./prng";
import type { Person, PersonAgeBand } from "./persons.types";

/**
 * PERSON-0 PS-5: portraits from the pool (304 pictures, 124 identities; aging chains child → young → mature → old).
 * A person keeps one identity; its stage follows the person's age band. The identity is chosen deterministically from
 * sex, age band, class, build and trade or office, preferring the identities least used in the town; a person whose
 * identity has no picture for a new age band is given a new identity (a pilot face has one age only).
 *
 * CODE-1a: pool 3 (I101–I124) is the factions' leaders' own — the town's people never draw it; a faction's leaders and
 * heirs are drawn from its pool-3 faces only (`chooseFactionPortraitIdentity`).
 *
 * FIX-4 (HR-12): from 8 to 13 (the child band) only the pool's child pictures are chosen or shown, never an adult's as
 * the nearest (a two-year-old was drawn as a grown woman).
 *
 * PERSON-1a (spec docs/design/lineage.md LN-6, decision LN4 — replaces HR-12's silhouette under 8): a baby (0–2), a
 * toddler (3–5) and a small child (6–7) show their lineage set's picture of the age if they have one, else the common
 * pool's of their sex whose traits are nearest theirs; with none of their sex, a silhouette key. The town's faces are
 * chosen by trait distance after sex, age band and class (the clothes are the class, the face the traits, LN3); the
 * lineage sets (L1–L8) and the common pool are not among them.
 */
export const PORTRAIT_MIN_AGE = 8;
export const INFANT_AGE = 3;
export type PortraitSilhouette = "infant" | "child";
export const SILHOUETTE_PORTRAIT_ID: Readonly<Record<PortraitSilhouette, string>> = { infant: "silhouette_infant", child: "silhouette_child" };

export const PORTRAIT_BAND: Readonly<Record<PersonAgeBand, PortraitEntry["band"]>> = { child: "child", youth: "young", adult: "mature", elder: "old" };

const BY_IDENTITY = new Map<string, PortraitEntry[]>();
for (const entry of PORTRAIT_POOL) BY_IDENTITY.set(entry.identityId, [...(BY_IDENTITY.get(entry.identityId) ?? []), entry]);
const IDENTITIES = [...BY_IDENTITY.keys()].filter(identityId => BY_IDENTITY.get(identityId)![0]!.faction === undefined
  && BY_IDENTITY.get(identityId)![0]!.lineage === undefined).sort();
const CHILD_IDENTITIES = IDENTITIES.filter(identityId => (BY_IDENTITY.get(identityId) ?? []).some(entry => entry.band === "child"));
const COMMON_YOUNG = PORTRAIT_POOL.filter(entry => entry.lineage === "common");
const BAND_ORDER: readonly PortraitEntry["band"][] = ["baby", "toddler", "child", "young", "mature", "old"];
const YOUNG_STAGES: ReadonlySet<PortraitEntry["band"]> = new Set(["baby", "toddler", "child"]);

/** The identity's picture for an age band, else the nearest band it has (never an older face for a child, HR-12). */
function pictureFor(identityId: string, band: PortraitEntry["band"]): { readonly entry: PortraitEntry; readonly exactBand: boolean } | null {
  const entries = BY_IDENTITY.get(identityId);
  if (entries === undefined || entries.length === 0) return null;
  const exact = entries.find(entry => entry.band === band && entry.stage !== "pool") ?? entries.find(entry => entry.band === band);
  if (exact !== undefined) return { entry: exact, exactBand: true };
  if (YOUNG_STAGES.has(band)) return null;
  // An adult's nearest picture is an adult's (a lineage face's baby picture never stands in for a grown person).
  const grown = entries.filter(entry => !YOUNG_STAGES.has(entry.band));
  if (grown.length === 0) return null;
  const target = BAND_ORDER.indexOf(band);
  const nearest = [...grown].sort((a, b) => Math.abs(BAND_ORDER.indexOf(a.band) - target) - Math.abs(BAND_ORDER.indexOf(b.band) - target))[0]!;
  return { entry: nearest, exactBand: false };
}

/** LN-6: the picture stage of a young child's age (baby 0–2, toddler 3–5, child 6+). */
export function youngStageOf(age: number): "baby" | "toddler" | "child" {
  return age < 3 ? "baby" : age < 6 ? "toddler" : "child";
}

/** LN-6: the common pool's picture of the stage and sex whose traits are nearest the person's (null: none of the sex). */
function commonPicture(person: Pick<Person, "sex"> & Partial<Pick<Person, "id" | "traits">>, stage: PortraitEntry["band"]): PortraitEntry | null {
  const candidates = COMMON_YOUNG.filter(entry => entry.band === stage && entry.sex === person.sex);
  let best: { entry: PortraitEntry; distance: number; tie: number } | null = null;
  for (const entry of candidates) {
    const distance = person.traits === undefined ? 0 : traitDistance(person.traits, entry.traits);
    const tie = hashSeed(0, `common-face:${person.id ?? ""}`, ...[...entry.id].map(char => char.charCodeAt(0)));
    if (best === null || distance < best.distance || (distance === best.distance && tie < best.tie)) best = { entry, distance, tie };
  }
  return best?.entry ?? null;
}

/** The office or trade words a portrait's occupation answers to. */
function tradeMatches(person: Pick<Person, "occupation" | "tags" | "role">, entry: PortraitEntry): boolean {
  const occupation = entry.occupation.toLowerCase();
  if (occupation === "") return false;
  if (person.role === "steward") return occupation.includes("steward");
  if (person.tags.includes("reeve")) return occupation.includes("reeve");
  if (person.tags.some(tag => tag.startsWith("petitioner:"))) return occupation.includes("merchant") || occupation.includes("trader");
  return person.occupation !== "labourer" && person.occupation !== "child" && occupation.includes(person.occupation);
}

export interface PortraitChoice {
  readonly identityId: string;
  readonly stage: string;
  readonly portraitId: string;
  readonly file: string;
  /** Sex, age band and class all match (a child's class is not asked); otherwise the nearest picture. */
  readonly exact: boolean;
  /** HR-12: set when the person is drawn as a figure instead of a portrait (under 8, or a child face the pool lacks). */
  readonly silhouette?: PortraitSilhouette;
}

function exactFor(person: Pick<Person, "sex" | "classBand">, band: PortraitEntry["band"], entry: PortraitEntry, exactBand: boolean): boolean {
  return entry.sex === person.sex && exactBand && (band === "child" || entry.classBand === person.classBand);
}

/**
 * PS-5: chooses a portrait identity: exact matches first (sex, age band, class), then trade or office, build; among
 * equals the identity used least by the living in town (`usage`), then a hash of the person and the identity.
 * `exclude` (HR-12): identities another person in the same scene already shows (a petition's petitioners).
 */
type Chooser = Pick<Person, "id" | "sex" | "classBand" | "build" | "occupation" | "tags" | "role"> & { readonly traits?: PersonTraits };

export function choosePortraitIdentity(stateSeed: number, person: Chooser,
  band: PersonAgeBand, usage: ReadonlyMap<string, number>, exclude: ReadonlySet<string> = new Set()): string {
  // HR-12: a child (and a baby, whose face comes at 8) is chosen among the child pictures only.
  const pool = identitiesForBand(band).filter(identityId => !exclude.has(identityId));
  return bestIdentity(stateSeed, person, band, usage, pool.length > 0 ? pool : identitiesForBand(band)) ?? identitiesForBand(band)[0]!;
}

/**
 * CODE-1a: a faction's leader — the best of its pool-3 faces (`factions`: `PortraitEntry.faction` values) by the same
 * scores, a head's rank first (`FACTION_HEAD_RANKS`); `exclude` (a predecessor's face) unless it is the only one left.
 * Null when none is of the person's sex (the person keeps the town's pick).
 */
export function chooseFactionPortraitIdentity(stateSeed: number, person: Chooser,
  band: PersonAgeBand, usage: ReadonlyMap<string, number>, factions: readonly string[], exclude: ReadonlySet<string> = new Set()): string | null {
  const faces = [...BY_IDENTITY.keys()].sort().filter(identityId => factions.includes(BY_IDENTITY.get(identityId)![0]!.faction ?? "")
    && BY_IDENTITY.get(identityId)![0]!.sex === person.sex);
  const heads = faces.filter(identityId => FACTION_HEAD_RANKS.includes(BY_IDENTITY.get(identityId)![0]!.rank ?? ""));
  const preferred = heads.filter(identityId => !exclude.has(identityId));
  const rest = faces.filter(identityId => !exclude.has(identityId));
  return bestIdentity(stateSeed, person, band, usage, preferred.length > 0 ? preferred : rest.length > 0 ? rest : faces);
}

function bestIdentity(stateSeed: number, person: Chooser,
  band: PersonAgeBand, usage: ReadonlyMap<string, number>, candidates: readonly string[]): string | null {
  const target = PORTRAIT_BAND[band];
  let best: { identityId: string; score: number; tie: number } | null = null;
  for (const identityId of candidates) {
    const picture = pictureFor(identityId, target);
    if (picture === null) continue;
    const { entry, exactBand } = picture;
    let score = 0;
    if (entry.sex === person.sex) score += 1_000_000;
    if (exactBand) score += 100_000;
    if (target === "child" || entry.classBand === person.classBand) score += 10_000;
    // LN-6: then the traits (the whole distance is worth more than a trade and every repeat penalty together).
    if (person.traits !== undefined) score += (MAX_TRAIT_DISTANCE - traitDistance(person.traits, entry.traits)) * 800;
    if (tradeMatches(person, entry)) score += 3_000;
    if (entry.build === person.build) score += 500;
    if ((BY_IDENTITY.get(identityId)?.length ?? 0) > 1) score += 200; // an aging chain keeps the face as the person ages
    // Each time the town already uses the face outweighs build and chain, never an exact match (fewest repeats first).
    score -= Math.min(4_900, (usage.get(identityId) ?? 0) * 1_000);
    const tie = hashSeed(stateSeed, `portrait:${person.id}`, ...[...identityId].map(char => char.charCodeAt(0)));
    if (best === null || score > best.score || (score === best.score && tie < best.tie)) best = { identityId, score, tie };
  }
  return best?.identityId ?? null;
}

/** HR-12: the figure drawn instead of a portrait (a young child with no picture of their stage and sex). */
function silhouetteChoice(person: Pick<Person, "portraitIdentity">, kind: PortraitSilhouette, exact: boolean): PortraitChoice {
  return { identityId: person.portraitIdentity, stage: kind, portraitId: SILHOUETTE_PORTRAIT_ID[kind], file: "", exact, silhouette: kind };
}

/**
 * PS-5 `portraitFor`: the person's identity at the stage of their age band. LN-6: under 8 the lineage set's picture of
 * the age, else the common pool's nearest, else a silhouette key; a child whose identity has no child picture is also a
 * (child) figure — never an adult face.
 */
export function portraitFor(person: Pick<Person, "portraitIdentity" | "sex" | "classBand"> & Partial<Pick<Person, "id" | "traits">>, band: PersonAgeBand,
  age?: number): PortraitChoice {
  if (age !== undefined && age < PORTRAIT_MIN_AGE) {
    const stage = youngStageOf(age);
    const own = pictureFor(person.portraitIdentity, stage);
    const entry = own?.entry ?? commonPicture(person, stage);
    if (entry === null) return silhouetteChoice(person, age < INFANT_AGE ? "infant" : "child", true);
    return { identityId: entry.identityId, stage: entry.stage, portraitId: entry.id, file: entry.file, exact: entry.sex === person.sex };
  }
  const target = PORTRAIT_BAND[band];
  const picture = pictureFor(person.portraitIdentity, target) ?? (target === "child" ? null : pictureFor(IDENTITIES[0]!, target));
  if (picture === null) return silhouetteChoice(person, "child", false);
  return { identityId: picture.entry.identityId, stage: picture.entry.stage, portraitId: picture.entry.id, file: picture.entry.file,
    exact: exactFor(person, target, picture.entry, picture.exactBand) };
}

/** PERSON-1a (LN-7): the lineage set (L1–L8, or `common`) a face belongs to (undefined for the town's pools). */
export function identityLineage(identityId: string): string | undefined {
  return BY_IDENTITY.get(identityId)?.[0]?.lineage;
}

/** LN-7: a set's places — each identity's sex, generation, whether it married in (no parents in the set), its bands. */
export interface SetPlace {
  readonly identityId: string;
  readonly sex: "female" | "male";
  readonly generation: number;
  readonly inLaw: boolean;
  readonly bands: ReadonlySet<PortraitEntry["band"]>;
}
const SET_PLACES = new Map<string, SetPlace[]>();
for (const [identityId, entries] of [...BY_IDENTITY.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const first = entries[0]!;
  if (first.lineage === undefined || first.lineage === "common") continue;
  const generation = first.generation ?? Number(/_(\d)/.exec(identityId)?.[1] ?? 0);
  const place: SetPlace = { identityId, sex: first.sex, generation, inLaw: generation >= 2 && entries.every(entry => entry.father === undefined && entry.mother === undefined)
    && /_2(05|06|S\d)$/.test(identityId), bands: new Set(entries.map(entry => entry.band)) };
  SET_PLACES.set(first.lineage, [...(SET_PLACES.get(first.lineage) ?? []), place]);
}
export function setPlaces(set: string): readonly SetPlace[] {
  return SET_PLACES.get(set) ?? [];
}

/** CODE-1a: the pool-3 faction a face belongs to (undefined for the town's pools). */
export function identityFaction(identityId: string): string | undefined {
  return BY_IDENTITY.get(identityId)?.[0]?.faction;
}

/** HR-12: identities that can be shown in the band — for the child band only those with a child picture. */
export function identitiesForBand(band: PersonAgeBand): readonly string[] {
  return PORTRAIT_BAND[band] === "child" ? CHILD_IDENTITIES : IDENTITIES;
}

/** Whether the identity has a picture of the band (else the person gets a new identity when they reach it). */
export function identityHasBand(identityId: string, band: PersonAgeBand): boolean {
  return pictureFor(identityId, PORTRAIT_BAND[band])?.exactBand === true;
}
