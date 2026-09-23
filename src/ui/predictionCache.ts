import { BUILDING_CONFIG } from '../content/buildingConfig';
import { RESOURCE_TYPES } from '../content/resourceConfig';
import { isWallConstructionSite } from '../domain/palisadeConstructionSchedule';
import type { GameState } from '../engine/engine.types';
import { palisadeEraLabourReservation } from '../population/eraLabour';
import { availableWorkers } from '../population/labour';
import { placementSpendableResource } from '../world/placement';
import type { Tile } from '../world/world.types';

const stateKeys = new WeakMap<GameState, string>();
const tileKeys = new WeakMap<readonly Tile[], string>();
const buildResources = RESOURCE_TYPES.filter(resource => BUILDING_CONFIG.some(definition => (definition.buildCost[resource] ?? 0) > 0));

/** Only inputs consumed by placement, staffing and service allocation belong here. */
export function predictionStateKey(state: GameState): string {
  const cached = stateKeys.get(state);
  if (cached !== undefined) return cached;
  let terrain = tileKeys.get(state.tiles);
  if (terrain === undefined) {
    terrain = JSON.stringify(state.tiles.map(tile => [tile.tx, tile.ty, tile.terrain, tile.hasRoad, tile.buildingId]));
    tileKeys.set(state.tiles, terrain);
  }
  const reservation = palisadeEraLabourReservation({ constructionSites: state.constructionSites,
    availableWorkers: availableWorkers(state.population), era: state.era, tick: state.tick, eraProclaimedTick: state.eraProclaimedTick });
  const key = JSON.stringify({
    width: state.width, height: state.height, terrain,
    wall: state.palisade === null ? null : [state.palisade.gate, state.palisade.additionalGates,
      state.palisade.segments.map(segment => [segment.edgePath, segment.completed])],
    buildings: state.buildings.map(building => [building.id, building.kind, building.tx, building.ty, building.houseLot, building.workers]),
    houses: state.houses.map(house => [house.buildingId, house.level]),
    population: state.population, ordinal: state.nextConstructionOrdinal, era: state.era,
    reservation: [reservation.reservedWorkers, reservation.activeSiteId],
    sites: state.constructionSites.map(site => [site.id, site.kind,
      isWallConstructionSite(site) ? [site.path, site.wallId, site.order] : [site.tx, site.ty],
      RESOURCE_TYPES.every(resource => (site.delivered[resource] ?? 0) >= (site.required[resource] ?? 0)),
      site.builderTicks >= site.requiredBuilderTicks]),
    materials: buildResources.map(resource => placementSpendableResource(state, resource)),
  });
  stateKeys.set(state, key);
  return key;
}
