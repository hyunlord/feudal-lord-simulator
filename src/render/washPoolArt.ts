import { createArtAdapters } from './art/artAdapters';
import type { ArtImageEnvironment } from './art/artImageLoader';
import { ART_REGISTRY } from './art/wave42Registry';
import type { FacilityGroundPropEntry } from './art/artContract';

export const FACILITY_GROUND_ENTRIES = ART_REGISTRY.entries('ground-prop').filter((entry): entry is FacilityGroundPropEntry => entry.kind === 'ground-prop' && entry.placement === 'facility-ground');
export const WASH_POOL_ID = 'pasture_wash_pool';
export function createWashPoolArt(environment?: ArtImageEnvironment) {
  const art = createArtAdapters(ART_REGISTRY, environment);
  const entry = ART_REGISTRY.entry(WASH_POOL_ID);
  const descriptor: FacilityGroundPropEntry | null = entry?.kind === 'ground-prop' && entry.placement === 'facility-ground' ? entry : null;
  return { ...art, readyEntry: (): FacilityGroundPropEntry | null => descriptor && art.image(descriptor.id) ? descriptor : null };
}
export const WASH_POOL_ART = createWashPoolArt();
