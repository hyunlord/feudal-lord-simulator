/**
 * FIX-7 (spec docs/design/chapter-two-war.md WR-2, decisions WR5 and FX7-1): the pasture flocks' wool before C5.
 *
 * The sheep are the pasture zones' cells (`PASTURE_WOOL.sheepPerPastureCell`); a season's clip is a quarter of their
 * year's fleeces. The wool levy paid in kind takes the season's fleeces first, at `fleeceValue` each, and only what they
 * do not cover in cash. The fleeces are not stored: C5 makes the fleece a good the flocks put in the stores, and the
 * levy then takes it from there (the same split, from the stock instead of the clip).
 */
import { PASTURE_WOOL } from "../content/woolConfig";
import { zonesOf } from "../zones/zoneEdits";
import type { GameState } from "./engine.types";

/** The sheep the town's pastures carry now. */
export function pastureSheep(state: Pick<GameState, "zones">): number {
  const cells = zonesOf(state).reduce((sum, zone) => sum + (zone.kind === "pasture" ? zone.membership.length : 0), 0);
  return Math.floor(cells * PASTURE_WOOL.sheepPerPastureCell);
}

/** A season's clip: a quarter of the flocks' year of fleeces (rounded down). */
export function pastureFleecesPerSeason(state: Pick<GameState, "zones">): number {
  return Math.floor(pastureSheep(state) * PASTURE_WOOL.fleecesPerSheepYear / PASTURE_WOOL.seasonsPerClip);
}

export interface WoolInKindSplit {
  /** Fleeces handed over (never more than the season's clip, nor more than the payment needs). */
  readonly fleeces: number;
  /** Their value, pennies (the in-kind ledger line). */
  readonly inKind: number;
  /** What the fleeces leave unpaid, pennies (the cash charge; unpaid cash goes to arrears as any war charge). */
  readonly cash: number;
}

/** WR-2 in kind: a season's payment of `amount` pennies — the clip's fleeces first, the rest in cash. */
export function woolInKindSplit(state: Pick<GameState, "zones">, amount: number): WoolInKindSplit {
  if (amount <= 0) return { fleeces: 0, inKind: 0, cash: 0 };
  const fleeces = Math.min(pastureFleecesPerSeason(state), Math.ceil(amount / PASTURE_WOOL.fleeceValue));
  const inKind = Math.min(amount, fleeces * PASTURE_WOOL.fleeceValue);
  return { fleeces, inKind, cash: amount - inKind };
}
