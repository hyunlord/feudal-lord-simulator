import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { getTile, type TileCoordinate } from '../world/grid';
import { hasBuildingWallClearance } from '../world/placement';
import type { GameState } from './engine.types';
import { constructionRoadDistance } from './autoplayRoadReach';

/** Reserve land for a future wall and its inner access before the town reaches the shore. */
export function hasAutoplayBuildingClearance(state: GameState, kind: BuildingKind, origin: TileCoordinate): boolean {
  const { width, height, requiresAdjacentTerrain } = BUILDING_CONFIG_BY_KIND[kind];
  // C5 (CL-11): a building that must stand by the water (the fulling mill, the dyehouse) keeps no setback from it.
  const byWater = requiresAdjacentTerrain === 'water';
  // DELIVERY-GAP ①a (the user's ruling 2026-10-17, both modes): a quarry may stand with water in its setback ring when
  // a side of it is land a construction road reaches — the rock by the water was a dead end (seed 26: of the six quarry
  // sites a road reached, five failed only on this ring, engine-GAP-diag2-00125eb). The map's edge, the fields and the
  // zone rules are unchanged, and every other kind keeps its setback.
  const quarryByWater = kind === 'quarry';
  let ringWater = false;
  for (let ty = origin.ty - 1; ty <= origin.ty + height; ty += 1) {
    for (let tx = origin.tx - 1; tx <= origin.tx + width; tx += 1) {
      const tile = getTile(state, { tx, ty });
      if (tile === null) return false;
      if (tile.terrain === 'water' && !byWater) {
        if (!quarryByWater) return false;
        ringWater = true;
      }
    }
  }
  if (ringWater && !Number.isFinite(constructionRoadDistance(state, kind, origin))) return false;
  const footprint = { ...origin, width, height, id: 'autoplay-candidate' };
  return hasBuildingWallClearance(state, footprint);
}
