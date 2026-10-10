/** EB-INERT prototype: explicit lord choices have bounded economic consequences. */
export const STEWARDSHIP_CONSEQUENCES = {
  charterSeasons: 4,
  charterRetrySeasons: 12,
  charterRecoveryAbove: -80,
  charterTradeLossPermille: 250,
  toleranceSeasons: 4,
  toleranceEscalationMultiplier: 2,
  toleranceLossDivisor: 16,
} as const;
