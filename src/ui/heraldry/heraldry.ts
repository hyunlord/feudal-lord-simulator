import { PALETTE, RAMPS, type PaletteColor } from "../../content/palette";
import { hashSeed } from "../../engine/prng";

// UI-5 arms and merchant marks, composed from the Wave 14 masks (assets-inbox/wave14 records HERALDRY_COMPOSITION.md):
// a recipe is chosen from the game seed and the household (the same seed gives the same arms), then composed by
// `EmblemImage`. The rule of tincture holds: the field and its partition are colours, what lies on them (a chief, an
// ordinary, a charge) is a metal. Three shapes of arms, as the Wave 14 proofs show them:
//  - most: a partition of two colours and a metal charge;
//  - some: a plain field, a metal chief, a metal charge below it;
//  - a few: a plain field and a metal ordinary alone.
// The bordure is not used (its mask needs the shield-UV mapping of heraldry-bordure.cjs).
// A merchant's mark is one frame, one staff and one branch (the masks joined by their greatest coverage).

export const SHIELDS = ["heater", "knightly", "rounded"] as const;
export const PARTITIONS = ["barry", "paly", "per_bend", "per_bend_sinister", "per_chevron", "per_fess", "per_pale", "per_pale_indented", "per_saltire", "quarterly"] as const;
export const ORDINARIES = ["bend", "chevron", "cross", "fess", "pale", "saltire"] as const;
export const CHARGES = ["boar", "cartwheel", "crescent", "eagle", "fish", "fleur_de_lis", "lion_passant", "mullet", "rose", "stag_head", "tower", "wheatsheaf"] as const;
export const METALS = ["or", "argent"] as const;
export const COLOURS = ["gules", "azure", "vert", "sable"] as const;
export type Tincture = (typeof METALS)[number] | (typeof COLOURS)[number];

/** Tinctures in the game's palette (src/content/palette.ts). */
export const TINCTURES: Readonly<Record<Tincture, PaletteColor>> = {
  or: PALETTE.gold, argent: RAMPS.plaster[5], gules: PALETTE.vermilion, azure: PALETTE.ultramarine, vert: RAMPS.foliage[2], sable: PALETTE.ink,
};
/** The shield's outline and a merchant's ink. */
export const OUTLINE: PaletteColor = RAMPS.timber[0];
export const INK: PaletteColor = PALETTE.ink;

export type ArmsRecipe = Readonly<{
  shield: (typeof SHIELDS)[number];
  field: Tincture;
  partition: Readonly<{ id: (typeof PARTITIONS)[number]; tincture: Tincture }> | null;
  /** A chief or an ordinary (metal). */
  ordinary: Readonly<{ id: (typeof ORDINARIES)[number] | "chief"; tincture: Tincture }> | null;
  charge: Readonly<{ id: (typeof CHARGES)[number]; tincture: Tincture }> | null;
}>;

export const MERCHANT_FRAMES = ["circle", "shield"] as const;
export const MERCHANT_STAFFS = ["figure4", "pennant", "rake", "topcross"] as const;
export const MERCHANT_BRANCHES = ["diagonal", "diamond", "double_fork", "horizontal", "loop", "steps", "v", "w"] as const;
export type MerchantRecipe = Readonly<{ frame: (typeof MERCHANT_FRAMES)[number]; staff: (typeof MERCHANT_STAFFS)[number]; branch: (typeof MERCHANT_BRANCHES)[number] }>;

/** A deterministic pick sequence for one key (the state seed, a salt, the key's characters). */
function picker(seed: number, salt: string, key: string) {
  const codes = [...key].map(char => char.charCodeAt(0));
  let step = 0;
  return <T>(options: readonly T[]): T => options[hashSeed(seed, salt, ...codes, step++) % options.length]!;
}

export function armsRecipe(seed: number, household: string): ArmsRecipe {
  const pick = picker(seed, "arms", household);
  const shield = pick(SHIELDS);
  const field = pick(COLOURS);
  const other = pick(COLOURS.filter(colour => colour !== field));
  const metal = pick(METALS);
  const kind = pick(["partition", "partition", "partition", "partition", "partition", "partition", "partition", "chief", "chief", "ordinary"] as const);
  if (kind === "ordinary") return { shield, field, partition: null, ordinary: { id: pick(ORDINARIES), tincture: metal }, charge: null };
  if (kind === "chief") return { shield, field, partition: null, ordinary: { id: "chief", tincture: metal }, charge: { id: pick(CHARGES), tincture: pick(METALS) } };
  return { shield, field, partition: { id: pick(PARTITIONS), tincture: other }, ordinary: null, charge: { id: pick(CHARGES), tincture: metal } };
}

/** FACTION-0 / UI-6: a faction's arms from its heraldry seed (the nine factions; the lord's house keeps its own key). */
export function heraldryArms(heraldrySeed: number): ArmsRecipe {
  return armsRecipe(heraldrySeed, "heraldry");
}

export function merchantRecipe(seed: number, household: string): MerchantRecipe {
  const pick = picker(seed, "merchant", household);
  return { frame: pick(MERCHANT_FRAMES), staff: pick(MERCHANT_STAFFS), branch: pick(MERCHANT_BRANCHES) };
}

export const armsKey = (recipe: ArmsRecipe) => [recipe.shield, recipe.field, recipe.partition?.id, recipe.partition?.tincture, recipe.ordinary?.id,
  recipe.ordinary?.tincture, recipe.charge?.id, recipe.charge?.tincture].join(".");
export const merchantKey = (recipe: MerchantRecipe) => [recipe.frame, recipe.staff, recipe.branch].join(".");

/**
 * UI-6 (FACTION-0 FX-1): arms and a merchant's mark from an engine `heraldrySeed` (the nine factions'). One key for every
 * screen that draws a faction, so the chronicle's faction tab and any other place show the same shield. The lord's own
 * house keeps its own key (`MANOR_HOUSEHOLD`, the arms the screens drew before FAIL-3).
 */
export const heraldryArms = (heraldrySeed: number): ArmsRecipe => armsRecipe(heraldrySeed, "heraldry");
export const heraldryMark = (heraldrySeed: number): MerchantRecipe => merchantRecipe(heraldrySeed, "heraldry");
