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
