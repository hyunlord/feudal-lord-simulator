import { MONEY_RULE_COPY } from '../content/moneyCopy.ko';
import { SERVICE_DIAGNOSIS_COPY } from './serviceDiagnosisCopy.ko';
import type { Building } from '../content/buildingConfig';
import type { GameState } from '../engine/engine.types';
import { householdServices } from '../engine/householdServices';
import { serviceMeasure } from '../engine/serviceMeasure';
import type { HouseholdService, ServiceAccessKind } from '../population/serviceAllocation';

export type ServiceDiagnosis = Readonly<{
  kind: ServiceAccessKind;
  label: string;
  /** In the ruler the service's rule uses (QA-033): road steps for a market, tiles for the well and the church. */
  distance: number;
  serviceRadius: number;
  /** "길 12걸음 / 최대 40걸음" or "거리 3칸 / 범위 8칸" (SERVICE_DIAGNOSIS_COPY.measure). */
  measure: string;
}>;
const NAMES = SERVICE_DIAGNOSIS_COPY.names;

export function serviceDiagnosis(state: GameState, home: Building, service: HouseholdService): ServiceDiagnosis {
  const allocation = householdServices(state);
  const access = allocation.houses.get(home.id)?.[service];
  // QA-033: the engine's own ruler for this service (the serving provider, else the nearest by that ruler).
  const ruler = serviceMeasure(state, home, service);
  const distance = ruler.distance ?? Infinity;
  const serviceRadius = ruler.limit;
  const measure = SERVICE_DIAGNOSIS_COPY.measure(ruler.measure, ruler.distance, ruler.limit);
  const kind = access?.kind ?? 'missing';
  const name = NAMES[service];
  const provider = state.buildings.find(building => building.id === access?.providerId);
  const capacity = provider === undefined ? undefined : allocation.providers.get(provider.id);
  const usage = capacity === undefined ? '' : SERVICE_DIAGNOSIS_COPY.usage(capacity.used, capacity.capacity);
  let label: string;
  switch (kind) {
    case 'served': label = service === 'water' ? SERVICE_DIAGNOSIS_COPY.wellServed(distance) : SERVICE_DIAGNOSIS_COPY.served(name, measure, usage); break;
    case 'missing': label = service === 'water' ? SERVICE_DIAGNOSIS_COPY.noWell : SERVICE_DIAGNOSIS_COPY.missing(name); break;
    case 'outside': label = service === 'water' ? SERVICE_DIAGNOSIS_COPY.wellTooFar(measure) : SERVICE_DIAGNOSIS_COPY.tooFar(name, service === 'church', measure); break;
    case 'paused': label = SERVICE_DIAGNOSIS_COPY.paused; break;
    case 'understaffed': label = SERVICE_DIAGNOSIS_COPY.understaffed(name); break;
    case 'unreachable': label = SERVICE_DIAGNOSIS_COPY.unreachable(name); break;
    case 'capacity': label = SERVICE_DIAGNOSIS_COPY.capacity(name, access?.earlierHomesUsingCapacity ?? 0); break;
  }
  return { kind, label, distance, serviceRadius, measure };
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
