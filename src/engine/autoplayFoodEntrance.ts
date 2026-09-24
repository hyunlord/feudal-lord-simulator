import { autoplayCanPlace } from './autoplayZones';
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from '../content/buildingConfig';
import { availableStock } from '../economy/storage';
import { placementSpendableResource } from '../world/placement';
import { canPlaceRoad } from '../world/roadGraph';
import { getTile } from '../world/grid';
import { buildingRoadAccessTiles, resolveBuildingRoute } from './routing';
import { lateFoodBuildSites } from './autoplayFoodPlacement';
import { roadActionToTargets } from './autoplayConstructionRoads';
import { hasConnectedConstructionRoute } from './autoplayConstructionRoute';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { preserveRoadExpansion } from './autoplayExpansion';
import { placeRoadLine } from './gameActions';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

function bestSite(state: GameState, kind: 'mill' | 'wheat_farm', stores: readonly Building[]) {
  const candidates = (lateFoodBuildSites(state, kind) ?? []).map(tile => {
    const candidate: Building = { id: `food-entrance-${tile.tx}-${tile.ty}`, kind, tx: tile.tx, ty: tile.ty,
      workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
    const distance = Math.min(...stores.map(store => (resolveBuildingRoute(state, candidate, store).path?.length ?? Infinity) - 1));
    return { candidate, distance };
  }).filter(site => Number.isFinite(site.distance)).sort((a, b) => a.distance - b.distance || a.candidate.ty - b.candidate.ty || a.candidate.tx - b.candidate.tx);
  for (const site of candidates) {
    const {candidate} = site;
    if (!hasConnectedConstructionRoute(state, candidate) || !preservesAutoplayWallSpace(state, kind, candidate)
      || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: kind, tx: candidate.tx, ty: candidate.ty })
      || preserveRoadExpansion(state, candidate) !== null) continue;
    return site;
  }
  return null;
}

/** Compare ordinary paid granary entrances before committing production to a long existing detour. */
export function foodEntranceBuildAction(state: GameState, kind: BuildingKind): AutoplayAction | null {
  if (kind !== 'mill' && kind !== 'wheat_farm') return null;
  const buildCost = BUILDING_CONFIG_BY_KIND[kind].buildCost;
  if ((['timber', 'stone'] as const).some(resource => placementSpendableResource(state, resource) < (buildCost[resource] ?? 0))) return null;
  const stores = state.buildings.filter(b => b.kind === 'granary' && (kind !== 'mill' || availableStock(b, 'wheat') > 0));
  if (stores.length === 0) return null;
  const baseline = bestSite(state, kind, stores);
  const baselineAction: AutoplayAction | null = baseline === null ? null : {kind: 'place_building', building: kind, tx: baseline.candidate.tx, ty: baseline.candidate.ty};
  if (baseline?.distance === 0) return baselineAction;
  let best: { action: AutoplayAction; distance: number; roads: number } | null = null;
  const potential = { ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: true })) };
  const entrances = stores.flatMap(store => buildingRoadAccessTiles(potential, store)).filter(tile => canPlaceRoad(state, tile));
  for (const entrance of entrances) {
    let projected = state;
    let first: AutoplayAction | null = null;
    for (let step = 0; step < state.tiles.length && !getTile(projected, entrance)?.hasRoad; step += 1) {
      const action = roadActionToTargets(projected, [entrance]);
      if (action.kind !== 'place_road') break;
      const next = placeRoadLine(projected, action.from, action.to);
      if (next === projected) break;
      first ??= action;
      projected = next;
    }
    if (first === null || !getTile(projected, entrance)?.hasRoad) continue;
    const cost = BUILDING_CONFIG_BY_KIND[kind].buildCost;
    if ((['timber', 'stone'] as const).some(resource => placementSpendableResource(projected, resource) < (cost[resource] ?? 0))) continue;
    const site = bestSite(projected, kind, stores);
    if (site === null || !autoplayCanPlace(projected, kind, site.candidate.tx, site.candidate.ty)
      || site.distance >= (baseline?.distance ?? Infinity)) continue;
    const roads = projected.tiles.filter(tile => tile.hasRoad).length - state.tiles.filter(tile => tile.hasRoad).length;
    if (best === null || site.distance < best.distance || site.distance === best.distance && roads < best.roads) {
      best = { action: first, distance: site.distance, roads };
    }
  }
  return best?.action ?? baselineAction;
}
