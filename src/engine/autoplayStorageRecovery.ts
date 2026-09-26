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
    || state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === 'storehouse')) return false;
  // F0-C1 (AR-9): no quarry yet and the raw-material space full (logs from a slow sawmill): the quarry has nowhere to
  // send its stone and the advisor never places it, so no stone, no church, no L4 (guardrail F0-C1 run 1, seed 5).
  if (!state.buildings.some(building => building.kind === 'quarry') && !state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === 'quarry')
    && storageCapacityBlock(state.buildings, 'stone_raw') !== null) return true;
  if (storageCapacityBlock(state.buildings, 'stone') === null) return false;
  const config = BUILDING_CONFIG_BY_KIND.masonry;
  return state.buildings.some(building => building.kind === 'masonry'
    && !operationSuspended(building) && building.workers >= config.workersRequired
    && buildingHasRequiredRoadAccess(state, building)
    && (building.inventory.stone ?? 0) > 0 && availableSpace(building, config) === 0);
}
