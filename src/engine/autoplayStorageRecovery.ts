import { operationSuspended, BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { availableSpace, storageCapacityBlock } from '../economy/storage';
import { evaluateEraRequirements } from './era';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import type { GameState } from './engine.types';

/** The routine storage target is not a capacity limit. A blocked stone buffer
 * may need storage before the era goal, without waiting for unrelated spending. */
export function needsStoneStorageRecovery(state: GameState): boolean {
  if (state.era !== 'palisade'
    || !evaluateEraRequirements(state).some(requirement => requirement.key === 'stone' && !requirement.met)
    || state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === 'storehouse')
    || storageCapacityBlock(state.buildings, 'stone') === null) return false;
  const config = BUILDING_CONFIG_BY_KIND.masonry;
  return state.buildings.some(building => building.kind === 'masonry'
    && !operationSuspended(building) && building.workers >= config.workersRequired
    && buildingHasRequiredRoadAccess(state, building)
    && (building.inventory.stone ?? 0) > 0 && availableSpace(building, config) === 0);
}
