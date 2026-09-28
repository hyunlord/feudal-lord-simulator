/**
 * C4 the ale chain (spec docs/design/ale-chain.md AL-*): barley in the fields, malt from the kiln, ale brewed in the
 * households by their women (the craft `brew_ale`), sold by the alehouses under the ale-stake. No hops (they came to
 * England's brewers in the 1400s). Values are integers (permille for fractions, pennies for money).
 */
export const ALE_BALANCE = {
  /** AL-2: a barley strip's harvest against a wheat strip's, permille (no period table: a hypothesis, decision AL1). */
  barleyYieldPermille: 1250,
  /** AL-4: the ale a slot keeps before it stops brewing. */
  slotAleCap: 8,
  /** AL-5: a house of this level whose brewing slot holds ale hangs out the ale-stake: it is an alehouse. */
  alehouseMinLevel: 2,
  /** AL-5: houses this close to an alehouse drink from it (footprint distance). */
  alehouseReach: 16,
  /** AL-5: each house of level 1 or more drinks this much ale a season, its own brew first, else from its nearest alehouse… */
  alePerHouseSeason: 1,
  /** …and counts as served by ale this long after (two seasons: a season the alehouse ran dry does not undo it). */
  aleServedTicks: 2_000,
  /** AL-6: from chapter 2 (1318; the sandbox from 1318), a house rising to level 2 or more wants ale (its own brew or an alehouse in reach). */
  requiredFromYear: 1318,
  requiredFromLevel: 2,
  /**
   * AL-6 how the requirement bites (decision AL11: `delay`, chosen by the user over `require` after the probe):
   * - `require`: a house rises to `requiredFromLevel` or more only when served by ale;
   * - `delay`: it rises without ale, but waits `unservedHoldPermille` of the level's hold (from `requiredFromLevel`).
   * A served house rising to a level in [`servedBonusFromLevel`, `requiredFromLevel`) waits `servedHoldPermille`.
   */
  rule: "delay" as "require" | "delay",
  /** Decision AL11: ale does not stop a house rising, it slows it — half as long again (the chapter's first need never deadlocks). */
  unservedHoldPermille: 1_500,
  servedBonusFromLevel: 2,
  servedHoldPermille: 1_000,
  /** AL-7: ale's market price (pennies a cask), and the alehouse's dues a ledger period: this share of its sales. */
  alePrice: 3,
  alehouseDuesPermille: 200,
} as const;
