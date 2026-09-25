import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { annualWheatNeed } from './autoplayArable';
import { expectedAnnualWheat } from '../zones/arableOutlook';
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
    // AF-13: mills up to what the larger of a year's need and the expected harvest can keep busy, plus one; never
    // while one stands empty.
    case 'mill': return foodFacilityCount(state, 'mill') < Math.ceil(Math.max(annualWheatNeed(state), expectedAnnualWheat(state)) / MILL_YEAR_WHEAT) + 1
      && state.buildings.every(building => building.kind !== 'mill' || (building.inventory.wheat ?? 0) > 0);
    case 'granary': return foodFacilityCount(state, 'granary') < Math.ceil(housingLotCount(state) / 4) + 1;
    default: return true;
  }
}
