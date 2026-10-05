import type { Walker } from '../agents/walker.types';
import type { HouseholdGroundPropEntry, WalkerCargoEntry } from './art/artContract';
import { createArtAdapters } from './art/artAdapters';
import { ART_REGISTRY } from './art/wave42Registry';
import { walkerPresentationFor } from './walkerPresentation';

export const RB_TRADE_GROUND_TARGET_COUNT = 68;
export const RB_TRADE_FIRST_BATCH_TARGET_COUNT = 72;
export const RB_TRADE_REVIEW_TARGET_COUNT = 94;
export const RB_TRADE_BREAD_IDS = ['cargo_bread_basket_NE', 'cargo_bread_basket_SE', 'cargo_bread_basket_SW', 'cargo_bread_basket_NW'] as const;
export const TRADE_WORLD_ART = createArtAdapters(ART_REGISTRY);
export const tradeWorldEntries = ART_REGISTRY.entries().filter(entry => entry.image.url.startsWith('assets/trade-world/'));
export const tradeWorldGroundEntries = tradeWorldEntries.filter((entry): entry is HouseholdGroundPropEntry => entry.kind === 'ground-prop' && entry.placement !== 'land');
export function tradeWorldCatalogSummary() {
  return { ground: tradeWorldGroundEntries.length, bread: tradeWorldEntries.filter(entry => entry.kind === 'walker-cargo').length,
    reviewPool: RB_TRADE_REVIEW_TARGET_COUNT, firstBatchTarget: RB_TRADE_FIRST_BATCH_TARGET_COUNT, activeEntries: tradeWorldEntries.length };
}
/** Current payload only; a carter's hand is occupied by its cart, never a held-goods proxy. */
export function tradeWorldHeldCargoForWalker(walker: Walker): { readonly assetId: string; readonly entry: WalkerCargoEntry } | null {
  if (walker.kind === 'carter' || walker.kind === 'builder' || walker.cargo === null || walker.cargo.amount <= 0) return null;
  const entry = ART_REGISTRY.select('walker-cargo', 'rb-trade-held-cargo', {
    role: 'cargo', cargoKind: walker.cargo.resource, facing: walkerPresentationFor(walker).direction.toLowerCase(),
  }, 0);
  return entry?.kind === 'walker-cargo' && entry.role === 'cargo' ? { assetId: entry.id, entry } : null;
}
