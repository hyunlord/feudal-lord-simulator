/**
 * F0-A season ledger and pressure state (save v12, spec docs/design/flow-pressure.md FP-1…FP-5). F0-B (save v13) adds
 * the events' forecast, arrival and recovery to the ledger (spec docs/design/flow-events.md EV-9).
 */
import type { EventSeasonEvent } from "./events.types";

export const SEASON_STOCK_KEYS = ["bread", "wheat", "timber", "stone"] as const;
export type SeasonStockKey = (typeof SEASON_STOCK_KEYS)[number];
export type SeasonStock = Readonly<Record<SeasonStockKey, number>>;

/** What happened in a season, for the settlement card (FP-1). Counts are households. */
export type SeasonEvent =
  | { readonly kind: "households_leaving"; readonly count: number }
  | { readonly kind: "households_abandoned"; readonly count: number }
  | { readonly kind: "households_resettled"; readonly count: number }
  | { readonly kind: "era_entered"; readonly eraId: string; readonly forced: boolean }
  | { readonly kind: "first_winter_warning" }
  | EventSeasonEvent;

/**
 * The next objective the card suggests (FP-1): `food_reserve` = households are leaving or the stored food will not
 * last a season; `harvest_reserve` = the food in store and in the fields will not last to the next harvest (the lean
 * late spring, FP9); `resettle` = abandoned houses wait for a season of food. F0-B (EV-2, EV-9): `dearth_reserve` = a
 * dearth is rumoured (stock up before the bad harvest); `fire_break` = a dry summer is rumoured (wells, gaps between
 * thatch); `rebuild` = burnt houses wait for rebuilding. Null = nothing pressing.
 */
export type NextObjectiveHint = "food_reserve" | "harvest_reserve" | "resettle" | "dearth_reserve" | "fire_break" | "rebuild" | null;

/** FP-1: one closed season. Income and expense are the cash ledger's entries in (startTick, endTick]. */
export interface SeasonLedger {
  readonly season: 0 | 1 | 2 | 3;
  readonly year: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly income: number;
  readonly expense: number;
  readonly stockDelta: SeasonStock;
  readonly popDelta: number;
  readonly notableEvents: readonly SeasonEvent[];
  readonly nextObjectiveHint: NextObjectiveHint;
}

/** The season being counted: its start snapshot and the events so far. */
export interface SeasonTally {
  readonly startTick: number;
  readonly population: number;
  readonly stock: SeasonStock;
  readonly leaving: number;
  readonly abandoned: number;
  /** Households that left a house they still lived in (the per-season cap counts these). */
  readonly departures: number;
  readonly resettled: number;
  readonly eras: readonly { readonly eraId: string; readonly forced: boolean }[];
  readonly firstWinterWarning: boolean;
  /** F0-B (EV-9): event forecast, arrival and recovery lines raised this season. Absent = none (v12 tallies). */
  readonly events?: readonly EventSeasonEvent[];
}

/**
 * FP-4 (FP9): raised once, at the start of the first autumn whose food (in store and still in the fields) will not last
 * through the winter and the lean spring to the next harvest.
 */
export interface FirstWinterWarning {
  readonly tick: number;
  /** Food in store and in the fields, in ticks at the normal ration. */
  readonly reserveTicks: number;
  /** Ticks to the next harvest in the same units (winter ticks × 1.2): 3,700 from the start of autumn. */
  readonly untilHarvestTicks: number;
}

export interface SeasonState {
  readonly current: SeasonTally;
  /** Closed seasons, oldest first, at most `PRESSURE_BALANCE.seasonLedgerHistory`. */
  readonly history: readonly SeasonLedger[];
  readonly firstWinterWarning?: FirstWinterWarning;
}

/** FP-5: a historical era the town has entered; `forced` = its readiness was unmet when the grace ran out. */
export interface HistoricalEraEntry {
  readonly id: string;
  readonly enteredTick: number;
  readonly forced: boolean;
}
