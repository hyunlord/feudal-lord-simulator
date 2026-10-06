import type { SpringWorldEntry, SpringWorldRole } from './artContract';
import type { ArtRegistry } from './artRegistry';
import type { ArtImageEnvironment } from './artImageLoader';
import { createArtImageLoader } from './artImageLoader';
import { drawCroppedWorldSprite } from '../worldSprite';
import { ART_REGISTRY } from './wave42Registry';
import { isSpringWorldEntry, springWorldSlot } from './springWorldValidation';

export function createSpringWorldArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  let loaded: ReturnType<typeof createArtImageLoader> | undefined;
  const loader = () => loaded ??= createArtImageLoader(registry, environment);
  const entries = registry.entries('ground-prop').filter(isSpringWorldEntry);
  const entry = (id: string): SpringWorldEntry | null => {
    const found = registry.entry(id); return isSpringWorldEntry(found) ? found : null;
  };
  const resolve = (role: SpringWorldRole, group = 'all'): readonly SpringWorldEntry[] | null => {
    const family = entries.filter(meta => meta.role === role && meta.group === group);
    if (family.length === 0) return null;
    // Start all members even when an earlier member is still loading.
    const ready = family.map(meta => loader().image(meta.id) !== null);
    return ready.every(Boolean) ? family : null;
  };
  const select = (role: SpringWorldRole, seed: number, group = 'all'): SpringWorldEntry | null => {
    if (resolve(role, group) === null) return null;
    const selected = registry.select('ground-prop', springWorldSlot(role), { placement: 'spring-context', season: 'spring', role, group }, seed);
    return isSpringWorldEntry(selected) ? selected : null;
  };
  const draw = (context: CanvasRenderingContext2D, id: string, x: number, y: number, zoom = 1, scaleMultiplier = 1): boolean => {
    const meta = entry(id);
    if (!meta || ![x, y, zoom, scaleMultiplier].every(Number.isFinite) || zoom < meta.minZoom || scaleMultiplier <= 0 || resolve(meta.role, meta.group) === null) return false;
    const image = loader().image(id); if (!image) return false;
    const scale = meta.geometry.scale * scaleMultiplier;
    const alpha = context.globalAlpha;
    context.globalAlpha = alpha * meta.opacity;
    try {
      drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: meta.image.width, height: meta.image.height }, { x: x - meta.geometry.pivot.x * scale, y: y - meta.geometry.pivot.y * scale, width: meta.image.width * scale, height: meta.image.height * scale }, false, true);
    } finally { context.globalAlpha = alpha; }
    return true;
  };
  return { entry, resolve, select, draw,
    image: (id: string): HTMLImageElement | null => entry(id) === null ? null : loader().image(id),
    preload: (): void => { for (const meta of entries) loader().image(meta.id); },
    status: (id: string) => loader().status(id),
    loadSettled: (id: string) => loader().loadSettled(id),
    onReady: (id: string, callback: (image: HTMLImageElement) => void): void => { if (entry(id)) loader().onReady(id, callback); },
  };
}
export const SPRING_WORLD_ART = createSpringWorldArt(ART_REGISTRY);
