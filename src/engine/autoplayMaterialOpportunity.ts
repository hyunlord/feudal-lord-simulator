import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { fetchCandidate } from '../agents/deliveryBuildingCandidates';
import { hasArrivedAtPathEnd, stepWalkerAlongPath } from '../agents/movement';
import type { CarterWalker, TilePos } from '../agents/walker.types';
import { activeWallConstructionSiteId } from '../domain/palisadeConstructionSchedule';
import { AUTOPLAY_TICK_CADENCE } from './autoplay.types';
import { createDeliveryInventoryPort, createSimulationRoutePorts } from './simulationPorts';
import type { GameState } from './engine.types';
import type { MaterialOpportunity } from './autoplayMaterialTypes';
/** Actual movement stepping, including the one substep required by a singleton leg. No walker enters the game. */
export function materialLegTicks(path: readonly TilePos[]): number | null {
  for (const [index, point] of path.entries()) {
    if (!Number.isSafeInteger(point.tx) || !Number.isSafeInteger(point.ty) || point.tx < 0 || point.ty < 0) return null;
    const prior = path[index - 1];
    if (prior !== undefined && Math.abs(point.tx - prior.tx) + Math.abs(point.ty - prior.ty) !== 1) return null;
  }
  const destination = { kind: 'building' as const, buildingId: 'duration' };
  let walker: CarterWalker = { id: 'duration', kind: 'carter', mission: 'deliver', phase: 'outbound', homeBuildingId: 'duration', destination,
    path, position: path[0] ?? { tx: 0, ty: 0 }, pathIndex: 0, previousTile: null, cargo: null, spawnedTick: 0, cancellation: null,
    reservation: { destination, resource: 'stone', amount: 0, sourceStockClaim: null, homeCapacityClaim: null } };
  let ticks = 0;
  // Unit road edges finish within this conservative budget; precision stalls are unobservable, not estimates.
  const maximumTicks = 1 + Math.max(0, path.length - 1) * (Math.ceil(1 / BALANCE.CARTER_SPEED) + 1);
  do {
    walker = stepWalkerAlongPath(walker, BALANCE.CARTER_SPEED);
    ticks++;
    if (ticks > maximumTicks) return null;
  } while (!hasArrivedAtPathEnd(walker));
  return ticks;
}
function fitsWorld(path: readonly TilePos[], state: GameState): boolean {
  return path.length <= state.tiles.length && path.every(point => Number.isSafeInteger(point.tx) && Number.isSafeInteger(point.ty)
    && point.tx >= 0 && point.ty >= 0 && point.tx < state.width && point.ty < state.height);
}
export function materialOpportunity(state: GameState, home: Building, wallId: string): MaterialOpportunity | null {
  const routes = createSimulationRoutePorts(state).delivery;
  const raw = fetchCandidate(home, 'stone_raw', state.buildings, createDeliveryInventoryPort(), routes);
  const activeSiteId = activeWallConstructionSiteId(state.constructionSites, wallId);
  const output = activeSiteId === null ? null : routes.fromBuildingToDestination(home.id, { kind: 'construction_site', siteId: activeSiteId });
  const recipe = BUILDING_CONFIG_BY_KIND.masonry.production;
  if (raw === null || output === null || activeSiteId === null || recipe === null || raw.amount < recipe.inputPerOutput) return null;
  if (!fitsWorld(raw.path, state) || !fitsWorld(output, state)) return null;
  const rawReturn = routes.fromTileToBuilding(raw.path.at(-1) ?? home, home.id);
  const outputReturn = routes.fromTileToBuilding(output.at(-1) ?? home, home.id);
  if (rawReturn === null || outputReturn === null) return null;
  if (!fitsWorld(rawReturn, state) || !fitsWorld(outputReturn, state)) return null;
  const rawOutTicks = materialLegTicks(raw.path), rawBackTicks = materialLegTicks(rawReturn);
  const outputOutTicks = materialLegTicks(output), outputBackTicks = materialLegTicks(outputReturn);
  if (rawOutTicks === null || rawBackTicks === null || outputOutTicks === null || outputBackTicks === null) return null;
  const rawLegTicks = rawOutTicks + rawBackTicks;
  const outputLegTicks = outputOutTicks + outputBackTicks;
  const workTicks = Math.floor(raw.amount / recipe.inputPerOutput) * recipe.ticksPerOutput;
  const cycleEnd = state.tick + 1 + rawLegTicks + workTicks + outputLegTicks;
  const opportunityUntilTick = Math.ceil(cycleEnd / AUTOPLAY_TICK_CADENCE) * AUTOPLAY_TICK_CADENCE;
  return { sourceId: raw.building.id, activeSiteId, admittedRaw: raw.amount, rawLegTicks, outputLegTicks, workTicks,
    alignmentTicks: opportunityUntilTick - state.tick - rawLegTicks - workTicks - outputLegTicks, opportunityUntilTick };
}
