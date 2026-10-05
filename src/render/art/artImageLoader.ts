import type { ArtEntry } from './artContract';
import type { ArtRegistry } from './artRegistry';
import { assetUrlForBase } from '../worldAssets';

export type ArtImageStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'unavailable';
export type ArtImageState = { readonly status: ArtImageStatus; readonly reason: string | null };
export type ArtImageEnvironment = {
  readonly createImage: (() => HTMLImageElement) | null;
  readonly baseUrl: string;
};
type LoadedImage = { image: HTMLImageElement | null; state: ArtImageState;
  readonly settled: Promise<ArtImageState>; readonly resolve: (state: ArtImageState) => void };

/** Thrown values need not be Errors or even safely string-convertible. */
function errorText(error: unknown): string {
  try { return String(error); }
  catch { return 'Unprintable thrown value'; }
}


function usesOnloadReadiness(entry: ArtEntry): boolean {
  return entry.kind === 'ground-prop' && entry.placement === 'seasonal-ground';
}
function dimensionsMatch(image: HTMLImageElement, entry: ArtEntry): boolean {
  return image.naturalWidth === entry.image.width && image.naturalHeight === entry.image.height;
}
function dimensionError(image: HTMLImageElement, entry: ArtEntry): string {
  return `Decoded size ${image.naturalWidth}x${image.naturalHeight} differs from ${entry.image.width}x${entry.image.height}`;
}

/** One startup registry owns one lazy cache. No lookup validates data or starts another entry's load. */
export function createArtImageLoader(registry: ArtRegistry, environment: ArtImageEnvironment = {
  createImage: typeof Image === 'function' ? () => new Image() : null,
  baseUrl: import.meta.env?.BASE_URL ?? '/',
}) {
  const images = new Map<string, LoadedImage>();
  const listeners = new Map<string, Set<(image: HTMLImageElement) => void>>();
  const callbackErrors = new Map<string, Error[]>();
  const notified = new Map<string, Set<(image: HTMLImageElement) => void>>();
  const notify = (id: string, image: HTMLImageElement): void => {
    const sent = notified.get(id) ?? new Set<(image: HTMLImageElement) => void>();
    notified.set(id, sent);
    for (const callback of listeners.get(id) ?? []) {
      if (sent.has(callback)) continue;
      sent.add(callback);
      try { callback(image); }
      catch (error) {
        const failure = error instanceof Error ? error : new Error(`Readiness callback failed: ${errorText(error)}`);
        const errors = callbackErrors.get(id) ?? []; errors.push(failure); callbackErrors.set(id, errors);
      }
    }
  };
  const onReady = (id: string, callback: (image: HTMLImageElement) => void): void => {
    const callbacks = listeners.get(id) ?? new Set<(image: HTMLImageElement) => void>();
    callbacks.add(callback); listeners.set(id, callbacks);
    const cached = images.get(id);
    if (cached?.state.status === 'ready' && cached.image !== null) notify(id, cached.image);
  };
  const status = (id: string): ArtImageState => {
    if (registry.entry(id) === null) return { status: 'unavailable', reason: 'Unknown asset ID' };
    if (environment.createImage === null) return { status: 'unavailable', reason: 'Image API unavailable' };
    return images.get(id)?.state ?? { status: 'idle', reason: null };
  };
  const settle = (cached: LoadedImage, state: ArtImageState): void => {
    if (cached.state.status !== 'loading') return;
    cached.state = state; cached.resolve(state);
  };
  const start = (id: string): LoadedImage => {
    const cached = images.get(id);
    if (cached !== undefined) return cached;
    let resolve: (state: ArtImageState) => void = () => { throw new Error('Image settlement not initialized'); };
    const settled = new Promise<ArtImageState>(done => { resolve = done; });
    const created: LoadedImage = { image: null, state: { status: 'loading', reason: null }, settled, resolve };
    images.set(id, created);
    const entry = registry.entry(id);
    if (entry === null || environment.createImage === null) {
      settle(created, { status: 'unavailable', reason: entry === null ? 'Unknown asset ID' : 'Image API unavailable' });
      return created;
    }
    try {
      const element = environment.createImage(); created.image = element;
      element.onload = () => {
        if (created.state.status !== 'loading') return;
        if (usesOnloadReadiness(entry)) {
          const matches = dimensionsMatch(element, entry);
          settle(created, matches ? { status: 'ready', reason: null } : { status: 'missing', reason: dimensionError(element, entry) });
          if (matches) notify(id, element);
          return;
        }
        try {
          void element.decode().then(() => {
            if (created.state.status !== 'loading') return;
            const matches = dimensionsMatch(element, entry);
            settle(created, matches ? { status: 'ready', reason: null } : { status: 'missing', reason: dimensionError(element, entry) });
            if (matches) notify(id, element);
          }, error => { settle(created, { status: 'missing', reason: `Image decode failed: ${errorText(error)}` }); });
        } catch (error) { settle(created, { status: 'missing', reason: `Image decode failed: ${errorText(error)}` }); }
      };
      element.onerror = () => { settle(created, { status: 'missing', reason: 'Image request failed' }); };
      element.src = assetUrlForBase(entry.image.url, environment.baseUrl);
    } catch (error) { settle(created, { status: 'missing', reason: `Image request setup failed: ${errorText(error)}` }); }
    return created;
  };
  const image = (id: string): HTMLImageElement | null => {
    const cached = start(id);
    return cached.state.status === 'ready' ? cached.image : null;
  };
  const loadSettled = (id: string): Promise<ArtImageState> => start(id).settled;
  return { image, status, onReady, loadSettled, readinessErrors: (id: string): readonly Error[] => [...(callbackErrors.get(id) ?? [])] };
}
