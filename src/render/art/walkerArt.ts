import type { WalkerArtDirection, WalkerBodyEntry, WalkerHeldPropEntry } from './artContract';
import { ArtAdapterError } from './artAdapters';
import type { ArtRegistry } from './artRegistry';

export function createWalkerArt(registry: ArtRegistry) {
  const body = (id: string): WalkerBodyEntry | null => {
    const candidate = registry.entry(id);
    if (candidate?.kind !== 'walker-body') return null;
    const entry = registry.select('walker-body', 'walker-body', {
      bodyId: id, classBand: candidate.registration.classBand, sex: candidate.registration.sex,
    }, 0);
    return entry?.kind === 'walker-body' ? entry : null;
  };
  const prop = (propId: string, direction: WalkerArtDirection): WalkerHeldPropEntry | null => {
    const entry = registry.select('walker-held-prop', 'walker-held-prop', { propId, facing: direction }, 0);
    return entry?.kind === 'walker-held-prop' ? entry : null;
  };
  const bodies = registry.entries('walker-body').map(entry => {
    const selected = body(entry.id);
    if (selected === null) throw new ArtAdapterError(`No walker-body selection for ${entry.id}`);
    return selected;
  });
  const props = registry.entries('walker-held-prop').map(entry => {
    if (entry.kind !== 'walker-held-prop') throw new ArtAdapterError('Invalid walker-held-prop registry kind');
    const selected = prop(entry.propId, entry.direction);
    if (selected === null) throw new ArtAdapterError(`No walker-held-prop selection for ${entry.propId}:${entry.direction}`);
    return selected;
  });
  return { body, prop, bodies, props };
}
