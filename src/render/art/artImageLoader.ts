import type { ArtRegistry } from './artRegistry';
import { assetUrlForBase } from '../worldAssets';

export type ArtImageStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'unavailable';
export type ArtImageState = { readonly status: ArtImageStatus; readonly reason: string | null };
export type ArtImageEnvironment = {
  readonly createImage: (() => HTMLImageElement) | null;
  readonly baseUrl: string;
};
type LoadedImage = { readonly image: HTMLImageElement; state: ArtImageState };

/** One startup registry owns one lazy cache. No lookup validates data or starts another entry's load. */
export function createArtImageLoader(registry: ArtRegistry, environment: ArtImageEnvironment = {
  createImage: typeof Image === 'function' ? () => new Image() : null,
  baseUrl: import.meta.env?.BASE_URL ?? '/',
}) {
  const images = new Map<string, LoadedImage>();
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
        }, error => { created.state = { status: 'missing', reason: `Image decode failed: ${String(error)}` }; });
      };
      element.onerror = () => { created.state = { status: 'missing', reason: 'Image request failed' }; };
      element.src = assetUrlForBase(entry.image.url, environment.baseUrl);
      cached = created;
    }
    return cached.state.status === 'ready' ? cached.image : null;
  };
  return { image, status };
}
