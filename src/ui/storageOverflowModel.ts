import type { Building } from '../content/buildingConfig';
import { storageUsage } from '../economy/storage';
import type { CauseDetail } from './causeRegistry';
import { STORAGE_OVERFLOW_COPY } from './storageOverflowCopy.ko';

/** Overflow is derived from physical stock only, not incoming reservations. */
export function storageOverflowCause(building: Building): CauseDetail | null {
  if (building.kind !== 'storehouse' && building.kind !== 'granary') return null;
  const usage = storageUsage(building);
  const overflow = Math.max(0, usage.used - usage.capacity);
  return overflow === 0 ? null : { causeId: 'storage_overflow', requirement: 'production',
    reason: 'storage_overflow', label: STORAGE_OVERFLOW_COPY.label(overflow),
    used: usage.used, capacity: usage.capacity };
}
