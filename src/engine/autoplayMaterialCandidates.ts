import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { constructionDeliveryNeed, createConstructionSite, isStoneWallConstructionSite } from '../economy/construction';
import { availableStock } from '../economy/storage';
import { activeWallConstructionSiteId } from '../domain/palisadeConstructionSchedule';
import { canPlaceBuilding } from '../world/placement';
import { createSimulationRoutePorts } from './simulationPorts';
import { materialRawSource } from './autoplayMaterialRoutes';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { preserveRoadExpansion } from './autoplayExpansion';
import type { GameState } from './engine.types';
import type { MaterialScore } from './autoplayMaterialTypes';
export function materialDemand(state: GameState, wallId: string) {
  return state.constructionSites.filter(isStoneWallConstructionSite).filter(site => site.wallId === wallId)
    .map(site => ({ site, amount: constructionDeliveryNeed(site).stone ?? 0 })).filter(need => need.amount > 0);
}
export function materialRouteScore(state: GameState, home: Building, wallId: string) {
  return scoreMaterialRoutes(state, home, materialDemand(state, wallId), activeWallConstructionSiteId(state.constructionSites, wallId));
}
function scoreMaterialRoutes(state: GameState, home: Building, demand: ReturnType<typeof materialDemand>, activeId: string | null, maximumActiveEdges = Infinity) {
  const routes = createSimulationRoutePorts(state).delivery;
  const raw = materialRawSource(state, home, routes);
  if (raw === null) return null;
  const active = activeId === null ? null : routes.fromBuildingToDestination(home.id, { kind: 'construction_site', siteId: activeId }) ?? null;
  if (active === null || Math.max(0, active.length - 1) > maximumActiveEdges) return null;
  const recipe = BUILDING_CONFIG_BY_KIND.masonry.production;
  if (recipe === null || demand.length === 0) return null;
  const rawEdges = Math.max(0, raw.path.length - 1);
  let score = Math.ceil(recipe.inputPerOutput * demand.reduce((sum, need) => sum + need.amount, 0) / BALANCE.CARTER_CAPACITY) * rawEdges;
  for (const need of demand) {
    const path = routes.fromBuildingToDestination(home.id, { kind: 'construction_site', siteId: need.site.id }) ?? null;
    if (path === null) return null;
    score += Math.ceil(need.amount / BALANCE.CARTER_CAPACITY) * Math.max(0, path.length - 1);
  }
  return { score, activeEdges: Math.max(0, active.length - 1), sourceId: raw.building.id, rawEdges, admittedRaw: raw.amount };
}
function constructionSupply(state: GameState, home: Building): boolean {
  const site = createConstructionSite({ ordinal: state.nextConstructionOrdinal, kind: 'masonry', tx: home.tx, ty: home.ty, startedTick: state.tick });
  const projected = { ...state, constructionSites: [...state.constructionSites, site], pathCache: {} };
  const routes = createSimulationRoutePorts(projected).delivery;
  let timber = 0, treasuryReachable = false;
  for (const source of state.buildings) {
    if ((availableStock(source, 'timber') > 0 || source.kind === 'house' && state.treasuryTimber > 0)
      && routes.fromBuildingToDestination(source.id, { kind: 'construction_site', siteId: site.id }) !== null) {
      timber += availableStock(source, 'timber');
      if (source.kind === 'house') treasuryReachable = true;
    }
  }
  return timber + (treasuryReachable ? state.treasuryTimber : 0) >= (site.required.timber ?? 0);
}
export function materialBuildCandidate(state: GameState, wallId: string): { readonly home: Building; readonly evidence: MaterialScore } | null {
  const demand = materialDemand(state, wallId);
  const activeId = activeWallConstructionSiteId(state.constructionSites, wallId);
  const incumbents = state.buildings.filter(home => home.kind === 'masonry').flatMap(home => {
    const score = scoreMaterialRoutes(state, home, demand, activeId); return score === null ? [] : [score];
  });
  if (incumbents.length === 0) return null;
  const incumbentScore = Math.min(...incumbents.map(score => score.score));
  const incumbentActiveEdges = Math.min(...incumbents.map(score => score.activeEdges));
  const candidates = state.tiles.flatMap(tile => {
    const home: Building = { id: `autoplay-material-${tile.tx}-${tile.ty}`, kind: 'masonry', tx: tile.tx, ty: tile.ty,
      workers: BUILDING_CONFIG_BY_KIND.masonry.workersRequired, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
    if (!buildingHasRequiredRoadAccess(state, home)) return [];
    if (!hasAutoplayBuildingClearance(state, 'masonry', tile) || !canPlaceBuilding(state, 'masonry', tile.tx, tile.ty).ok) return [];
    const projected: GameState = { ...state, buildings: [...state.buildings, home], pathCache: {} };
    const score = scoreMaterialRoutes(projected, home, demand, activeId, incumbentActiveEdges);
    if (score === null || score.score >= incumbentScore || score.activeEdges > incumbentActiveEdges || !constructionSupply(state, home)) return [];
    return [{ home, evidence: { ...score, incumbentScore, incumbentActiveEdges } }];
  }).sort((a, b) => a.evidence.score - b.evidence.score || a.evidence.activeEdges - b.evidence.activeEdges || a.home.ty - b.home.ty || a.home.tx - b.home.tx);
  for (const candidate of candidates) {
    const home = candidate.home;
    if (!preservesAutoplayWallSpace(state, 'masonry', home) || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'masonry', tx: home.tx, ty: home.ty })
      || preserveRoadExpansion(state, home) !== null) continue;
    return candidate;
  }
  return null;
}
