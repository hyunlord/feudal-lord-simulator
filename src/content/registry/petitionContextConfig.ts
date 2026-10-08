/** First Engine B rollout: only these five authored premises are installed. */
export const PETITION_CONTEXT_STRATEGIES: Readonly<Record<string, string>> = {
  ck_evt_061: 'small_rights', ck_evt_077: 'small_rights',
  ck_evt_083: 'market_supply', ck_evt_090: 'shop_repair', ck_evt_092: 'high_dues',
};
export function handlesPetitionContext(entryId: string): boolean {
  return Object.hasOwn(PETITION_CONTEXT_STRATEGIES, entryId);
}
