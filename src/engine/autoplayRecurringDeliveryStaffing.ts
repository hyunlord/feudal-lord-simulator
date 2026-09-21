import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { createConstructionSite, isBuildingConstructionSite } from '../economy/construction';
import { allocateBuildingAndConstructionLabour } from '../population/labour';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import type { GameState } from './engine.types';

const isFood = (building: { readonly kind: string }): boolean => ['wheat_farm', 'mill', 'granary'].includes(building.kind);

/** Diagnostic projections use the unchanged allocator, including its builder reservation. */
export function canStaffRecurringGranary(state: GameState, candidate: Building): boolean {
  const plannedFood = state.constructionSites.filter(isBuildingConstructionSite).filter(isFood).map(site => ({
    id: site.id, kind: site.kind, tx: site.tx, ty: site.ty, workers: 0,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0,
  }));
  const buildings = [...state.buildings, ...plannedFood];
  const options = { era: state.era, tick: state.tick, eraProclaimedTick: state.eraProclaimedTick };
  const eligible = (building: Building): boolean => buildingHasRequiredRoadAccess(state, building);
  const site = createConstructionSite({ ordinal: state.nextConstructionOrdinal, kind: 'granary',
    tx: candidate.tx, ty: candidate.ty, startedTick: state.tick });
  const sites = state.constructionSites.filter(s => !plannedFood.some(b => b.id === s.id));
  const construction = allocateBuildingAndConstructionLabour(buildings,
    [...sites, { ...site, delivered: site.required }], state.population, options, eligible);
  const completion = allocateBuildingAndConstructionLabour([...buildings, candidate], sites, state.population, options, eligible);
  const staffedFood = (result: typeof completion): boolean => result.buildings.filter(isFood).every(b =>
    b.workers >= BUILDING_CONFIG_BY_KIND[b.kind].workersRequired);
  return (construction.constructionSites.find(s => s.id === site.id)?.assignedBuilders ?? 0) > 0
    && staffedFood(construction) && staffedFood(completion);
}
