import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from '../content/buildingConfig';
import { HOUSING_CONFIG } from '../content/housingConfig';
import { constructionSiteId } from '../economy/construction';
import { hasConnectedConstructionRoute } from '../engine/autoplayConstructionRoute';
import type { GameState } from '../engine/engine.types';
import { householdServices } from '../engine/householdServices';
import { marketRoadService } from '../engine/marketService';
import { buildingHasRequiredRoadAccess } from '../engine/roadAccess';
import { roadPlacementAssessment, roadTimberCost } from '../engine/roadPlacement';
import { buildingRoadAccessTiles } from '../engine/routing';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import { allocateBuildingAndConstructionLabour } from '../population/labour';
import { allocateHouseServices, type HouseholdService } from '../population/serviceAllocation';
import { BRIDGE_TIMBER_PER_TILE } from '../world/bridges';
import { getTile, type TileCoordinate } from '../world/grid';
import { canPlaceBuilding, constructionShortfalls, PlacementFailure, type PlacementResult } from '../world/placement';
import { predictionStateKey } from './predictionCache';
import { A_TRIPLE_PRIME_ROAD_COPY } from './aTriplePrimeRoadCopy';
import { PLACEMENT_REASON_LABELS, predictionCheck } from './predictionRegistry';
import type { PlacementPrediction, PredictionLine } from './predictionTypes';
import { zonePlacementLines } from './zonePrediction';
import { ROAD_PLACEMENT_COPY } from './roadPlacementCopy.ko';

const SERVICES: Partial<Record<BuildingKind, HouseholdService>> = { well: 'water', market: 'market', church: 'church' };
const cache = new Map<string, { readonly stateKey: string; readonly value: PlacementPrediction }>();
function cached(state: GameState, key: string, compute: () => PlacementPrediction): PlacementPrediction {
  const stateKey = predictionStateKey(state);
  const previous = cache.get(key);
  if (previous?.stateKey === stateKey) return previous.value;
  const value = compute();
  // Keep only the most recent semantic state per pointer target; bound pointer history.
  if (!cache.has(key) && cache.size >= 128) cache.clear();
  cache.set(key, { stateKey, value });
  return value;
}
function failureLine(placement: PlacementResult): readonly PredictionLine[] {
  return placement.ok ? [] : [{ id: 'placement', severity: 'block', sources: [], text: PLACEMENT_REASON_LABELS[placement.reason] }];
}
function virtualFacility(state: GameState, kind: BuildingKind, tile: TileCoordinate): Building {
  return { id: constructionSiteId(state.nextConstructionOrdinal), kind, ...tile, workers: 0,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
function projectedState(state: GameState, candidate: Building): GameState {
  const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
  const virtual = { ...state, buildings: [...state.buildings, candidate], tiles: state.tiles.map(tile =>
    tile.tx >= candidate.tx && tile.tx < candidate.tx + definition.width
      && tile.ty >= candidate.ty && tile.ty < candidate.ty + definition.height ? { ...tile, buildingId: candidate.id } : tile) };
  const labour = allocateBuildingAndConstructionLabour(virtual.buildings, virtual.constructionSites, virtual.population,
    { era: virtual.era, tick: virtual.tick, eraProclaimedTick: virtual.eraProclaimedTick },
    building => buildingHasRequiredRoadAccess(virtual, building));
  return { ...virtual, buildings: [...labour.buildings], constructionSites: [...labour.constructionSites] };
}

export function buildingPlacementPrediction(state: GameState, kind: BuildingKind, tile: TileCoordinate): PlacementPrediction {
  return cached(state, `${kind}:${tile.tx},${tile.ty}`, () => {
    const definition = BUILDING_CONFIG_BY_KIND[kind];
    const placement = canPlaceBuilding(state, kind, tile.tx, tile.ty);
    const candidate = virtualFacility(state, kind, tile);
    const virtual = projectedState(state, candidate);
    const facility = virtual.buildings.find(b => b.id === candidate.id) ?? candidate;
    const service = SERVICES[kind];
    const radius = service !== undefined ? definition.serviceRadius : kind === 'granary' ? HOUSING_CONFIG[3].granaryRadius : null;
    const housesById = new Map(state.houses.map(h => [h.buildingId, h]));
    const houseIds = radius === null ? [] : state.buildings.filter(b => {
      const home = housesById.get(b.id);
      return home !== undefined && (kind !== 'granary' || home.level < 4)
        && buildingFootprintDistance(b, candidate) <= radius;
    }).map(b => b.id);
    const lines: PredictionLine[] = [...failureLine(placement), ...zonePlacementLines(state, kind, tile)];
    if (service !== undefined) {
      const allocation = allocateHouseServices({ houses: virtual.houses, buildings: virtual.buildings, roadService: marketRoadService(virtual) });
      const provider = allocation.providers.get(candidate.id);
      const before = householdServices(state);
      const newLots = [...allocation.houses].reduce((sum, [id, access]) => sum +
        (access[service].kind === 'served' && before.houses.get(id)?.[service].kind !== 'served' ? access[service].demand : 0), 0);
      lines.push({ id: 'supply', severity: 'info', sources: [], text: `완공 후 예상 공급 ${provider?.used ?? 0}/${provider?.capacity ?? 0}필지` });
      lines.push({ id: 'new-service', severity: 'info', sources: [], text: `새로 공급 ${newLots}필지 · 현재 인구·도로 기준` });
    }
    if (kind === 'granary') lines.push({ id: 'granary', severity: 'info', sources: [], text: `L3 곡창 거리 조건 ${houseIds.length}가구 · 빵 배송은 별도` });
    if (radius !== null) lines.push({ id: 'range', severity: 'info', sources: [], text: `범위 ${radius}칸 · 실제 대상은 주택 윤곽으로 표시` });
    const road = buildingRoadAccessTiles(virtual, candidate).length > 0;
    // FIX-1 made needs_road a placement rule: the checklist shows the verdict (UX-1 C: no interim "권장" wording).
    lines.push(predictionCheck('road', '도로 연결', road, !definition.requiresRoad ? '(운영에 불필요)' : ''));
    lines.push(predictionCheck('materials', '자재', Object.keys(constructionShortfalls(state, definition.buildCost)).length === 0));
    if (kind === 'wheat_farm' || kind === 'mill' || kind === 'granary') {
      const delivery = hasConnectedConstructionRoute(state, candidate);
      lines.push(predictionCheck('delivery-route', A_TRIPLE_PRIME_ROAD_COPY.foodDeliveryRoute,
        delivery, delivery ? '' : A_TRIPLE_PRIME_ROAD_COPY.foodDeliveryRouteMissing));
    }
    if (kind === 'market') lines.push(predictionCheck('workers', '일꾼', facility.workers >= definition.workersRequired, `${facility.workers}/${definition.workersRequired}명`));
    return { lines, houseIds, range: radius === null ? null : { center: { tx: tile.tx + (definition.width - 1) / 2, ty: tile.ty + (definition.height - 1) / 2 }, radius }, roadSegments: [], placement };
  });
}

export function roadPlacementPrediction(state: GameState, path: readonly TileCoordinate[]): PlacementPrediction {
  return cached(state, `road:${path.map(p => `${p.tx},${p.ty}`).join(';')}`, () => {
    const assessment = roadPlacementAssessment(state, path);
    const reason = assessment.failure;
    const placement: PlacementResult = reason === null ? { ok: true }
      : reason === PlacementFailure.insufficient_materials ? { ok: false, reason, shortfalls: constructionShortfalls(state, { timber: roadTimberCost(state, path) }) }
      : { ok: false, reason };
    const roadSegments = assessment.newTiles.map(tile => ({ tile, kind: getTile(state, tile)?.terrain === 'water' ? 'bridge' as const : 'land' as const }));
    const bridges = roadSegments.filter(s => s.kind === 'bridge').length;
    const lines = assessment.newTiles.length === 0 && reason === null
      ? [{ id: 'placement', severity: 'info' as const, sources: [], text: ROAD_PLACEMENT_COPY.alreadyExists }]
      : failureLine(placement);
    return { placement, range: null, houseIds: [], roadSegments, lines: [...lines,
      { id: 'road-cost', severity: 'info', sources: [], text: ROAD_PLACEMENT_COPY.previewCost(roadSegments.length - bridges,
        bridges, assessment.existingTiles.length, BRIDGE_TIMBER_PER_TILE, roadTimberCost(state, path)) }] };
  });
}
