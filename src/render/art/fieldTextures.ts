import { ART_REGISTRY } from './wave42Registry';
import { createFieldTextureArt, type FieldTextureRequest } from './fieldTextureArt';
import type { ArtImageState } from './artImageLoader';
import type { ZoneAssetKey } from '../zoneAssetManifest';

/** Only the four migrated legacy keys need aliases. Future field sources are enumerated from the catalog. */
const LEGACY_IDS: Partial<Record<ZoneAssetKey, string>> = {
  ridge_ploughed_a: 'ridge_ploughed_a', ridge_ploughed_b: 'ridge_ploughed_b',
  ridge_seedling_a: 'ridge_seedling_a', ridge_seedling_b: 'ridge_seedling_b',
};
export const legacyFieldTextureId = (key: ZoneAssetKey): string | null => LEGACY_IDS[key] ?? null;
export const FIELD_TEXTURE_IDS = ART_REGISTRY.entries('ground-texture').map(entry => entry.id);
const production = createFieldTextureArt(ART_REGISTRY);
let testFacade: ReturnType<typeof createFieldTextureArt> | null = null;
export const fieldTextures = (): ReturnType<typeof createFieldTextureArt> => testFacade ?? production;
export const fieldTextureRequest = (fieldState: string, season: 0 | 1 | 2 | 3): FieldTextureRequest => ({
  fieldState, season: (['spring', 'summer', 'autumn', 'winter'] as const)[season],
});

/** Isolated test replacement; null always restores the sole production owner. Never used by runtime reload. */
export function setFieldTexturesForTest(facade: ReturnType<typeof createFieldTextureArt> | null): void {
  testFacade = facade;
  testImages.clear();
}
const testImages = new Map<string, HTMLImageElement | null>();
/** Preserve synchronous C25 image stand-ins through the same facade consumed by zone reads and field preparation. */
export function setFieldTextureImagesForTest(images: ReadonlyMap<string, HTMLImageElement | null>): void {
  for (const [id, image] of images) testImages.set(id, image);
  const image = (id: string): HTMLImageElement | null => testImages.has(id) ? testImages.get(id) ?? null : production.image(id);
  const status = (id: string): ArtImageState => testImages.has(id)
    ? { status: testImages.get(id) === null ? 'idle' : 'ready', reason: null } : production.status(id);
  const loader = { image, status, loadSettled: (id: string) => testImages.has(id) ? Promise.resolve(status(id)) : production.loadSettled(id),
    onReady: (id: string, callback: (image: HTMLImageElement) => void) => {
      if (!testImages.has(id)) { production.onReady(id, callback); return; }
      const ready = image(id); if (ready !== null) callback(ready);
    }, readinessErrors: production.readinessErrors };
  // Node's historical C25 call-stream proof uses image A, not pixels; production always uses strict joining.
  testFacade = createFieldTextureArt(ART_REGISTRY, undefined, typeof document === 'undefined' ? pair => pair[0] : undefined, loader);
}
