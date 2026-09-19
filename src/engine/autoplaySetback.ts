import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { getTile, type TileCoordinate } from '../world/grid';
import { hasBuildingWallClearance } from '../world/placement';
import type { GameState } from './engine.types';

/** Reserve land for a future wall and its inner access before the town reaches the shore. */
export function hasAutoplayBuildingClearance(state: GameState, kind: BuildingKind, origin: TileCoordinate): boolean {
  const { width, height } = BUILDING_CONFIG_BY_KIND[kind];
  for (let ty = origin.ty - 1; ty <= origin.ty + height; ty += 1) {
    for (let tx = origin.tx - 1; tx <= origin.tx + width; tx += 1) {
      const tile = getTile(state, { tx, ty });
      if (tile === null || tile.terrain === 'water') return false;
    }
  }
  const footprint = { ...origin, width, height, id: 'autoplay-candidate' };
  return hasBuildingWallClearance(state, footprint);
}
