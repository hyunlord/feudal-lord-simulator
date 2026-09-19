import type { Building, BuildingKind } from '../content/buildingConfig';
import { canPlaceBuilding } from '../world/placement';
import type { TileCoordinate } from '../world/grid';
import type { GameState } from './engine.types';
import { resolveBuildingRoute } from './routing';
import { hasAutoplayBuildingClearance } from './autoplaySetback';

/** Hauling follows roads around buildings and walls, not geometric proximity. */
export function lateFoodBuildSites(state: GameState, kind: BuildingKind): readonly TileCoordinate[] | null {
  if (state.era !== 'stone_town' || (kind !== 'mill' && kind !== 'wheat_farm')) return null;
  const granaries = state.buildings.filter(building => building.kind === 'granary');
  if (granaries.length === 0) return null;
  return state.tiles.flatMap(tile => {
    if (!hasAutoplayBuildingClearance(state, kind, tile) || !canPlaceBuilding(state, kind, tile.tx, tile.ty).ok) return [];
    const candidate: Building = { id: `autoplay-food-${tile.tx}-${tile.ty}`, kind, tx: tile.tx, ty: tile.ty,
      workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
    const paths = granaries.map(granary => resolveBuildingRoute(state, candidate, granary).path).filter(path => path !== null);
    if (paths.length === 0) return [];
    const distance = paths.reduce((sum, path) => sum + path.length, 0);
    return [{ tile, distance }];
  }).sort((a, b) => a.distance - b.distance || a.tile.ty - b.tile.ty || a.tile.tx - b.tile.tx).map(entry => entry.tile);
}
