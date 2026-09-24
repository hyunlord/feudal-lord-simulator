import { constructionDeliveryNeed, isBuildingConstructionSite } from '../economy/construction';
import { civicConstructionReserve } from './autoplayCivicReserve';
import type { GameState } from './engine.types';

export function constructionExportReserve(state: GameState): Readonly<{ timber: number; stone: number }> {
  const pending = state.constructionSites.reduce((total, site) => {
    const need = constructionDeliveryNeed(site);
    return { timber: total.timber + (need.timber ?? 0), stone: total.stone + (need.stone ?? 0) };
  }, { timber: 0, stone: 0 });
  // A church site is already included above; only its pre-placement budget is additional.
  if (state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === 'church')) return pending;
  const futureChurch = civicConstructionReserve(state);
  return { timber: pending.timber + futureChurch.timber, stone: pending.stone + futureChurch.stone };
}
