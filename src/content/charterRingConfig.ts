import type { EraRequirementKey } from "./eraConfig";

/**
 * GROW-BLOCK (GB-1·GB-2, the user's ruling 2026-10-09): the charter wall's wider search and the town's retry. In lord
 * mode a town whose search found no wall searches again each season (not only when its layout changes), its first ring
 * round every building at one of these margins (tiles), rotated by the attempt; at most `wideInspections` walls checked a
 * search. Game estimates; seed 1 (engine-GROW-stall-1ecc0e2) found its wall at margin 3 on the first check.
 */
export const CHARTER_RING = {
  wideMargins: [3, 4, 5, 6] as readonly number[],
  wideInspections: 4,
  /**
   * A failed search is tried again after this many ticks (a season), doubled at each failure in a row up to
   * `retryMaxFactor` (the user's ruling: the retries must not show in the season's time on the perf trend).
   */
  retryTicks: 1_000,
  retryMaxFactor: 8,
} as const;

/**
 * GB-3 (renderer A's engine-play2-reads.md §4): the town project that meets each market-charter condition — the agency's
 * project key (a building kind; "house" the town's houses). The coin has none (the treasury fills it); the timber the
 * town's camps and sawmill (or the traders' standing order, the town's own).
 */
export const ERA_REQUIREMENT_PROJECT: Readonly<Record<EraRequirementKey, string | null>> = {
  population: "house", granary: "granary", chapel: "chapel", timber: "logging_camp", market: "market", masonry: "masonry", stone: "quarry", coin: null,
};
