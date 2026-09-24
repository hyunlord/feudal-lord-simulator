import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { BALANCE } from '../content/balanceConfig';
import { STORAGE_KIND_BY_RESOURCE } from '../content/resourceConfig';
import { constructionDeliveryNeed, isBuildingConstructionSite, isWallConstructionSite } from '../economy/construction';
import { availableStock, storageCapacityBlock } from '../economy/storage';
import { placementSpendableResource } from '../world/placement';
import type { GameState } from './engine.types';

export const TIMBER_EXPANSION_OBSERVATION_TICKS = 2400;
const EXPANSION_TIMBER_THRESHOLD = 120;

type TimberKind = 'logging_camp' | 'sawmill';
export function recordTimberExpansionShortage(state: GameState): GameState {
  const observation = state.timberProductionWindow;
  if (observation === undefined) return state;
  const old = observation.expansionShortageSinceTick;
  const pending = state.constructionSites.some(site => isBuildingConstructionSite(site)
    && (site.kind === 'sawmill' || site.kind === 'logging_camp'));
  const short = !pending && state.constructionSites.some(site => isWallConstructionSite(site)
    && (constructionDeliveryNeed(site).timber ?? 0) > 0)
    && placementSpendableResource(state, 'timber') < EXPANSION_TIMBER_THRESHOLD;
  if (short) {
    const nextObservation = { ...observation, expansionShortageSinceTick: old ?? state.tick };
    return { ...state, timberProductionWindow: nextObservation };
  }
  if (old === undefined) return state;
  const { expansionShortageSinceTick: _removed, ...rest } = { ...observation, expansionShortageSinceTick: old };
  return { ...state, timberProductionWindow: rest };
}

/** S8-F1: a full shortage window permits one affordable, staffed chain addition.
 * A pending addition restarts observation; existing food/service facility caps stay unchanged. */
export function timberExpansionKind(state: GameState): TimberKind | null {
  const observation = state.timberProductionWindow;
  const since = observation?.expansionShortageSinceTick;
  if (since === undefined || state.tick - since < TIMBER_EXPANSION_OBSERVATION_TICKS
    || placementSpendableResource(state, 'timber') >= EXPANSION_TIMBER_THRESHOLD
    || state.constructionSites.some(site => isBuildingConstructionSite(site)
      && (site.kind === 'logging_camp' || site.kind === 'sawmill'))) return null;
  const wallNeed = state.constructionSites.filter(isWallConstructionSite)
    .reduce((sum, site) => sum + (constructionDeliveryNeed(site).timber ?? 0), 0);
  if (wallNeed === 0 || wallNeed <= (observation?.produced ?? 0)) return null;
  const sourceLogs = state.buildings.filter(building => building.kind === STORAGE_KIND_BY_RESOURCE.logs)
    .reduce((sum, building) => sum + availableStock(building, 'logs'), 0);
  const inputPerOutput = BUILDING_CONFIG_BY_KIND.sawmill.production?.inputPerOutput ?? 0;
  const existingInputNeed = state.buildings.filter(building => building.kind === 'sawmill')
    .reduce((sum, building) => sum + Math.max(0, inputPerOutput - availableStock(building, 'logs') - (building.reserved.logs ?? 0)), 0);
  const kind: TimberKind = sourceLogs - existingInputNeed >= BALANCE.CARTER_CAPACITY ? 'sawmill' : 'logging_camp';
  const config = BUILDING_CONFIG_BY_KIND[kind];
  const existing = state.buildings.filter(building => building.kind === kind);
  if (existing.some(building => building.workers < config.workersRequired)
    || state.idleWorkers < config.workersRequired || storageCapacityBlock(state.buildings, kind === 'sawmill' ? 'timber' : 'logs') !== null
    || placementSpendableResource(state, 'timber') < (config.buildCost.timber ?? 0)) return null;
  return kind;
}
