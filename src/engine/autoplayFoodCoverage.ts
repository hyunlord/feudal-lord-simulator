import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { availableStock } from '../economy/storage';
import { isBuildingConstructionSite } from '../economy/construction';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { canPlaceBuilding, placementSpendableResource } from '../world/placement';
import type { RoamingHouse } from '../agents/roamingTypes';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { civicConstructionReserve } from './autoplayCivicReserve';
import { hasConnectedConstructionRoute } from './autoplayConstructionRoute';
import { plannedBuildingRoadAction } from './autoplayConstructionRoads';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { placeRoadLine } from './gameActions';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import { createSimulationRoutePorts } from './simulationPorts';

const NONE = { kind: 'none' } as const;

function outsideHomes(state: GameState): readonly RoamingHouse[] {
  const routes = createSimulationRoutePorts(state).roaming;
  const starts = state.buildings.filter(b => b.kind === 'granary')
    .flatMap(b => (routes.homePath(b.id)?.slice(0, 1) ?? []).map(tile => ({ tile, stocked: availableStock(b, 'bread') > 0 })));
  return state.houses.flatMap(house => {
    const building = state.buildings.find(b => b.id === house.buildingId);
    if (building === undefined) return [];
    const home = { ...house, tx: building.tx, ty: building.ty, ...buildingFootprint(building) };
    const paths = starts.flatMap(start => {
      const path = routes.servicePath?.(start.tile, home);
      return path == null ? [] : [{ edges: path.length - 1, stocked: start.stocked }];
    });
    // Disconnection and empty stores require their own repairs, not new storage.
    return paths.some(path => path.stocked) && Math.min(...paths.map(path => path.edges)) > BALANCE.DISTRIBUTOR_RANGE ? [home] : [];
  });
}

function affordable(state: GameState): boolean {
  const reserve = civicConstructionReserve(state);
  const cost = BUILDING_CONFIG_BY_KIND.granary.buildCost;
  return (['timber', 'stone'] as const).every(resource =>
    placementSpendableResource(state, resource) >= (cost[resource] ?? 0) + reserve[resource]);
}

function projectAccess(state: GameState, candidate: Building): { state: GameState; first: AutoplayAction; added: number } | null {
  let projected = state;
  let first: AutoplayAction = NONE;
  const before = state.tiles.filter(tile => tile.hasRoad).length;
  // Each successful step adds at least one road tile; map area is the finite bound.
  for (let step = 0; step < state.tiles.length; step += 1) {
    if (buildingHasRequiredRoadAccess(projected, candidate)) {
      return { state: projected, first, added: projected.tiles.filter(tile => tile.hasRoad).length - before };
    }
    const action = plannedBuildingRoadAction(projected, candidate);
    if (action.kind !== 'place_road') return null;
    const next = placeRoadLine(projected, action.from, action.to);
    if (next === projected || next.tiles.every((tile, index) => tile.hasRoad === projected.tiles[index]?.hasRoad)) return null;
    if (first.kind === 'none') first = action;
    projected = next;
  }
  return null;
}

/** Add storage only for a proven gap in the distributor's actual roaming range. */
export function foodCoverageAction(state: GameState): AutoplayAction {
  if (state.constructionSites.some(site => isBuildingConstructionSite(site)
    && ['granary', 'mill', 'wheat_farm'].includes(site.kind))) return NONE;
  if (state.idleWorkers < BUILDING_CONFIG_BY_KIND.granary.workersRequired || !affordable(state)) return NONE;
  const granaries = state.buildings.filter(building => building.kind === 'granary');
  if (granaries.some(building => building.workers < BUILDING_CONFIG_BY_KIND.granary.workersRequired)
    || !granaries.some(building => availableStock(building, 'bread') > 0)) return NONE;
  const outside = outsideHomes(state);
  if (outside.length === 0) return NONE;
  const candidates = state.tiles.filter(tile => hasAutoplayBuildingClearance(state, 'granary', tile)
    && canPlaceBuilding(state, 'granary', tile.tx, tile.ty).ok)
    .map(tile => ({ tile, distance: Math.min(...outside.map(home => Math.abs(home.tx - tile.tx) + Math.abs(home.ty - tile.ty))) }))
    .sort((a, b) => a.distance - b.distance || a.tile.ty - b.tile.ty || a.tile.tx - b.tile.tx);
  let best: { action: AutoplayAction; covered: number; roads: number } | null = null;
  // Match the existing civic advisor's bounded search rather than scanning road plans for the whole map.
  for (const { tile } of candidates.slice(0, 24)) {
    const candidate: Building = { id: 'autoplay-food-coverage', kind: 'granary', tx: tile.tx, ty: tile.ty,
      workers: BUILDING_CONFIG_BY_KIND.granary.workersRequired, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
    const access = projectAccess(state, candidate);
    if (access === null || !affordable(access.state) || !hasConnectedConstructionRoute(access.state, candidate)) continue;
    const projected = { ...access.state, buildings: [...access.state.buildings, candidate], pathCache: {},
      tiles: access.state.tiles.map(tile => tile.tx >= candidate.tx && tile.tx < candidate.tx + BUILDING_CONFIG_BY_KIND.granary.width && tile.ty >= candidate.ty && tile.ty < candidate.ty + BUILDING_CONFIG_BY_KIND.granary.height
        ? { ...tile, buildingId: candidate.id } : tile) };
    const covered = outside.length - outsideHomes(projected).length;
    if (covered <= 0 || (best !== null && (covered < best.covered || (covered === best.covered && access.added >= best.roads)))) continue;
    best = { covered, roads: access.added, action: access.first.kind === 'none'
      ? { kind: 'place_building', building: 'granary', tx: candidate.tx, ty: candidate.ty } : access.first };
  }
  return best?.action ?? NONE;
}
