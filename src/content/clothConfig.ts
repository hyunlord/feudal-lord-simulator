/**
 * C5 the cloth chain (spec docs/design/cloth-chain.md CL-1…CL-10, K2's seven goods): pasture flocks → fleece (the
 * pastoral farm shears them in early summer) → yarn (spun at home by the women, the household's second slot) → raw
 * cloth (the weaver's loom) → fulled cloth (the fulling mill's water hammers) → dyed cloth (the dyehouse, woad, madder
 * and weld the long-distance merchants bring) → finished cloth (stretched on the tenters) → sold at the market to the
 * long-distance merchants, the lord taking the aulnager's seal and the fulling mill's toll.
 *
 * Values are a hypothesis (decision CL1), to be tuned after play: a unit is a fleece (about a pound and a half of
 * wool), a skein spun from it, and a cloth (a short cloth) woven from four skeins.
 */
export const CLOTH_BALANCE = {
  /** CL-1: sheep a pasture cell carries (medieval stocking, one to two sheep an acre of good grass). */
  sheepPerPastureCell: 2,
  /** CL-1: fleeces a sheep gives a year, shorn once. */
  fleecesPerSheepYear: 1,
  /** CL-2: the shearing — early summer (in-year tick; the calendar's summer runs 1,000–1,999). */
  shearingInYearTick: 1_100,
  /** CL-2: a pastoral farm tends the pasture cells within this footprint distance (the nearest farm has a cell). */
  pastoralReach: 12,
  /**
   * CL-3 (decision CL3): the hands a pastoral farm's cells ask for, permille a cell (the season's factor on top, as for
   * the fields): a shepherd to twenty cells, where a field asks a hand a cell (`fieldHandsPerCellPermille` 1,000).
   */
  pastureHandsPerCellPermille: 50,

  /** CL-4: spinning — the house level from which the second slot spins (L3, L4 have two slots), batch ticks. */
  spinFromLevel: 3,
  spinTicksPerBatch: 400,

  /** CL-6: the merchants bring each working dyehouse dyes each season, up to `dyesHeld` in its stock (a market needed). */
  dyesPerSeason: 10,
  dyesHeld: 20,

  /** CL-8: a finished cloth's market price (pennies, the owners'), the aulnager's seal (the treasury's, a cloth sold). */
  clothPrice: 30,
  ulnagePerCloth: 4,
  /** CL-5: the lord's fulling mill takes this toll a cloth fulled (the treasury). */
  fullingTollPerCloth: 3,

  /**
   * CL-9 the wool levy in kind (FX7-1 → C5): a fleece's value, pennies (1337, the Crown's price about £5–6 a sack of
   * some 240 fleeces).
   */
  fleeceValue: 5,
} as const;

/** CL-9: the in-kind ledger line's resource — the good `fleece`. */
export const FLEECE_RESOURCE = "fleece";
