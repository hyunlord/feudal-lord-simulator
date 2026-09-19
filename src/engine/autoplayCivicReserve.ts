import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { constructionDeliveryNeed, isBuildingConstructionSite } from '../economy/construction';
import type { GameState } from './engine.types';
import { householdServices } from './householdServices';

/** Protect unclaimed church deliveries, or one needed church before placement. */
export function civicConstructionReserve(state: GameState): Readonly<{ timber: number; stone: number }> {
  const none = { timber: 0, stone: 0 };
  if (state.era !== 'stone_town') return none;
  const planned = state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === 'church');
  if (planned.length > 0) return planned.reduce((total, site) => {
    const need = constructionDeliveryNeed(site);
    return { timber: total.timber + (need.timber ?? 0), stone: total.stone + (need.stone ?? 0) };
  }, none);
  const services = householdServices(state);
  const needsChurch = state.buildings.some(building => {
    if (building.kind !== 'house') return false;
    const cause = services.houses.get(building.id)?.church.kind;
    return cause === 'missing' || cause === 'outside' || cause === 'capacity';
  });
  if (!needsChurch) return none;
  const cost = BUILDING_CONFIG_BY_KIND.church.buildCost;
  return { timber: cost.timber ?? 0, stone: cost.stone ?? 0 };
}
