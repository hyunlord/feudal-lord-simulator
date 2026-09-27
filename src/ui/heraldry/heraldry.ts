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

/**
 * UI-6b: the Crown bears the king's own arms, not a seed's: England — gules, three lions passant in pale, or — until
 * Edward III quartered them with France ancient (azure semé de lis, or) in 1340: 1 and 4 France, 2 and 3 England.
 * Composed from the Wave 14 lion and lis charges on the heater shield (`EmblemImage`). The Wave 14 lion is passant in
 * profile: the batch has no guardant (full-face) lion.
 */
export type RoyalArms = "england" | "france_england";
export const ROYAL_QUARTERED_FROM_YEAR = 1340;
export const royalArms = (year: number): RoyalArms => year >= ROYAL_QUARTERED_FROM_YEAR ? "france_england" : "england";

type Box = Readonly<{ x: number; y: number; width: number; height: number }>;
const square = (x: number, y: number, size: number): Box => ({ x, y, width: size, height: size });
/** A semé: charges in staggered rows over a quarter's box (the quarter's mask and the shield clip them). */
function seme(x0: number, x1: number, y0: number, y1: number, size: number): readonly Box[] {
  const boxes: Box[] = [];
  for (let row = 0, y = y0; y < y1; row += 1, y += size) {
    for (let x = x0 - (row % 2 === 0 ? 0 : size / 2); x < x1; x += size) boxes.push(square(x, y, size));
  }
  return boxes;
}
/** Where the charges lie on the 256 px heater shield (its fill spans x 34–222, y 28–234; the quarters meet at 128). */
export const ROYAL_LAYOUT: Readonly<Record<RoyalArms, Readonly<{ lions: readonly Box[]; lis: readonly Box[] }>>> = {
  england: { lions: [square(84, 26, 88), square(88, 92, 80), square(95, 154, 66)], lis: [] },
  france_england: {
    lions: [square(158, 30, 34), square(158, 61, 34), square(159, 92, 32), square(78, 131, 34), square(82, 162, 32), square(88, 191, 28)],
    lis: [...seme(34, 128, 30, 128, 30), ...seme(128, 222, 130, 234, 30)],
  },
};
