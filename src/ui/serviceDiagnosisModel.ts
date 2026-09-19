import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import type { GameState } from '../engine/engine.types';
import { householdServices } from '../engine/householdServices';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import { HOUSEHOLD_SERVICE_CONFIG, type HouseholdService, type ServiceAccessKind } from '../population/serviceAllocation';

export type ServiceDiagnosis = Readonly<{
  kind: ServiceAccessKind;
  label: string;
  distance: number;
  serviceRadius: number;
}>;
const NAMES = { water: '우물', market: '시장', church: '교회' } as const;

export function serviceDiagnosis(state: GameState, home: Building, service: HouseholdService): ServiceDiagnosis {
  const allocation = householdServices(state);
  const access = allocation.houses.get(home.id)?.[service];
  const config = HOUSEHOLD_SERVICE_CONFIG[service];
  const providers = state.buildings.filter(building => building.kind === config.kind);
  const provider = state.buildings.find(building => building.id === access?.providerId);
  const distance = provider === undefined
    ? Math.min(...providers.map(building => buildingFootprintDistance(home, building)))
    : buildingFootprintDistance(home, provider);
  const serviceRadius = BUILDING_CONFIG_BY_KIND[config.kind].serviceRadius;
  const kind = access?.kind ?? 'missing';
  const name = NAMES[service];
  const capacity = provider === undefined ? undefined : allocation.providers.get(provider.id);
  const usage = capacity === undefined ? '' : ` · 담당 ${capacity.used}/${capacity.capacity}필지`;
  let label: string;
  switch (kind) {
    case 'served': label = service === 'water' ? `우물에서 ${distance}칸` : `${name} 이용 가능 — 거리 ${distance} / 범위 ${serviceRadius}${usage}`; break;
    case 'missing': label = service === 'water' ? '우물이 없습니다' : `${name} 없음`; break;
    case 'outside': label = service === 'water' ? `우물이 너무 멉니다 — 거리 ${distance} / 범위 ${serviceRadius}` : `${name}이 멉니다 — 거리 ${distance} / 범위 ${serviceRadius}`; break;
    case 'understaffed': label = `가까운 ${name}의 일꾼이 부족합니다`; break;
    case 'unreachable': label = `${name}까지 연결된 도로가 없습니다`; break;
    case 'capacity': label = `${name} 수용량 부족 — 가까운 곳에 추가 시설이 필요합니다`; break;
  }
  return { kind, label, distance, serviceRadius };
}

export function providerServiceRows(state: GameState, building: Building): readonly string[] {
  if (building.kind !== 'well' && building.kind !== 'market' && building.kind !== 'church') return [];
  const provider = householdServices(state).providers.get(building.id);
  if (provider === undefined) return [];
  return [
    `서비스 담당 ${provider.used}/${provider.capacity} 주거 필지`,
    '단독 주택 1 · 합필 주택 2필지, 빈집도 자리 유지',
    provider.service === 'water' ? '주민이 가까운 우물을 직접 이용합니다' : '범위 안 주택까지 이어진 도로가 필요합니다',
    ...(provider.workers < provider.requiredWorkers ? ['서비스 중단: 일꾼 부족'] : []),
  ];
}
