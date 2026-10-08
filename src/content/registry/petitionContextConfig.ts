/** Cumulative Engine B context rollout; unlisted premises remain unsupported. */
export const PETITION_CONTEXT_STRATEGIES: Readonly<Record<string, string>> = {
  ck_evt_041: 'home_woodland', ck_evt_048: 'home_pasture', ck_evt_056: 'home_market_road',
  ck_evt_075: 'old_possession', ck_evt_076: 'parallel_accounts', ck_evt_080: 'pending_order', ck_evt_147: 'steward_succession',
  ck_evt_061: 'small_rights', ck_evt_077: 'small_rights',
  ck_evt_083: 'market_supply', ck_evt_090: 'shop_repair', ck_evt_092: 'high_dues',
};
export function handlesPetitionContext(entryId: string): boolean {
  return Object.hasOwn(PETITION_CONTEXT_STRATEGIES, entryId);
}

export const PETITION_CONTEXT_FILTERS: Readonly<Record<string, string>> = {
  ck_evt_041: 'home_customary_forest_use', ck_evt_048: 'home_common_pasture_geometry',
  ck_evt_056: 'market_approach_route', ck_evt_147: 'NE_SR01_FN03',
};
export const PETITION_CONTEXT_KEYS: Readonly<Record<string, readonly string[]>> = {};
