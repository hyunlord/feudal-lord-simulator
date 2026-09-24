import { storageOverflowCause } from './storageOverflowModel';
import { BUILDING_OPERATION_COPY } from './buildingOperationCopy.ko';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { HOUSING_CONFIG, type HousingRequirement } from '../content/housingConfig';
import type { GameState } from '../engine/engine.types';
import { BALANCE } from '../content/balanceConfig';
import { feasibleDistributorDistance } from '../engine/distributorAccess';
import { householdServices } from '../engine/householdServices';
import { marketRoadService } from '../engine/marketService';
import { buildingHasRequiredRoadAccess } from '../engine/roadAccess';
import { productionOperation } from '../economy/production';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import { palisadeProtectionForBuilding } from '../geometry/palisadeProtection';
import { houseHasFood } from '../population/houseFood';
import { houseBuiltLevel } from '../population/houseCondition';
import type { House } from '../population/population.types';
import { HOUSEHOLD_SERVICE_CONFIG, type HouseholdService } from '../population/serviceAllocation';
import type { CauseDetail } from './causeRegistry';
import { buildingProblemCause } from './problemCauseModel';
import { serviceDiagnosis } from './serviceDiagnosisModel';
import { buildBuildingVisualState } from '../render/buildingVisualState';
import { problemMarkerKind } from '../render/drawBuildingDetails';

export type { CauseDetail } from './causeRegistry';
export type BuildingCausePresentation = Readonly<{
  buildingId: string;
  name: string;
  status: 'normal' | 'ready' | 'blocked' | 'risk';
  blocker: CauseDetail | null;
  summary: string;
}>;
export type HouseProgressModel = BuildingCausePresentation & Readonly<{
  currentLevel: number;
  nextLevel: number | null;
  progressTicks: number;
  requiredTicks: number | null;
  remainingTicks: number | null;
}>;
type RoadService = ReturnType<typeof marketRoadService>;
const cache = new WeakMap<GameState, ReadonlyMap<string, BuildingCausePresentation | HouseProgressModel>>();
const PRIORITY = { water: 0, bread: 1, granary: 2, market: 3, church: 4, protected: 5, production: 6 } as const;

function serviceBlocker(state: GameState, home: Building, service: HouseholdService, road: RoadService): CauseDetail | null {
  const diagnosis = serviceDiagnosis(state, home, service);
  if (diagnosis.kind === 'served') return null;
  const config = HOUSEHOLD_SERVICE_CONFIG[service];
  const definition = BUILDING_CONFIG_BY_KIND[config.kind];
  const providers = state.buildings.filter(b => b.kind === config.kind)
    .sort((a, b) => buildingFootprintDistance(home, a) - buildingFootprintDistance(home, b) || a.id.localeCompare(b.id));
  const eligible = providers.find(b => b.operationPaused !== true && buildingFootprintDistance(home, b) <= definition.serviceRadius
    && b.workers >= definition.workersRequired && (!config.roadRequired || road(home, b)));
  const allocation = eligible === undefined ? undefined : householdServices(state).providers.get(eligible.id);
  const usage = allocation === undefined ? '' : ` · 담당 ${allocation.used}/${allocation.capacity}필지`;
  const distance = eligible === undefined ? diagnosis.distance : buildingFootprintDistance(home, eligible);
  return {
    causeId: diagnosis.kind === 'paused' ? 'operation_paused' : diagnosis.kind === 'unreachable' ? 'delivery' : diagnosis.kind === 'understaffed' ? 'workers' : service,
    requirement: service, reason: diagnosis.kind,
    label: `${diagnosis.label}${usage}${['capacity', 'understaffed', 'unreachable'].includes(diagnosis.kind) && Number.isFinite(distance) ? ` · 거리 ${distance} / 범위 ${diagnosis.serviceRadius}` : ''}`,
    ...(eligible === undefined ? {} : { providerId: eligible.id }),
    ...(allocation === undefined ? {} : { used: allocation.used, capacity: allocation.capacity }),
    ...(Number.isFinite(distance) ? { distance } : {}),
  };
}

function requirementBlockers(state: GameState, house: House, home: Building, road: RoadService): Readonly<Record<HousingRequirement, CauseDetail | null>> {
  const granaries = state.buildings.filter(b => b.kind === 'granary');
  const stocked = granaries.filter(b => (b.inventory.bread ?? 0) > 0);
  const nearest = Math.min(...granaries.map(b => buildingFootprintDistance(home, b)));
  const deliveryDistances = houseHasFood(house) ? [] : stocked.flatMap(granary => {
    const distance = feasibleDistributorDistance(state, granary, home.id);
    return distance === null ? [] : [distance];
  });
  const deliveryDistance = Math.min(...deliveryDistances);
  const breadReason = granaries.length === 0 ? 'no_granary' : stocked.length === 0 ? 'granary_empty'
    : deliveryDistances.length === 0 ? 'road_disconnected' : deliveryDistance > BALANCE.DISTRIBUTOR_RANGE ? 'delivery_range' : 'awaiting_delivery';
  const breadLabels = { no_granary: '빵이 없고 배급할 곡창이 없습니다', granary_empty: '빵이 없고 곡창의 빵 재고가 없습니다',
    awaiting_delivery: '집에 빵이 없습니다 — 배급을 기다립니다', road_disconnected: '집에 빵이 없습니다 — 곡창의 배급 출구에서 도달할 수 없습니다',
    delivery_range: `빵 배급 범위 밖입니다 — 도로거리 ${deliveryDistance} / 범위 ${BALANCE.DISTRIBUTOR_RANGE}` } as const;
  const protection = palisadeProtectionForBuilding(home, state.palisade);
  return {
    water: serviceBlocker(state, home, 'water', road),
    bread: houseHasFood(house) ? null : { causeId: 'bread', requirement: 'bread', reason: breadReason, label: breadLabels[breadReason] },
    granary: nearest <= HOUSING_CONFIG[3].granaryRadius ? null : {
      causeId: 'delivery', requirement: 'granary', reason: 'granary_proximity',
      label: Number.isFinite(nearest) ? `가까운 곡창이 필요합니다 — 거리 ${nearest} / 범위 ${HOUSING_CONFIG[3].granaryRadius}` : '가까운 곡창이 필요합니다',
      ...(Number.isFinite(nearest) ? { distance: nearest } : {}),
    },
    market: serviceBlocker(state, home, 'market', road),
    church: serviceBlocker(state, home, 'church', road),
    protected: protection === 'inside' ? null : { causeId: 'wall', requirement: 'protected', reason: protection,
      label: protection === 'outside' ? '완성된 성벽 밖에 있습니다' : '완성된 성벽의 보호가 필요합니다' },
  };
}
function firstRequirement(requirements: readonly HousingRequirement[], blockers: Readonly<Record<HousingRequirement, CauseDetail | null>>): CauseDetail | null {
  return requirements.flatMap(requirement => blockers[requirement] === null ? [] : [blockers[requirement]])
    .sort((a, b) => (a.reason === 'unreachable' ? 2 : PRIORITY[a.requirement])
      - (b.reason === 'unreachable' ? 2 : PRIORITY[b.requirement]))[0] ?? null;
}
function deriveHouse(state: GameState, house: House, home: Building, road: RoadService): HouseProgressModel {
  const blockers = requirementBlockers(state, house, home, road);
  const supported = HOUSING_CONFIG.filter(def => def.requires.every(req => blockers[req] === null)).at(-1)?.level ?? 0;
  const outsideCap = house.level < 3 && palisadeProtectionForBuilding(home, state.palisade) === 'outside';
  const target = outsideCap ? Math.min(supported, 2) : supported;
  const next = HOUSING_CONFIG.find(def => def.level === house.level + 1);
  const nextLevel = next?.level ?? null;
  const risk = target < house.level;
  const nextBlocker = next === undefined ? null : firstRequirement(next.requires, blockers)
    ?? (outsideCap && next.level >= 3 ? blockers.protected : null);
  const ready = next !== undefined && nextBlocker === null;
  const requirementLevel = risk ? house.level : nextLevel;
  const requirements = HOUSING_CONFIG.find(def => def.level === requirementLevel)?.requires ?? [];
  const blocker = risk ? firstRequirement(requirements, blockers) : ready ? null : nextBlocker;
  const status = risk ? 'risk' : ready ? 'ready' : blocker === null ? 'normal' : 'blocked';
  const name = HOUSING_CONFIG.find(def => def.level === houseBuiltLevel(house))?.name ?? HOUSING_CONFIG[0].name;
  const nextName = HOUSING_CONFIG.find(def => def.level === nextLevel)?.name;
  const requiredTicks = next?.promotionHoldTicks ?? null;
  const progressTicks = ready && requiredTicks !== null ? Math.min(requiredTicks, house.promotionTicks ?? 0) : 0;
  const remainingTicks = ready && requiredTicks !== null ? requiredTicks - progressTicks : null;
  const remainingSeconds = remainingTicks === null ? 0 : Math.ceil(remainingTicks / BALANCE.TICKS_PER_SECOND);
  const remainingLabel = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;
  const summary = risk ? `생활 L${house.level} 유지 위험 · ${blocker?.label ?? ''}` : ready ? `L${nextLevel} ${nextName ?? ''} 승급 대기 · ${remainingLabel} 남음`
    : blocker === null ? `생활 L${house.level} 유지 중` : `L${nextLevel} ${nextName ?? ''} 필요 · ${blocker.label}`;
  return { buildingId: home.id, name, currentLevel: house.level, nextLevel, status, blocker, summary,
    progressTicks, requiredTicks, remainingTicks };
}
function deriveFacility(state: GameState, building: Building): BuildingCausePresentation {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  if (building.operationPaused === true) return { buildingId: building.id, name: definition.name, status: 'blocked',
    blocker: { causeId: 'operation_paused', requirement: 'production', reason: 'paused', label: BUILDING_OPERATION_COPY.paused }, summary: BUILDING_OPERATION_COPY.paused };
  const overflow = storageOverflowCause(building);
  if (overflow !== null) return { buildingId: building.id, name: definition.name, status: 'blocked', blocker: overflow, summary: overflow.label };
  const marker = problemMarkerKind({ kind: building.kind, visualState: buildBuildingVisualState(building, []) });
  if (marker === null) return { buildingId: building.id, name: definition.name, status: 'normal', blocker: null, summary: `${definition.name} 운영 정보` };
  const road = buildingHasRequiredRoadAccess(state, building);
  const operation = definition.production === null ? (!road ? 'no_road' : building.workers < definition.workersRequired ? 'understaffed' : 'working')
    : productionOperation(building, definition, road);
  const label = buildingProblemCause(state, building.id) ?? (operation === 'no_road' ? '운영에 필요한 도로가 없습니다'
    : operation === 'understaffed' ? `일꾼 부족 — ${building.workers}/${definition.workersRequired}명` : '');
  const blocker: CauseDetail | null = marker !== null ? { causeId: marker === 'labour' ? 'workers' : marker === 'bread' ? 'bread' : 'delivery', requirement: 'production', reason: operation, label } : null;
  return { buildingId: building.id, name: definition.name, status: blocker === null ? 'normal' : 'blocked', blocker,
    summary: blocker === null ? `${definition.name} 운영 중` : `${definition.name} · ${blocker.label}` };
}

/** Presentation only. Immutable identity also invalidates paused road and staffing edits. */
export function buildingCauseSnapshot(state: GameState): ReadonlyMap<string, BuildingCausePresentation | HouseProgressModel> {
  const previous = cache.get(state);
  if (previous !== undefined) return previous;
  const road = marketRoadService(state);
  const houses = new Map(state.houses.map(house => [house.buildingId, house]));
  const snapshot = new Map<string, BuildingCausePresentation | HouseProgressModel>();
  for (const building of state.buildings) {
    const house = houses.get(building.id);
    snapshot.set(building.id, house === undefined ? deriveFacility(state, building) : deriveHouse(state, house, building, road));
  }
  cache.set(state, snapshot);
  return snapshot;
}
export function buildingCausePresentation(state: GameState, buildingId: string): BuildingCausePresentation | null {
  return buildingCauseSnapshot(state).get(buildingId) ?? null;
}
export function houseProgressModel(state: GameState, houseId: string): HouseProgressModel | null {
  const model = buildingCauseSnapshot(state).get(houseId);
  return model !== undefined && 'currentLevel' in model ? model : null;
}
export function firstBlocker(house: House, state: GameState): CauseDetail | null {
  if (house.level >= 4) return null;
  const home = state.buildings.find(b => b.id === house.buildingId);
  if (home === undefined) return null;
  const model = deriveHouse(state, house, home, marketRoadService(state));
  if (model.status === 'ready') return null;
  const blockers = requirementBlockers(state, house, home, marketRoadService(state));
  return firstRequirement(HOUSING_CONFIG.find(def => def.level === house.level + 1)?.requires ?? [], blockers)
    ?? (house.level < 3 && palisadeProtectionForBuilding(home, state.palisade) === 'outside' ? blockers.protected : null);
}
