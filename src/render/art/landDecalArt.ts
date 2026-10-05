import type { LandGroundPropEntry } from './artContract';
import type { ArtRegistry } from './artRegistry';
import type { ArtImageEnvironment } from './artImageLoader';
import { createArtAdapters } from './artAdapters';
import { LAND_SEASONS } from './landDecalValidation';
import { ART_REGISTRY } from './wave42Registry';
import type { SeasonIndex } from '../seasonArt';

/** Registry construction validates the complete finite land domain before this lazy loader can exist. */
export function createLandDecalArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  const entries = registry.entries('ground-prop').filter((entry): entry is LandGroundPropEntry => entry.kind === 'ground-prop' && entry.placement === 'land');
  let adapters: ReturnType<typeof createArtAdapters> | undefined;
  const loader = () => adapters ??= createArtAdapters(registry, environment);
  const context = (archetype: string, baseId: string, season: SeasonIndex) => ({ archetype, baseId, placement: 'land', season: LAND_SEASONS[season] });
  const base = (archetype: string, baseId: string, season: SeasonIndex) => registry.select('ground-prop', 'land-decal-base', context(archetype, baseId, season), 0);
  const ids = (archetype: string, baseId: string, season: SeasonIndex): readonly string[] => entries.filter(e => e.baseId === baseId && e.archetypes.includes(archetype) && (e.season === undefined || e.season === LAND_SEASONS[season])).map(e => e.id).sort();
  const selection = (archetype: string, baseId: string, season: SeasonIndex, seed: number) => {
    const fallback = base(archetype, baseId, season);
    if (fallback === null) return null;
    return { baseId: fallback.id, selectedId: registry.select('ground-prop', 'land-decal-variant', context(archetype, baseId, season), seed)?.id ?? fallback.id };
  };
  return {
    ids, selection, owns: (archetype: string, baseId: string, season: SeasonIndex) => base(archetype, baseId, season) !== null,
    image: (id: string) => loader().image(id),
    draw: (canvas: CanvasRenderingContext2D, archetype: string, baseId: string, season: SeasonIndex, seed: number, x: number, y: number): boolean => {
      const chosen = selection(archetype, baseId, season, seed);
      if (chosen === null) return false;
      const art = loader();
      const id = art.image(chosen.selectedId) === null ? chosen.baseId : chosen.selectedId;
      return art.draw(canvas, id, { at: { x, y } });
    },
  };
}
export const LAND_DECAL_ART = createLandDecalArt(ART_REGISTRY);
