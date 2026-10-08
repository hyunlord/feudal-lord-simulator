/**
 * SUIT-THREAD balance (decision DTR-21; the user's judgement 2026-10-08, A6): going to law is worth doing, not always a
 * gain. The rent of a possession the lord holds without its title is cut while its title holder disputes it, and a
 * keeper takes a share; the title holder claims it back (`neighbourRulesConfig.ts`). Game estimates.
 */
export const POSSESSION_RENT = {
  /** While a claim or suit of another's on it stands open, the tenants hold back this share (the lord's right in doubt). */
  contestedWithheldPermille: 500,
  /**
   * The keeper's share of a possession's rent: a bailiff at a distance, his fee, the repairs and the allowances the
   * valors deduct between a manor's gross and its clear value (DTR-22, S2: a quarter)…
   */
  keeperPermille: 250,
  /** …halved while the lord oversees an estate of his directly (his own receiver gathers it). */
  keeperDirectPermille: 125,
} as const;
