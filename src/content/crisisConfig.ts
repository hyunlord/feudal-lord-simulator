/** DEC-TRACE §6: a crisis's weak point "food under a season" (days of stored food). */
export const DAYS_PER_SEASON_FOR_CRISIS = 90;
/** An avoided dearth is put down to the stores when they held at least this many days at its arrival. */
export const CRISIS_RESERVE_DAYS = 180;

/**
 * PLAY-2 (renderer A's request): the town project the engine sees for each weak point — the agency's project key (a
 * building kind, "zone:arable"); households already short have none (no project feeds them now — relief does).
 */
export const WEAK_POINT_PROJECT: Readonly<Record<"no_granary" | "food_under_a_season" | "households_short" | "no_market", string | null>> = {
  no_granary: "granary",
  food_under_a_season: "zone:arable",
  households_short: null,
  no_market: "market",
};
