import { parseMaterialRecovery } from './autoplayMaterialParse';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { availableStock } from '../economy/storage';
import { availableWorkers } from '../population/labour';
import { currentMaterialEpisode } from './autoplayMaterialEpisode';
import { materialBuildCandidate, materialDemand } from './autoplayMaterialCandidates';
import { materialPathKey } from './autoplayMaterialCycle';
import { materialRawSource } from './autoplayMaterialRoutes';
import { createSimulationRoutePorts } from './simulationPorts';
import type { AutoplayAction } from './autoplay.types';
import type { GameState } from './engine.types';
export function qualifiedMaterialCycle(state: GameState) {
  const record = parseMaterialRecovery(state.autoplayMaterialRecovery, state.tick), episode = currentMaterialEpisode(state);
  if (record?.status !== 'observing' || episode?.wallId !== record.wallId || episode.epoch !== record.epoch) return null;
  const cycle = record.completedCycle;
  if (cycle?.returnedTick === undefined || cycle.returnedTick > state.tick || cycle.rawArrived <= 0 || cycle.produced <= 0
    || cycle.wallDelivered <= 0 || cycle.haulNoInputTicks <= cycle.workingTicks || cycle.roadRevision !== state.roadRevision) return null;
  const home = state.buildings.find(home => home.id === record.incumbentId);
  const routes = createSimulationRoutePorts(state).delivery;
  const raw = home === undefined ? null : materialRawSource(state, home, routes);
  return raw !== null && raw.building.id === cycle.sourceId && materialPathKey(raw.path) === cycle.rawPath ? { episode, cycle } : null;
}
export function materialRecoveryAction(state: GameState): AutoplayAction {
  const qualified = qualifiedMaterialCycle(state);
  if (qualified === null || state.constructionSites.some(site => site.kind === 'masonry')) return { kind: 'none' };
  const required = BUILDING_CONFIG_BY_KIND.masonry.workersRequired;
  const staffing = state.buildings.reduce((sum, home) => sum + BUILDING_CONFIG_BY_KIND[home.kind].workersRequired, 0)
    + state.constructionSites.filter(isBuildingConstructionSite).reduce((sum, site) => sum + BUILDING_CONFIG_BY_KIND[site.kind].workersRequired, 0);
  if (state.idleWorkers < required || availableWorkers(state.population) - staffing < required) return { kind: 'none' };
  const demand = materialDemand(state, qualified.episode.wallId);
  const gap = demand.reduce((sum, need) => sum + need.amount, 0);
  if (gap === 0) return { kind: 'none' };
  const routes = createSimulationRoutePorts(state).delivery;
  const supplied = state.buildings.reduce((sum, home) => {
    const stock = availableStock(home, 'stone');
    return sum + (stock > 0 && demand.every(need =>
      routes.fromBuildingToDestination(home.id, { kind: 'construction_site', siteId: need.site.id }) !== null) ? stock : 0);
  }, 0);
  if (supplied >= gap) return { kind: 'none' };
  const candidate = materialBuildCandidate(state, qualified.episode.wallId);
  return candidate === null ? { kind: 'none' } : { kind: 'place_building', building: 'masonry', tx: candidate.home.tx, ty: candidate.home.ty,
    materialRecovery: { episode: qualified.episode, baseline: qualified.cycle, score: candidate.evidence } };
}
