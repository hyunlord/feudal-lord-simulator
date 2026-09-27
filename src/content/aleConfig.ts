/**
 * C4 the ale chain (spec docs/design/ale-chain.md AL-*): barley in the fields, malt from the kiln, ale brewed in the
 * households by their women (the craft `brew_ale`), sold by the alehouses under the ale-stake. No hops (they came to
 * England's brewers in the 1400s). Values are integers (permille for fractions, pennies for money).
 */
export const ALE_BALANCE = {
  /** AL-2: a barley strip's harvest against a wheat strip's, permille (no period table: a hypothesis, decision AL1). */
  barleyYieldPermille: 1250,
  /** AL-4: a brewing household fetches its malt from a store (granary, storehouse or kiln) this close (footprint distance). */
  maltReach: 12,
  /** AL-4: the ale a slot keeps before it stops brewing. */
  slotAleCap: 8,
  /** AL-5: a house of this level whose brewing slot holds ale hangs out the ale-stake: it is an alehouse. */
  alehouseMinLevel: 2,
  /** AL-5: houses this close to an alehouse with ale drink from it (footprint distance). */
  alehouseReach: 12,
  /** AL-5: each house of level 2 or more drinks this much ale a season from its nearest alehouse. */
  alePerHouseSeason: 1,
  /** AL-6: from chapter 2 (1318; the sandbox from 1318), a house needs an alehouse in reach to rise to level 2 or more. */
  requiredFromYear: 1318,
  requiredFromLevel: 2,
  /** AL-7: ale's market price (pennies a cask), and the alehouse's dues a ledger period: this share of its sales. */
  alePrice: 3,
  alehouseDuesPermille: 200,
} as const;
