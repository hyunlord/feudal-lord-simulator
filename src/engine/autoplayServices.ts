import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import { allocateHouseServices } from '../population/serviceAllocation';
import { canPlaceBuilding, isBuildingUnlocked } from '../world/placement';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { householdServices } from './householdServices';
import { marketRoadService } from './marketService';
import { hasConnectedConstructionRoute } from './autoplayConstructionRoute';
import { plannedBuildingRoadAction, roadActionToTargets } from './autoplayConstructionRoads';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { buildingRoadAccessTiles } from './routing';

type UrbanService = 'market' | 'church';
const NONE = { kind: 'none' } as const satisfies AutoplayAction;

function candidateBuilding(kind: UrbanService, tx: number, ty: number): Building {
  return { id: 'autoplay-service-candidate', kind, tx, ty,
    workers: BUILDING_CONFIG_BY_KIND[kind].workersRequired,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

export function urbanServiceAction(state: GameState): AutoplayAction {
  if (!isBuildingUnlocked('market', state.era)) return NONE;
  const current = householdServices(state);
  const roadService = marketRoadService(state);
  for (const kind of ['market', 'church'] as const) {
    if (!isBuildingUnlocked(kind, state.era)) continue;
    if (state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === kind)) continue;
    const underserved = state.buildings.filter(home => home.kind === 'house' && current.houses.has(home.id)
      && current.houses.get(home.id)?.[kind].kind !== 'served');
    if (underserved.length === 0) continue;
    const definition = BUILDING_CONFIG_BY_KIND[kind];
    const providers = state.buildings.filter(building => building.kind === kind);
    // Reuse an existing in-range facility, even if it needs staff, rather than
    // buying another building to disguise a workforce or disconnected-road problem.
    for (const home of underserved) {
      for (const provider of providers.filter(provider => buildingFootprintDistance(home, provider) <= definition.serviceRadius)) {
        if (roadService(home, provider)) continue;
        const allRoads = { ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: true })) };
        const source = buildingRoadAccessTiles(state, home);
        const repair = roadActionToTargets(state, buildingRoadAccessTiles(allRoads, provider), source);
        if (repair.kind !== 'none') return repair;
      }
    }
    const needsBuilding = underserved.filter(home => {
      const cause = current.houses.get(home.id)?.[kind].kind;
      return cause === 'missing' || cause === 'outside' || cause === 'capacity';
    });
    if (needsBuilding.length === 0 || state.idleWorkers < definition.workersRequired) continue;
    const candidates = state.tiles.flatMap(tile => {
      const candidate = candidateBuilding(kind, tile.tx, tile.ty);
      const covered = needsBuilding.filter(home => buildingFootprintDistance(home, candidate) <= definition.serviceRadius);
      if (covered.length === 0 || !hasAutoplayBuildingClearance(state, kind, tile)
        || !canPlaceBuilding(state, kind, tile.tx, tile.ty).ok) return [];
      return [{ candidate, count: covered.length,
        distance: covered.reduce((sum, home) => sum + buildingFootprintDistance(home, candidate), 0) }];
    }).sort((a, b) => b.count - a.count || a.distance - b.distance || a.candidate.ty - b.candidate.ty || a.candidate.tx - b.candidate.tx);
    const servedBefore = [...current.houses.values()].filter(services => services[kind].kind === 'served').length;
    for (const { candidate } of candidates) {
      if (!hasConnectedConstructionRoute(state, candidate)) continue;
      const projected = allocateHouseServices({ houses: state.houses, buildings: [...state.buildings, candidate], roadService });
      if ([...projected.houses.values()].filter(services => services[kind].kind === 'served').length <= servedBefore) continue;
      if (!preservesAutoplayWallSpace(state, kind, candidate) || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: kind, tx: candidate.tx, ty: candidate.ty })) continue;
      return { kind: 'place_building', building: kind, tx: candidate.tx, ty: candidate.ty };
    }
    for (const { candidate } of candidates.slice(0, 24)) {
      if (!preservesAutoplayWallSpace(state, kind, candidate) || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: kind, tx: candidate.tx, ty: candidate.ty })) continue;
      const road = plannedBuildingRoadAction(state, candidate);
      if (road.kind !== 'none') return road;
    }
  }
  return NONE;
}
