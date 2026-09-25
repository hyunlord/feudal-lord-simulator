/**
 * Arable fields (spec `docs/design/arable-fields.md`, AF-*). Wheat grows on the strips of arable zones and a
 * farmstead's workers plough, sow and harvest them on the calendar (4 seasons of 1,000 ticks, spring first).
 * Values are integers; permille (‰) stands for fractions so the rules stay exact.
 */
export const ARABLE_CONFIG = {
  /**
   * AF-6: wheat per cell per harvest at full growth and full fertility, away from the field edge. Chosen so the four
   * cells of one old 2×2 wheat farm, all of them headland once it is a field, still yield its year's wheat:
   * 1 wheat per 40 ticks × 4,000 ticks = 100 ≤ two 2-cell strips × ⌊2 × 0.75 × 34⌋ = 102 (34 is the smallest base that
   * reaches 100 after the per-strip rounding). Wider fields yield more per cell.
   */
  baseYieldPerCell: 34,
  /** AF-6: a headland cell (it touches the zone boundary or an uncultivated cell) yields this much. */
  headlandPermille: 750,
  /** AF-5: initial fertility. No rotation yet, so it stays here (the field is ready for C4's second crop). */
  initialFertilityPermille: 1000,
  /** AF-4: in-year ticks (tick mod ticksPerYear). Winter is `winterFrom` to the year end; growth stops there. */
  winterFrom: 3000,
  /** AF-4: ploughing and sowing run from late winter through spring into early summer (wraps the year end). */
  fieldWorkFrom: 3500,
  fieldWorkUntil: 1500,
  /** AF-4: growing ticks (winter excluded) from sowing to a ripe crop; `growingAt` of them makes it `growing`. */
  growTicks: 1500,
  growingAt: 500,
  /** AF-4: from this in-year tick every crop still in the ground is ripe with whatever it has grown. */
  forcedRipeFrom: 2500,
  /** AF-7: worker-ticks per cell for each task. A farmstead's workers give one worker-tick each per tick. */
  workPerCell: { plough: 60, sow: 30, harvest: 90 },
  /** AF-8: a farmstead tends strips of the zone it stands in or touches, or strips this close (Manhattan). */
  tendRadius: 10,
  /** AF-8 (prediction): cells one fully staffed farmstead is counted as able to work in a year. */
  predictedCellsPerFarmstead: 32,
} as const;

/** AF-12: old wheat farms converted per farmstead when a save is migrated (v9→v10). */
export const MIGRATION_FARMS_PER_FARMSTEAD = 5;
