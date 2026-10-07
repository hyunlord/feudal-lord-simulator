import { createArtAdapters } from './art/artAdapters';
import type { ArtImageEnvironment } from './art/artImageLoader';
import type { ArtRegistry } from './art/artRegistry';
import { ART_REGISTRY } from './art/wave42Registry';
import { walkerTransportPlacement, type TransportPlacement } from './art/walkerTransportPlacement';
import type { WalkerPresentation } from './walkerPresentation';
import { drawCroppedWorldSprite } from './worldSprite';

export function createTransportArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  const adapters = createArtAdapters(registry, environment);
  const select = (presentation: Pick<WalkerPresentation, 'direction'>) => {
    const entry = registry.select('walker-transport', 'walker-handcart', { group: 'handcart', facing: presentation.direction.toLowerCase() }, 0);
    return entry?.kind === 'walker-transport' ? entry : null;
  };
  const draw = (context: Parameters<typeof drawCroppedWorldSprite>[0], presentation: Pick<WalkerPresentation, 'direction' | 'gaitFrame'>,
    footX: number, footY: number, scale: number): TransportPlacement | null => {
    const entry = select(presentation);
    if (entry === null) return null;
    const image = adapters.image(entry.id);
    if (image === null) return null;
    const placed = walkerTransportPlacement(entry, { x: footX, y: footY }, presentation.gaitFrame, 32 * scale);
    drawCroppedWorldSprite(context, image, placed.sourceRect, placed.targetRect, false, true);
    return placed;
  };
  return { draw, select, adapters };
}
export const TRANSPORT_ART = createTransportArt(ART_REGISTRY);
