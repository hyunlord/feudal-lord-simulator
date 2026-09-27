import { PORTRAIT_POOL, type PortraitEntry } from "../content/portraitPool";
import { hashSeed } from "./prng";
import type { Person, PersonAgeBand } from "./persons.types";

/**
 * PERSON-0 PS-5: portraits from the pool (232 pictures, 100 identities; aging chains child → young → mature → old).
 * A person keeps one identity; its stage follows the person's age band. The identity is chosen deterministically from
 * sex, age band, class, build and trade or office, preferring the identities least used in the town; a person whose
 * identity has no picture for a new age band is given a new identity (a pilot face has one age only).
 *
 * FIX-4 (HR-12): under `PORTRAIT_MIN_AGE` a person has no portrait — `portraitFor` returns a silhouette key (infant
 * under `INFANT_AGE`, else child) that the screens draw as a figure. From 8 to 13 (the child band) only the pool's
 * child pictures are chosen or shown, never an adult's as the nearest (a two-year-old was drawn as a grown woman).
 */
export const PORTRAIT_MIN_AGE = 8;
export const INFANT_AGE = 3;
export type PortraitSilhouette = "infant" | "child";
export const SILHOUETTE_PORTRAIT_ID: Readonly<Record<PortraitSilhouette, string>> = { infant: "silhouette_infant", child: "silhouette_child" };

export const PORTRAIT_BAND: Readonly<Record<PersonAgeBand, PortraitEntry["band"]>> = { child: "child", youth: "young", adult: "mature", elder: "old" };

const BY_IDENTITY = new Map<string, PortraitEntry[]>();
for (const entry of PORTRAIT_POOL) BY_IDENTITY.set(entry.identityId, [...(BY_IDENTITY.get(entry.identityId) ?? []), entry]);
const IDENTITIES = [...BY_IDENTITY.keys()].sort();
const CHILD_IDENTITIES = IDENTITIES.filter(identityId => (BY_IDENTITY.get(identityId) ?? []).some(entry => entry.band === "child"));
const BAND_ORDER: readonly PortraitEntry["band"][] = ["child", "young", "mature", "old"];

/** The identity's picture for an age band, else the nearest band it has (never an older face for a child, HR-12). */
function pictureFor(identityId: string, band: PortraitEntry["band"]): { readonly entry: PortraitEntry; readonly exactBand: boolean } | null {
  const entries = BY_IDENTITY.get(identityId);
  if (entries === undefined || entries.length === 0) return null;
  const exact = entries.find(entry => entry.band === band && entry.stage !== "pool") ?? entries.find(entry => entry.band === band);
  if (exact !== undefined) return { entry: exact, exactBand: true };
  if (band === "child") return null;
  const target = BAND_ORDER.indexOf(band);
  const nearest = [...entries].sort((a, b) => Math.abs(BAND_ORDER.indexOf(a.band) - target) - Math.abs(BAND_ORDER.indexOf(b.band) - target))[0]!;
  return { entry: nearest, exactBand: false };
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
export function choosePortraitIdentity(stateSeed: number, person: Pick<Person, "id" | "sex" | "classBand" | "build" | "occupation" | "tags" | "role">,
  band: PersonAgeBand, usage: ReadonlyMap<string, number>, exclude: ReadonlySet<string> = new Set()): string {
  const target = PORTRAIT_BAND[band];
  let best: { identityId: string; score: number; tie: number } | null = null;
  // HR-12: a child (and a baby, whose face comes at 8) is chosen among the child pictures only.
  const pool = identitiesForBand(band).filter(identityId => !exclude.has(identityId));
  for (const identityId of pool.length > 0 ? pool : identitiesForBand(band)) {
    const picture = pictureFor(identityId, target);
    if (picture === null) continue;
    const { entry, exactBand } = picture;
    let score = 0;
    if (entry.sex === person.sex) score += 1_000_000;
    if (exactBand) score += 100_000;
    if (target === "child" || entry.classBand === person.classBand) score += 10_000;
    if (tradeMatches(person, entry)) score += 5_000;
    if (entry.build === person.build) score += 500;
    if ((BY_IDENTITY.get(identityId)?.length ?? 0) > 1) score += 200; // an aging chain keeps the face as the person ages
    // Each time the town already uses the face outweighs build and chain, never an exact match (fewest repeats first).
    score -= Math.min(4_900, (usage.get(identityId) ?? 0) * 1_000);
    const tie = hashSeed(stateSeed, `portrait:${person.id}`, ...[...identityId].map(char => char.charCodeAt(0)));
    if (best === null || score > best.score || (score === best.score && tie < best.tie)) best = { identityId, score, tie };
  }
  return best?.identityId ?? identitiesForBand(band)[0]!;
}

/** HR-12: the figure drawn instead of a portrait. It matches the person (a figure is the right picture under 8). */
function silhouetteChoice(person: Pick<Person, "portraitIdentity">, kind: PortraitSilhouette, exact: boolean): PortraitChoice {
  return { identityId: person.portraitIdentity, stage: kind, portraitId: SILHOUETTE_PORTRAIT_ID[kind], file: "", exact, silhouette: kind };
}

/**
 * PS-5 `portraitFor`: the person's identity at the stage of their age band. HR-12: with `age` under 8 a silhouette key;
 * a child whose identity has no child picture is also a (child) figure — never an adult face.
 */
export function portraitFor(person: Pick<Person, "portraitIdentity" | "sex" | "classBand">, band: PersonAgeBand, age?: number): PortraitChoice {
  if (age !== undefined && age < PORTRAIT_MIN_AGE) return silhouetteChoice(person, age < INFANT_AGE ? "infant" : "child", true);
  const target = PORTRAIT_BAND[band];
  const picture = pictureFor(person.portraitIdentity, target) ?? (target === "child" ? null : pictureFor(IDENTITIES[0]!, target));
  if (picture === null) return silhouetteChoice(person, "child", false);
  return { identityId: picture.entry.identityId, stage: picture.entry.stage, portraitId: picture.entry.id, file: picture.entry.file,
    exact: exactFor(person, target, picture.entry, picture.exactBand) };
}

/** HR-12: identities that can be shown in the band — for the child band only those with a child picture. */
export function identitiesForBand(band: PersonAgeBand): readonly string[] {
  return PORTRAIT_BAND[band] === "child" ? CHILD_IDENTITIES : IDENTITIES;
}

/** Whether the identity has a picture of the band (else the person gets a new identity when they reach it). */
export function identityHasBand(identityId: string, band: PersonAgeBand): boolean {
  return pictureFor(identityId, PORTRAIT_BAND[band])?.exactBand === true;
}
