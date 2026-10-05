import catalog from './catalog.json';
import type { LandStageEntry } from './artContract';
import { createArtRegistry, ArtRegistryError, type ArtContext, type ArtRegistry } from './artRegistry';

/** One startup snapshot; adding a bundle changes catalog data, not imports or renderer code. */
export const ART_REGISTRY = createArtRegistry(catalog);

export function selectLandArt(slot: string, context: ArtContext, seed = 0, registry: ArtRegistry = ART_REGISTRY): LandStageEntry {
  const entry = registry.select('land-stage', slot, context, seed);
  if (entry === null || entry.kind !== 'land-stage') throw new ArtRegistryError([{ path: '$/selection', message: `No land art for ${slot}: ${JSON.stringify(context)}` }]);
  return entry;
}
