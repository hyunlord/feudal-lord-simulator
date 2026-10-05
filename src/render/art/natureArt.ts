import type { NatureGroundEntry, WeatherParticleEntry } from './artContract';
import type { ArtRegistry } from './artRegistry';
import { createArtImageLoader, type ArtImageEnvironment } from './artImageLoader';
import { artFrameAt } from './artAdapters';
import { ART_REGISTRY } from './wave42Registry';
import { drawCroppedWorldSprite } from '../worldSprite';

export type NatureEntry = NatureGroundEntry | WeatherParticleEntry;
export type ReadyNature = { readonly entry: NatureEntry; readonly image: HTMLImageElement };
export function createNatureArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  const entries = registry.entries().filter((entry): entry is NatureEntry => entry.kind === 'weather-particle' || (entry.kind === 'ground-prop' && entry.placement === 'nature-ground'));
  let loaded: ReturnType<typeof createArtImageLoader> | undefined;
  const loader = () => loaded ??= createArtImageLoader(registry, environment);
  /** Resolve every member once; a family never changes half way through a frame. */
  const resolve = (role: NatureEntry['role']): readonly ReadyNature[] | null => {
    const family = entries.filter(entry => entry.role === role);
    if (family.length === 0) return null;
    const ready: ReadyNature[] = [];
    for (const entry of family) {
      const image = loader().image(entry.id);
      if (image !== null) ready.push({ entry, image });
    }
    return ready.length === family.length ? ready : null;
  };
  const select = (ready: readonly ReadyNature[], role: NatureEntry['role'], group: string, seed: number): ReadyNature | null => {
    const kind = ready[0]?.entry.kind;
    if (kind === undefined) return null;
    const entry = registry.select(kind, `nature-${role}`, { role, group }, seed);
    return ready.find(item => item.entry.id === entry?.id) ?? null;
  };
  const draw = (context: CanvasRenderingContext2D, ready: ReadyNature, x: number, y: number, zoom: number, opacity = 1, seconds = 0): boolean => {
    const { entry, image } = ready;
    if (zoom < entry.minZoom) return false;
    const frame = entry.kind === 'weather-particle' ? artFrameAt(entry.frames, seconds * 1000) : undefined;
    const crop = frame?.sourceRect ?? { x: 0, y: 0, width: entry.image.width, height: entry.image.height };
    const pivot = frame?.pivot ?? entry.geometry.pivot;
    const scale = entry.geometry.scale;
    context.save();
    try {
      context.globalAlpha *= entry.opacity * opacity;
      drawCroppedWorldSprite(context, image, crop, { x: x - pivot.x * scale, y: y - pivot.y * scale, width: crop.width * scale, height: crop.height * scale }, false, false);
    } finally { context.restore(); }
    return true;
  };
  return { resolve, select, draw };
}
export const NATURE_ART = createNatureArt(ART_REGISTRY);
