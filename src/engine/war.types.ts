/**
 * F2-A chapter 2's war (save v20, spec docs/design/chapter-two-war.md WR-*): what the War era of 1337 brought and what
 * the lord answered. The sequence's seasons derive from the messenger's; what is saved is what happened.
 */
import type { PetitionResponse } from "../content/chapterConfig";

/** WR-5: what the raid took. */
export interface RaidLosses {
  readonly burntHouses: number;
  /** Goods taken from the stores (all resources, units). */
  readonly looted: number;
  /** Pennies taken from the treasury. */
  readonly coin: number;
}

/** WR-3: the men the commission of array took, and when they come back. */
export interface Conscripts {
  readonly men: number;
  readonly returnTick: number;
  /** The households they came from (one man each, in order), and those who will not come back. */
  readonly houseIds: readonly string[];
  readonly lostHouseIds: readonly string[];
  readonly returned: boolean;
}

/** A charge paid in seasonal instalments (the wool in kind, the merchants' loan). */
export interface Instalments {
  readonly category: "wool_levy" | "war_loan";
  readonly perSeason: number;
  readonly seasonsLeft: number;
}

export interface WarState {
  /** WR-1: the messenger's season start (absolute tick); the sequence counts from here. */
  readonly messengerTick: number;
  /** The Crown's favour: lost when a royal demand is refused (no licence, no murage). */
  readonly favour: boolean;
  /** WR-2…WR-8: the answers, by petition id (an expired demand counts as `refuse`). */
  readonly answers: Readonly<Partial<Record<string, PetitionResponse | "expired">>>;
  readonly conscripts?: Conscripts;
  readonly instalments: readonly Instalments[];
  /** WR-4: the war tax's seasons left. */
  readonly taxSeasonsLeft?: number;
  /** WR-5: the raid (absent for a town off the coast, or before it). */
  readonly raid?: { readonly tick: number; readonly defencePermille: number; readonly losses: RaidLosses };
  /** WR-7: the purveyance licence's seasons left. */
  readonly licenceSeasonsLeft?: number;
  /** WR-8: the wall or the market (`murage`: the stone wall with the Crown's toll). */
  readonly wall?: "stone_wall" | "murage" | "market";
}

/** WR-1 API `warForecast`: the sequence's steps and their state. */
export type WarStepId = "messenger" | "wool_levy" | "commission" | "subsidy" | "beacon" | "raid" | "refugees" | "recovery";
export interface WarStep {
  readonly id: WarStepId;
  readonly tick: number;
  readonly state: "ahead" | "now" | "done";
}
