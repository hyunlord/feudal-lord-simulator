import type { ArtRegistry } from './artRegistry';
import { assetUrlForBase } from '../worldAssets';

export type ArtImageStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'unavailable';
export type ArtImageState = { readonly status: ArtImageStatus; readonly reason: string | null };
export type ArtImageEnvironment = {
  readonly createImage: (() => HTMLImageElement) | null;
  readonly baseUrl: string;
};
type LoadedImage = { readonly image: HTMLImageElement; state: ArtImageState };

/** Thrown callback values can themselves fail string conversion. */
function readinessErrorText(error: unknown): string {
  try { return String(error); }
  catch { return 'Unprintable thrown value'; }
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
        const failure = error instanceof Error ? error : new Error(`Readiness callback failed: ${readinessErrorText(error)}`);
        const errors = callbackErrors.get(id) ?? []; errors.push(failure); callbackErrors.set(id, errors);
      }
    }
  };
  const onReady = (id: string, callback: (image: HTMLImageElement) => void): void => {
    const callbacks = listeners.get(id) ?? new Set<(image: HTMLImageElement) => void>();
    callbacks.add(callback); listeners.set(id, callbacks);
    const cached = images.get(id);
    if (cached?.state.status === 'ready') notify(id, cached.image);
  };
  const status = (id: string): ArtImageState => {
    if (registry.entry(id) === null) return { status: 'unavailable', reason: 'Unknown asset ID' };
    if (environment.createImage === null) return { status: 'unavailable', reason: 'Image API unavailable' };
    return images.get(id)?.state ?? { status: 'idle', reason: null };
  };
  const image = (id: string): HTMLImageElement | null => {
    const entry = registry.entry(id);
    if (entry === null || environment.createImage === null) return null;
    let cached = images.get(id);
    if (cached === undefined) {
      const element = environment.createImage();
      const created: LoadedImage = { image: element, state: { status: 'loading', reason: null } };
      images.set(id, created);
      element.onload = () => {
        void element.decode().then(() => {
          if (created.state.status !== 'loading') return;
          created.state = element.naturalWidth === entry.image.width && element.naturalHeight === entry.image.height
            ? { status: 'ready', reason: null }
            : { status: 'missing', reason: `Decoded size ${element.naturalWidth}x${element.naturalHeight} differs from ${entry.image.width}x${entry.image.height}` };
          if (created.state.status === 'ready') notify(id, element);
        }, error => { created.state = { status: 'missing', reason: `Image decode failed: ${String(error)}` }; });
      };
      element.onerror = () => { created.state = { status: 'missing', reason: 'Image request failed' }; };
      element.src = assetUrlForBase(entry.image.url, environment.baseUrl);
      cached = created;
    }
    return cached.state.status === 'ready' ? cached.image : null;
  };
  return { image, status, onReady, readinessErrors: (id: string): readonly Error[] => [...(callbackErrors.get(id) ?? [])] };
}
