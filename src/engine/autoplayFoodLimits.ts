import { BALANCE, LABOUR_BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { annualWheatNeed } from './autoplayArable';
import { isBuildingConstructionSite } from '../economy/construction';
import { housingLotCount } from '../population/housing';
import type { GameState } from './engine.types';

export function foodFacilityCount(state: GameState, kind: BuildingKind): number {
  return state.buildings.filter(building => building.kind === kind).length
    + state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === kind).length;
}

/** A mill grinds `inputPerOutput` wheat per `ticksPerOutput` ticks: its year of wheat. */
const MILL_YEAR_WHEAT = Math.floor(BALANCE.TICKS_PER_YEAR * (BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 2)
  / (BUILDING_CONFIG_BY_KIND.mill.production?.ticksPerOutput ?? 30));

export function foodFacilityWithinLimit(state: GameState, kind: BuildingKind): boolean {
  switch (kind) {
    // LB-7 (was AF-13's ×2 for a mill's one carter hauling wheat in and bread out): with an intake cart and granary
    // pushes, mills up to `millHaulingFactorPermille` of what a year's need could keep busy, plus one; never while one
    // stands empty. The expected harvest no longer raises the cap: mills sized to the harvest surplus stand idle.
    case 'mill': return foodFacilityCount(state, 'mill') < Math.ceil(annualWheatNeed(state) * LABOUR_BALANCE.millHaulingFactorPermille / 1000 / MILL_YEAR_WHEAT) + 1
      && state.buildings.every(building => building.kind !== 'mill' || (building.inventory.wheat ?? 0) > 0);
    case 'granary': return foodFacilityCount(state, 'granary') < Math.ceil(housingLotCount(state) / 4) + 1;
    default: return true;
  }
}
