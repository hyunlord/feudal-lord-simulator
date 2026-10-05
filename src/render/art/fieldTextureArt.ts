import type { ArtSeason, FieldGroundTextureEntry } from './artContract';
import { isFieldTexture } from './artContract';
import type { ArtRegistry } from './artRegistry';
import { createArtImageLoader, type ArtImageEnvironment } from './artImageLoader';
import { joinStripImages } from '../stripJoin';
import { FIELD_TEXTURE_STATES } from './fieldTextureValidation';

export type FieldTextureRequest = { readonly fieldState: string; readonly season: ArtSeason };
export type FieldTexturePair = readonly [FieldGroundTextureEntry, FieldGroundTextureEntry];
export type FieldTextureSelection = { readonly base: FieldTexturePair; readonly seasonal: FieldTexturePair | null };
export type PreparedFieldTexture = {
  readonly image: CanvasImageSource; readonly sourceIds: readonly [string, string];
  readonly mapping: FieldGroundTextureEntry['mapping']; readonly composition: FieldGroundTextureEntry['composition'];
  readonly token: string;
};
/** Read-only frame snapshot: neither token nor draw access starts loading or retries composition. */
export type FieldTextureSnapshot = { readonly get: (request: FieldTextureRequest) => PreparedFieldTexture | null };
export type FieldTextureJoin = (images: readonly [HTMLImageElement, HTMLImageElement], entry: FieldGroundTextureEntry, onFailure: (reason: string) => void) => CanvasImageSource | null;
const strictJoin: FieldTextureJoin = (images, entry, onFailure) => joinStripImages(images, entry.image.width, entry.image.height, entry.composition.joinFadeSourcePx, { mode: 'strict', onFailure });
const requestKey = (request: FieldTextureRequest): string => JSON.stringify([request.fieldState, request.season]);
export function fieldTextureToken(snapshot: FieldTextureSnapshot, request: FieldTextureRequest): string {
  return snapshot.get(request)?.token ?? '';
}
/** One factory owns one loader and successful-pair cache; production must retain this instance. */
export function createFieldTextureArt(registry: ArtRegistry, environment?: ArtImageEnvironment, join: FieldTextureJoin = strictJoin, loader = createArtImageLoader(registry, environment)) {
  // Registry is immutable for this factory lifetime: ordered IDs determine pixels; mapping/join/wash determine use.
  // State/season are omitted once selection resolves to that same output. Runtime memory/performance is not yet measured.
  const cache = new Map<string, PreparedFieldTexture>();
  // Keep the latest diagnostic per finite selected pair; repeated failures must not accumulate per frame.
  const failures = new Map<string, string>();
  const pair = (role: 'base' | 'season', request: FieldTextureRequest): FieldTexturePair | null => {
    const a = registry.select('ground-texture', `field-ridge-${role}-a`, request, 0);
    const b = registry.select('ground-texture', `field-ridge-${role}-b`, request, 0);
    return a !== null && b !== null && isFieldTexture(a) && isFieldTexture(b) ? Object.freeze([a, b]) : null;
  };
  const resolve = (request: FieldTextureRequest): FieldTextureSelection | null => {
    if (!FIELD_TEXTURE_STATES.some(state => state === request.fieldState)) return null;
    const base = pair('base', request);
    return base === null ? null : Object.freeze({ base, seasonal: pair('season', request) });
  };
  const preparePair = (sources: FieldTexturePair, attempts: Map<string, PreparedFieldTexture | null>): PreparedFieldTexture | null => {
    const [a, b] = sources;
    const token = JSON.stringify([a.id, b.id, a.mapping.repeat, a.mapping.sourcePixelsPerTile, a.mapping.origin.x, a.mapping.origin.y, a.composition.joinFadeSourcePx, a.composition.wash]);
    const cached = cache.get(token); if (cached !== undefined) return cached;
    if (attempts.has(token)) return attempts.get(token) ?? null;
    attempts.set(token, null);
    const imageA = loader.image(a.id); const imageB = loader.image(b.id);
    if (imageA === null || imageB === null) return null;
    const image = join([imageA, imageB], a, reason => { failures.set(token, reason); });
    if (image === null) return null;
    const ready: PreparedFieldTexture = Object.freeze({ image, sourceIds: Object.freeze([a.id, b.id] as const), mapping: a.mapping, composition: a.composition, token });
    cache.set(token, ready); attempts.set(token, ready); return ready;
  };
  const prepare = (requests: readonly FieldTextureRequest[]): FieldTextureSnapshot => {
    const rows = new Map<string, PreparedFieldTexture | null>();
    const attempts = new Map<string, PreparedFieldTexture | null>();
    for (const request of requests) {
      const key = requestKey(request); if (rows.has(key)) continue;
      const selected = resolve(request);
      const seasonal = selected?.seasonal === null || selected === null ? null : preparePair(selected.seasonal, attempts);
      rows.set(key, seasonal ?? (selected === null ? null : preparePair(selected.base, attempts)));
    }
    return Object.freeze({ get: (request: FieldTextureRequest) => rows.get(requestKey(request)) ?? null });
  };
  return { ...loader, resolve, prepare, compositionFailures: () => [...failures].map(([token, reason]) => ({ token, reason })) };
}
