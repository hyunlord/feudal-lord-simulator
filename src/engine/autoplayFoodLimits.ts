import type { BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { housingLotCount } from '../population/housing';
import type { GameState } from './engine.types';

export function foodFacilityCount(state: GameState, kind: BuildingKind): number {
  return state.buildings.filter(building => building.kind === kind).length
    + state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === kind).length;
}

export function foodFacilityWithinLimit(state: GameState, kind: BuildingKind): boolean {
  switch (kind) {
    case 'mill': return foodFacilityCount(state, 'mill') < foodFacilityCount(state, 'wheat_farm')
      && state.buildings.every(building => building.kind !== 'mill' || (building.inventory.wheat ?? 0) > 0);
    case 'granary': return foodFacilityCount(state, 'granary') < Math.ceil(housingLotCount(state) / 4) + 1;
    default: return true;
  }
}
