import { MONEY_RULE_COPY } from '../content/moneyCopy.ko';
import { SERVICE_DIAGNOSIS_COPY } from './serviceDiagnosisCopy.ko';
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
const NAMES = SERVICE_DIAGNOSIS_COPY.names;

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
  const usage = capacity === undefined ? '' : SERVICE_DIAGNOSIS_COPY.usage(capacity.used, capacity.capacity);
  let label: string;
  switch (kind) {
    case 'served': label = service === 'water' ? SERVICE_DIAGNOSIS_COPY.wellServed(distance) : SERVICE_DIAGNOSIS_COPY.served(name, distance, serviceRadius, usage); break;
    case 'missing': label = service === 'water' ? SERVICE_DIAGNOSIS_COPY.noWell : SERVICE_DIAGNOSIS_COPY.missing(name); break;
    case 'outside': label = service === 'water' ? SERVICE_DIAGNOSIS_COPY.wellTooFar(distance, serviceRadius) : SERVICE_DIAGNOSIS_COPY.tooFar(name, service === 'church', distance, serviceRadius); break;
    case 'paused': label = SERVICE_DIAGNOSIS_COPY.paused; break;
    case 'understaffed': label = SERVICE_DIAGNOSIS_COPY.understaffed(name); break;
    case 'unreachable': label = SERVICE_DIAGNOSIS_COPY.unreachable(name); break;
    case 'capacity': label = SERVICE_DIAGNOSIS_COPY.capacity(name, access?.earlierHomesUsingCapacity ?? 0); break;
  }
  return { kind, label, distance, serviceRadius };
}

export function providerServiceRows(state: GameState, building: Building): readonly string[] {
  if (building.kind !== 'well' && building.kind !== 'market' && building.kind !== 'church') return [];
  const provider = householdServices(state).providers.get(building.id);
  if (provider === undefined) return [];
  return [
    SERVICE_DIAGNOSIS_COPY.providerLoad(provider.used, provider.capacity),
    SERVICE_DIAGNOSIS_COPY.providerLotRule,
    provider.service === 'water' ? SERVICE_DIAGNOSIS_COPY.wellDirect : SERVICE_DIAGNOSIS_COPY.roadNeeded,
    ...(building.upkeepUnpaid === true ? [MONEY_RULE_COPY.serviceUnpaid] : building.operationPaused === true ? [SERVICE_DIAGNOSIS_COPY.paused]
      : provider.workers < provider.requiredWorkers ? [SERVICE_DIAGNOSIS_COPY.noWorkers] : []),
  ];
}
