import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import { materialPathKey } from './autoplayMaterialCycle';
import type { DeliveryRoutePort } from '../agents/deliveryTypes';
import { currentMaterialEpisode, materialEpoch, materialWallOpen } from './autoplayMaterialEpisode';
import { parseMaterialRecovery } from './autoplayMaterialParse';
import { materialRawSource } from './autoplayMaterialRoutes';
import type { GameState } from './engine.types';
export function beginMaterialObservation(input: GameState, routes: DeliveryRoutePort): GameState {
  const record = parseMaterialRecovery(input.autoplayMaterialRecovery, input.tick);
  const { autoplayMaterialRecovery: _old, ...withoutRecord } = input;
  const state: GameState = record === undefined ? withoutRecord : { ...input, autoplayMaterialRecovery: record };
  const episode = currentMaterialEpisode(state);
  if (episode === null) {
    if (record?.status !== 'observing' || materialEpoch(state) !== null) return state;
    const { cycle: _cycle, completedCycle: _completed, ...fresh } = record;
    return { ...state, autoplayMaterialRecovery: fresh };
  }
  if (record !== undefined && (record.wallId === episode.wallId && record.epoch === episode.epoch
    || record.epoch === episode.epoch && materialWallOpen(state, record.wallId))) {
    if (record.status !== 'observing') return state;
    const home = state.buildings.find(building => building.id === record.incumbentId);
    const evidence = record.cycle ?? record.completedCycle;
    const path = evidence === undefined ? null : routes.betweenBuildings(record.incumbentId, evidence.sourceId);
    if (home !== undefined && home.workers >= BUILDING_CONFIG_BY_KIND.masonry.workersRequired && buildingHasRequiredRoadAccess(state, home)
      && (evidence === undefined || evidence.roadRevision === state.roadRevision && path !== null && materialPathKey(path) === evidence.rawPath)) return state;
    const incumbent = [...state.buildings].sort((a, b) => a.id.localeCompare(b.id)).find(building => materialRawSource(state, building, routes) !== null);
    return { ...state, autoplayMaterialRecovery: { version: 1, status: 'observing', ...episode, incumbentId: incumbent?.id ?? record.incumbentId } };
  }
  const incumbent = [...state.buildings].sort((a, b) => a.id.localeCompare(b.id)).find(home => materialRawSource(state, home, routes) !== null);
  return incumbent === undefined ? state : { ...state, autoplayMaterialRecovery: { version: 1, status: 'observing', ...episode, incumbentId: incumbent.id } };
}
