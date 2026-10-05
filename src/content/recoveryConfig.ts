import { PRESSURE_BALANCE } from "./balanceConfig";

/**
 * RECOVER-1 (spec docs/design/recovery.md RC-2..RC-4): lord mode's recovery — vacant houses and the labour shortage
 * pull households in from the countryside; food decides whether they stay. Game estimates, tuned by the 125-year runs.
 */
export const RECOVERY_BALANCE = {
  /** RC-4: the share of the vacant houses a season's migrants take, permille, before the labour shortage. */
  pullBasePermille: 150,
  /** RC-4: the labour shortage adds this much at a shortage of every job slot (scaled by the shortage's share). */
  pullLabourPermille: 350,
  /** RC-3: a newcomer household does not starve this long after it moves in (one season). */
  newcomerGraceTicks: PRESSURE_BALANCE.seasonTicks,
  /** RC-2: an abandoned house stands empty at least this long before newcomers take it (the family just left). */
  abandonedWaitTicks: PRESSURE_BALANCE.resettleAfterTicks,
} as const;

/**
 * RECOVER-1 (RC-5, B2): in lord mode the short side pulls. A mill reorders wheat at what it grinds during a round trip
 * to its nearest wheat (× the margin), never below the old fixed target; a round trip longer than one cart's load
 * lasts sends more intake carts at once, up to the cap. Game estimates.
 */
export const MILL_PULL = {
  /** Reorder point = round-trip ticks × wheat per tick × this, permille. */
  marginPermille: 1500,
  /** Intake carts one mill may have out at once. */
  maxIntakeCarts: 3,
} as const;
