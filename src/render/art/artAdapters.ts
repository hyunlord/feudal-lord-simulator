import type { ArtEntry, ArtFrame, ArtPoint, ArtRect, LandStageEntry } from './artContract';
import type { ArtRegistry } from './artRegistry';
import { createArtImageLoader, type ArtImageEnvironment } from './artImageLoader';
import { drawCroppedWorldSprite } from '../worldSprite';
import { assetUrlForBase } from '../worldAssets';

export class ArtAdapterError extends Error {}
export type ArtPlacementInput = {
  readonly at: ArtPoint;
  /** Explicit animation time from the consumer. No wall clock or simulation facts are invented here. */
  readonly elapsedMs?: number;
  readonly grip?: ArtPoint;
  readonly body?: { readonly bodyId: string; readonly sourceRect: ArtRect; readonly targetRect: ArtRect };
};
export type ArtPlacement =
  | { readonly type: 'blit'; readonly sourceRect: ArtRect; readonly targetRect: ArtRect }
  | { readonly type: 'land-primitive'; readonly entry: LandStageEntry; readonly image: HTMLImageElement | null }
  | { readonly type: 'weather-shadow-source'; readonly entry: Extract<ArtEntry, { readonly kind: 'weather-shadow' }> }
  | { readonly type: 'texture-source'; readonly entry: Extract<ArtEntry, { readonly kind: 'ground-texture' }> }
  | { readonly type: 'image-substitution'; readonly entry: Extract<ArtEntry, { readonly kind: 'season-variant' }> }
  | { readonly type: 'ui-handoff'; readonly entry: Extract<ArtEntry, { readonly kind: 'event-illustration' | 'portrait' | 'regional-map' }> };

/** Half-open frame durations, looping only the frames actually authored in the contract. */
export function artFrameAt(frames: readonly ArtFrame[], elapsedMs: number): ArtFrame {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new ArtAdapterError('Animation elapsedMs must be finite and nonnegative');
  const total = frames.reduce((sum, frame) => sum + frame.durationMs, 0);
  if (frames.length === 0 || !(total > 0)) throw new ArtAdapterError('Validated animation frames required');
  let time = elapsedMs % total;
  for (const frame of frames) { if (time < frame.durationMs) return frame; time -= frame.durationMs; }
  const first = frames[0];
  if (first === undefined) throw new ArtAdapterError('Animation frame missing');
  return first;
}
function blit(sourceRect: ArtRect, placement: { readonly anchor: ArtPoint; readonly pivot: ArtPoint; readonly scale: number }): ArtPlacement {
  return { type: 'blit', sourceRect, targetRect: {
    x: placement.anchor.x - placement.pivot.x * placement.scale,
    y: placement.anchor.y - placement.pivot.y * placement.scale,
    width: sourceRect.width * placement.scale, height: sourceRect.height * placement.scale,
  } };
}
function unreachable(entry: never): never { throw new ArtAdapterError(`Unsupported art entry: ${String(entry)}`); }

/** Registry validation precedes construction; adapters supply geometry, never engine facts or selection rules. */
export function createArtAdapters(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  const loader = createArtImageLoader(registry, environment);
  const descriptor = (id: string): ArtEntry | null => {
    const entry = registry.entry(id);
    return entry === null ? null : { ...entry, image: { ...entry.image, url: assetUrlForBase(entry.image.url, environment?.baseUrl ?? import.meta.env?.BASE_URL ?? '/') } };
  };
  const placement = (id: string, input: ArtPlacementInput): ArtPlacement | null => {
    const entry = registry.entry(id);
    if (entry === null) return null;
    switch (entry.kind) {
      case 'weather-shadow': return { type: 'weather-shadow-source', entry };
      case 'ground-texture': return { type: 'texture-source', entry };
      case 'season-variant': return { type: 'image-substitution', entry };
      case 'event-illustration': case 'portrait': case 'regional-map':
        return { type: 'ui-handoff', entry: { ...entry, image: { ...entry.image, url: assetUrlForBase(entry.image.url, environment?.baseUrl ?? import.meta.env?.BASE_URL ?? '/') } } };
      case 'state-overlay': {
        if (input.body === undefined || !entry.targetBodyIds.includes(input.body.bodyId)) throw new ArtAdapterError('Overlay requires its declared body geometry');
        return { type: 'blit', sourceRect: input.body.sourceRect, targetRect: input.body.targetRect };
      }
      case 'walker-cargo': {
        if (input.elapsedMs === undefined) throw new ArtAdapterError('Walker frames require explicit elapsedMs');
        // Frame pivots are local anchors; attachment.pivot is canonical metadata, not an added offset.
        const frame = artFrameAt(entry.frames, input.elapsedMs);
        const anchor = entry.role === 'cargo' ? input.grip : input.at;
        if (anchor === undefined) throw new ArtAdapterError('Cargo requires a supplied walker grip');
        return blit(frame.sourceRect, { anchor, pivot: frame.pivot, scale: entry.scale });
      }
      case 'land-stage':
        if (entry.layout !== 'single') return { type: 'land-primitive', entry, image: loader.image(id) };
        return blit(entry.geometry.crop ?? { x: 0, y: 0, width: entry.image.width, height: entry.image.height },
          { anchor: input.at, pivot: { x: entry.geometry.pivot.x - (entry.geometry.crop?.x ?? 0), y: entry.geometry.pivot.y - (entry.geometry.crop?.y ?? 0) }, scale: entry.geometry.scale });
      case 'weather-particle': {
        if (input.elapsedMs === undefined) throw new ArtAdapterError('Weather frames require explicit elapsedMs');
        const frame = artFrameAt(entry.frames, input.elapsedMs);
        return blit(frame.sourceRect, { anchor: input.at, pivot: frame.pivot, scale: entry.geometry.scale });
      }
      case 'event-scene': {
        if (entry.frames !== undefined) {
          if (input.elapsedMs === undefined) throw new ArtAdapterError('Event frames require explicit elapsedMs');
          const frame = artFrameAt(entry.frames, input.elapsedMs);
          return blit(frame.sourceRect, { anchor: input.at, pivot: frame.pivot, scale: entry.geometry.scale });
        }
        return blit(entry.geometry.crop ?? { x: 0, y: 0, width: entry.image.width, height: entry.image.height },
          { anchor: input.at, pivot: { x: entry.geometry.pivot.x - (entry.geometry.crop?.x ?? 0), y: entry.geometry.pivot.y - (entry.geometry.crop?.y ?? 0) }, scale: entry.geometry.scale });
      }
      case 'building-attachment': case 'building-body': case 'ground-prop': case 'landmark':
        return blit(entry.geometry.crop ?? { x: 0, y: 0, width: entry.image.width, height: entry.image.height },
          { anchor: input.at, pivot: { x: entry.geometry.pivot.x - (entry.geometry.crop?.x ?? 0), y: entry.geometry.pivot.y - (entry.geometry.crop?.y ?? 0) }, scale: entry.geometry.scale });
      default: return unreachable(entry);
    }
  };
  const draw = (context: Parameters<typeof drawCroppedWorldSprite>[0], id: string, input: ArtPlacementInput): boolean => {
    const target = placement(id, input);
    if (target === null || target.type !== 'blit') return false;
    const image = loader.image(id);
    if (image === null) return false;
    drawCroppedWorldSprite(context, image, target.sourceRect, target.targetRect, false, true);
    return true;
  };
  return { ...loader, descriptor, placement, draw };
}
