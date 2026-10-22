import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { getTile, type TileCoordinate } from '../world/grid';
import { hasBuildingWallClearance } from '../world/placement';
import type { GameState } from './engine.types';
import { constructionRoadDistance } from './autoplayRoadReach';
import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
import { autoplayCanPlace } from './autoplayZones';

/** The one-tile setback ring: off the map, water in it (for a kind that keeps its setback from the water), or clear. */
function setbackRing(state: GameState, kind: BuildingKind, origin: TileCoordinate): 'edge' | 'water' | 'clear' {
  const { width, height, requiresAdjacentTerrain } = BUILDING_CONFIG_BY_KIND[kind];
  // C5 (CL-11): a building that must stand by the water (the fulling mill, the dyehouse) keeps no setback from it.
  const byWater = requiresAdjacentTerrain === 'water';
  let water = false;
  for (let ty = origin.ty - 1; ty <= origin.ty + height; ty += 1) {
    for (let tx = origin.tx - 1; tx <= origin.tx + width; tx += 1) {
      const tile = getTile(state, { tx, ty });
      if (tile === null) return 'edge';
      if (tile.terrain === 'water' && !byWater) water = true;
    }
  }
  return water ? 'water' : 'clear';
}

const dryQuarryReached = new WeakMap<GameState, boolean>();

/**
 * Whether the town has a dry quarry site a construction road reaches: its ring clear, placeable once a road is there (no
 * field, no zone against it), the wall's and the services' space kept — the site the bot's "road first" step would lay
 * its road to. Cache: the state object (`WeakMap`) — every check reads that state alone.
 */
function hasDryQuarrySiteReached(state: GameState): boolean {
  const cached = dryQuarryReached.get(state);
  if (cached !== undefined) return cached;
  const { width, height } = BUILDING_CONFIG_BY_KIND.quarry;
  const found = state.tiles.some(tile => setbackRing(state, 'quarry', tile) === 'clear'
    && hasBuildingWallClearance(state, { ...tile, width, height, id: 'autoplay-candidate' })
    && autoplayCanPlace(state, 'quarry', tile.tx, tile.ty, 'later')
    && Number.isFinite(constructionRoadDistance(state, 'quarry', tile))
    && preservesAutoplayWallSpace(state, 'quarry', tile)
    && preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'quarry', tx: tile.tx, ty: tile.ty }));
  dryQuarryReached.set(state, found);
  return found;
}

/**
 * FIELD-OUT (lord mode, the user's ruling 2026-10-23): a field block whose setback ring fails only on water — the map's
 * edge and the wall's clearance still kept. The grain step takes such a block only when no block keeps the old setback
 * (`fieldBlockAction`), the quarry's ①a shape below: seed 26's town stood by its river, every block near a farmstead or a
 * road failed on the water, and its fields stopped at 141 cells while the wheat ran short (docs/verification/field-out).
 * Fields by the river are as the period had them.
 */
export function hasAutoplayFieldWaterRingClearance(state: GameState, origin: TileCoordinate): boolean {
  if (setbackRing(state, 'wheat_farm', origin) === 'edge') return false;
  const { width, height } = BUILDING_CONFIG_BY_KIND.wheat_farm;
  return hasBuildingWallClearance(state, { ...origin, width, height, id: 'autoplay-candidate' });
}

/** Reserve land for a future wall and its inner access before the town reaches the shore. */
export function hasAutoplayBuildingClearance(state: GameState, kind: BuildingKind, origin: TileCoordinate): boolean {
  const ring = setbackRing(state, kind, origin);
  if (ring === 'edge') return false;
  // DELIVERY-GAP ①a (the user's rulings 2026-10-17, both modes): a quarry may stand with water in its setback ring only
  // when the town has no dry quarry site a construction road reaches, and then only where a side of it is land that road
  // reaches — the old setback first, the new one only where it fails (as the palisade's obstacle envelope, WALLP-1).
  // Seed 26: of the six quarry sites a road reached, one lay on a field and five failed only on this ring
  // (engine-GAP-diag2-00125eb). The map's edge, the fields and the zone rules are unchanged, and every other kind keeps
  // its setback.
  if (ring === 'water' && (kind !== 'quarry' || hasDryQuarrySiteReached(state)
    || !Number.isFinite(constructionRoadDistance(state, kind, origin)))) return false;
  const { width, height } = BUILDING_CONFIG_BY_KIND[kind];
  return hasBuildingWallClearance(state, { ...origin, width, height, id: 'autoplay-candidate' });
}
