/**
 * DEC-TRACE §3 (docs/design/dec-trace.md, A1·A3, the user's decision 2026-10-06): a faction's mind becomes an act.
 * At a season's end, a faction whose relation stands past ±30 and has moved on by 10 that way since its last act acts
 * small (once a year at most); past ±60, large (once in ten years at most). The acts by the faction's kind, both ways;
 * the neighbour houses act by the same table (A3, P-W2).
 */
import type { FactionKind } from "./factionConfig";

export const FACTION_ACT_BALANCE = {
  smallAt: 30,
  largeAt: 60,
  /** A small act again needs the relation to have moved on this far the same way since the last one. */
  smallStep: 10,
  smallEveryYears: 1,
  largeEveryYears: 10,
  /** A small gift or demand: this share of the estate's year of income (at most 5 %), a shilling at least. */
  smallMoneyPermille: 50,
  smallMoneyFloor: 12,
  /** A large gift, endowment or fine: this share. */
  largeMoneyPermille: 150,
  largeMoneyFloor: 60,
  /** Households that come or go in a large act. */
  largeHouseholds: 3,
  /** A claim's strength the overlord's or the crown's favour adds (small) or confirms (large). */
  favourStrength: 10,
  confirmStrength: 25,
} as const;

/** What an act does. */
export type FactionActEffect =
  | { readonly effect: "arrive"; readonly households: "one" | "large" }
  | { readonly effect: "depart"; readonly households: "one" | "large" }
  | { readonly effect: "actor_funds"; readonly actor: "merchants" | "community" | "church" | "guild"; readonly sign: 1 | -1; readonly size: "small" | "large" }
  | { readonly effect: "treasury"; readonly sign: 1 | -1; readonly size: "small" | "large" }
  | { readonly effect: "claim_strength"; readonly size: "small" | "large" }
  | { readonly effect: "claim_against"; readonly sue: boolean };

export interface FactionActDef {
  readonly id: string;
  /** What it does, in order (the first that can be done; a gift stands in when none can). */
  readonly effects: readonly FactionActEffect[];
}

export interface FactionActRow {
  readonly favourSmall: FactionActDef;
  readonly favourLarge: FactionActDef;
  readonly grudgeSmall: FactionActDef;
  readonly grudgeLarge: FactionActDef;
}

/** The acts by kind (dec-trace.md §3's table). */
export const FACTION_ACTS: Readonly<Record<FactionKind, FactionActRow>> = {
  merchant_house: {
    favourSmall: { id: "merchant_invest", effects: [{ effect: "actor_funds", actor: "merchants", sign: 1, size: "small" }] },
    favourLarge: { id: "merchant_settle", effects: [{ effect: "arrive", households: "large" }, { effect: "actor_funds", actor: "merchants", sign: 1, size: "large" }] },
    grudgeSmall: { id: "merchant_withdraw", effects: [{ effect: "actor_funds", actor: "merchants", sign: -1, size: "small" }] },
    grudgeLarge: { id: "merchant_leave", effects: [{ effect: "depart", households: "large" }] },
  },
  commons: {
    favourSmall: { id: "commons_settle", effects: [{ effect: "arrive", households: "one" }] },
    favourLarge: { id: "commons_flock", effects: [{ effect: "arrive", households: "large" }] },
    grudgeSmall: { id: "commons_leave", effects: [{ effect: "depart", households: "one" }] },
    grudgeLarge: { id: "commons_exodus", effects: [{ effect: "depart", households: "large" }] },
  },
  town: {
    favourSmall: { id: "town_fund", effects: [{ effect: "actor_funds", actor: "community", sign: 1, size: "small" }] },
    favourLarge: { id: "town_works", effects: [{ effect: "actor_funds", actor: "community", sign: 1, size: "large" }] },
    grudgeSmall: { id: "town_withhold", effects: [{ effect: "treasury", sign: -1, size: "small" }] },
    grudgeLarge: { id: "town_boycott", effects: [{ effect: "actor_funds", actor: "guild", sign: -1, size: "large" }, { effect: "actor_funds", actor: "community", sign: -1, size: "large" }] },
  },
  church: {
    favourSmall: { id: "church_gift", effects: [{ effect: "treasury", sign: 1, size: "small" }] },
    favourLarge: { id: "church_endow", effects: [{ effect: "actor_funds", actor: "church", sign: 1, size: "large" }] },
    grudgeSmall: { id: "church_demand", effects: [{ effect: "treasury", sign: -1, size: "small" }] },
    grudgeLarge: { id: "church_penance", effects: [{ effect: "treasury", sign: -1, size: "large" }] },
  },
  overlord: {
    favourSmall: { id: "overlord_favour", effects: [{ effect: "claim_strength", size: "small" }, { effect: "treasury", sign: 1, size: "small" }] },
    favourLarge: { id: "overlord_confirm", effects: [{ effect: "claim_strength", size: "large" }, { effect: "treasury", sign: 1, size: "large" }] },
    grudgeSmall: { id: "overlord_aid", effects: [{ effect: "treasury", sign: -1, size: "small" }] },
    grudgeLarge: { id: "overlord_fine", effects: [{ effect: "treasury", sign: -1, size: "large" }] },
  },
  crown: {
    favourSmall: { id: "crown_favour", effects: [{ effect: "claim_strength", size: "small" }, { effect: "treasury", sign: 1, size: "small" }] },
    favourLarge: { id: "crown_confirm", effects: [{ effect: "claim_strength", size: "large" }, { effect: "treasury", sign: 1, size: "large" }] },
    grudgeSmall: { id: "crown_aid", effects: [{ effect: "treasury", sign: -1, size: "small" }] },
    grudgeLarge: { id: "crown_fine", effects: [{ effect: "treasury", sign: -1, size: "large" }] },
  },
  neighbour: {
    favourSmall: { id: "neighbour_support", effects: [{ effect: "claim_strength", size: "small" }, { effect: "treasury", sign: 1, size: "small" }] },
    favourLarge: { id: "neighbour_alliance", effects: [{ effect: "claim_strength", size: "large" }, { effect: "treasury", sign: 1, size: "large" }] },
    grudgeSmall: { id: "neighbour_claim", effects: [{ effect: "claim_against", sue: false }, { effect: "treasury", sign: -1, size: "small" }] },
    grudgeLarge: { id: "neighbour_suit", effects: [{ effect: "claim_against", sue: true }, { effect: "treasury", sign: -1, size: "large" }] },
  },
};
