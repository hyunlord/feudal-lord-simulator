import { WALL_CARRY_COST_FACTOR } from '../content/wallConstructionConfig';
import type { Building } from '../content/buildingConfig';
import { acceptsResource } from '../economy/storage';
import { returnPath, replaceBuilding } from './deliveryCommon';
import type { DeliveryInventoryPort, DeliveryRoutePort } from './deliveryTypes';
import type { CarterWalker } from './walker.types';

/** S6-F5: a cancelled construction shipment chooses the nearest reachable
 * compatible warehouse, irrespective of its capacity. Existing route validation
 * and wall-carry return paths remain authoritative. No storage policy is saved. */
export function constructionReturnDestination(
  buildings: readonly Building[],
  carter: CarterWalker,
  ports: Readonly<{ inventory: DeliveryInventoryPort; routes: DeliveryRoutePort }>,
): Readonly<{ buildings: readonly Building[]; carter: CarterWalker }> {
  if (carter.destination.kind !== 'construction_site' || carter.cargo === null
    || carter.reservation.sourceStockClaim?.kind === 'treasury') return { buildings, carter };
  const cargo = carter.cargo;
  const choices = buildings.filter(building => acceptsResource(building.kind, cargo.resource))
    .flatMap(building => {
      const path = returnPath(buildings, { ...carter, homeBuildingId: building.id }, ports.routes);
      return path === null ? [] : [{ building, cost: path.slice(1).reduce((sum, tile, index) => {
        const previous = path[index];
        if (previous === undefined) return sum;
        const steps = Math.abs(tile.tx - previous.tx) + Math.abs(tile.ty - previous.ty);
        const factor = ports.routes.isRoad(previous) && ports.routes.isRoad(tile) ? 1 : WALL_CARRY_COST_FACTOR;
        return sum + steps * factor;
      }, 0) }];
    }).sort((a, b) => a.cost - b.cost || a.building.id.localeCompare(b.building.id));
  const target = choices[0]?.building;
  if (target === undefined || target.id === carter.homeBuildingId) return { buildings, carter };
  const claim = carter.reservation.homeCapacityClaim;
  const previous = claim === null ? undefined : buildings.find(building => building.id === claim.buildingId);
  const released = previous === undefined || claim === null ? buildings
    : replaceBuilding(buildings, ports.inventory.releaseSpace(previous, claim.resource, claim.amount));
  return { buildings: released, carter: { ...carter, homeBuildingId: target.id,
    reservation: { ...carter.reservation, homeCapacityClaim: null } } };
}
