import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { activeWallConstructionSiteId } from '../domain/palisadeConstructionSchedule';
import { createSimulationRoutePorts } from './simulationPorts';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import { constructionSiteId } from '../economy/construction';
import type { MaterialOutcome, MaterialPlacementMetadata } from './autoplayMaterialTypes';
import { materialWallOpen } from './autoplayMaterialEpisode';
import { qualifiedMaterialCycle } from './autoplayMaterialRecovery';
import { materialOpportunity } from './autoplayMaterialOpportunity';
import type { GameState } from './engine.types';
function terminal(state: GameState, outcome: MaterialOutcome): GameState {
  const record = state.autoplayMaterialRecovery;
  if (record === undefined || record.status === 'observing' || record.status === 'terminal') return state;
  return { ...state, autoplayMaterialRecovery: { version: 1, status: 'terminal', wallId: record.wallId, epoch: record.epoch,
    attemptSiteId: record.attemptSiteId, outcome, terminationTick: state.tick,
    ...(record.status === 'observing_result' && record.deterioration !== undefined ? { deterioration: record.deterioration } : {}),
    rawArrived: record.status === 'placed' ? 0 : record.rawArrived,
    produced: record.status === 'placed' ? 0 : record.produced, wallDelivered: record.status === 'placed' ? 0 : record.wallDelivered } };
}
export function recordMaterialPlacement(before: GameState, next: GameState, metadata: MaterialPlacementMetadata['materialRecovery']): GameState {
  if (next === before || metadata === undefined) return next;
  const qualified = qualifiedMaterialCycle(before);
  const id = constructionSiteId(before.nextConstructionOrdinal);
  if (qualified === null || qualified.episode.wallId !== metadata.episode.wallId || qualified.episode.epoch !== metadata.episode.epoch
    || !next.constructionSites.some(site => site.id === id && site.kind === 'masonry')) return next;
  return { ...next, autoplayMaterialRecovery: { version: 1, status: 'placed', ...qualified.episode,
    attemptSiteId: id, placedTick: before.tick, baseline: qualified.cycle, score: metadata.score } };
}
export function finishMaterialConstruction(state: GameState, completedIds: ReadonlySet<string>): GameState {
  const record = state.autoplayMaterialRecovery;
  if (record?.status !== 'placed' || !completedIds.has(record.attemptSiteId)) return state;
  if (state.palisade?.id !== record.wallId) return terminal(state, 'demand_closed');
  const home = state.buildings.find(home => home.id === record.attemptSiteId);
  const opportunity = home === undefined ? null : materialOpportunity(state, home, record.wallId);
  if (opportunity === null) return terminal(state, 'unobservable_at_completion');
  return { ...state, autoplayMaterialRecovery: { ...record, status: 'observing_result', completedTick: state.tick,
    opportunity, rawArrived: 0, produced: 0, wallDelivered: 0 } };
}
export function refreshMaterialResult(state: GameState): GameState {
  const record = state.autoplayMaterialRecovery;
  if (record === undefined || record.status === 'observing' || record.status === 'terminal') return state;
  if (state.palisade?.id !== record.wallId) return terminal(state, 'demand_closed');
  if (!state.buildings.some(home => home.id === record.attemptSiteId) && !state.constructionSites.some(site => site.id === record.attemptSiteId)) return terminal(state, 'cancelled_or_removed');
  if (!materialWallOpen(state, record.wallId)) return terminal(state, record.status === 'observing_result' && record.produced > 0 && record.wallDelivered > 0 ? 'credited_delivery' : 'demand_closed');
  if (record.status !== 'observing_result' || state.tick === record.completedTick) return state;
  const home = state.buildings.find(home => home.id === record.attemptSiteId);
  if (home === undefined) return terminal(state, 'cancelled_or_removed');
  const routes = createSimulationRoutePorts(state).delivery;
  const activeId = activeWallConstructionSiteId(state.constructionSites, record.wallId);
  const routeUnavailable = record.deterioration?.routeUnavailable === true || !buildingHasRequiredRoadAccess(state, home)
    || routes.betweenBuildings(home.id, record.opportunity.sourceId) === null
    || activeId !== null && routes.fromBuildingToDestination(home.id, { kind: 'construction_site', siteId: activeId }) === null;
  const understaffed = record.deterioration?.understaffed === true || home.workers < BUILDING_CONFIG_BY_KIND.masonry.workersRequired;
  const observed: GameState = { ...state, autoplayMaterialRecovery: { ...record, deterioration: { ...record.deterioration,
    ...(routeUnavailable ? { routeUnavailable: true } : {}), ...(understaffed ? { understaffed: true } : {}) } } };
  return state.tick >= record.opportunity.opportunityUntilTick
    ? terminal(observed, record.produced > 0 && record.wallDelivered > 0 ? 'credited_delivery' : 'ineffective') : observed;
}
