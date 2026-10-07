import { createArtAdapters } from './art/artAdapters';
import type { EventSceneEntry } from './art/artContract';
import type { ArtImageEnvironment } from './art/artImageLoader';
import { ART_REGISTRY } from './art/wave42Registry';

export const MUSTER_FIELD_ID = 'world-events/muster-field';
export function createMusterFieldArt(environment?: ArtImageEnvironment) {
  const art = createArtAdapters(ART_REGISTRY, environment);
  const candidate = ART_REGISTRY.entry(MUSTER_FIELD_ID);
  const entry: EventSceneEntry | null = candidate?.kind === 'event-scene' && candidate.duration.mode === 'while-active' ? candidate : null;
  return { ...art, entry, readyEntry: (): EventSceneEntry | null => entry && art.image(entry.id) ? entry : null };
}
export const MUSTER_FIELD_ART = createMusterFieldArt();
