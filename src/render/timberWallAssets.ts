import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import { assetUrlForBase } from './worldAssets';
let image: HTMLImageElement|null = null;
let pending: Promise<void>|null = null;
let status: 'idle'|'loading'|'ready'|'missing' = 'idle';
let loadError: string|null = null;
export function preloadTimberWallAssets(): Promise<void> {
  if (typeof globalThis.Image !== 'function') return Promise.resolve();
  pending ??= new Promise<void>(resolve => {
    status = 'loading';
    try {
      const candidate = new Image();
      candidate.onload = () => {
        status = registerRuntimeAsset(candidate, 'assets/buildings/historical-gate/palisade_straight_nw_se.png', 1254, 1254) ? 'ready' : 'missing';
        image = status === 'ready' ? candidate : null;
        resolve();
      };
      candidate.onerror = () => { status = 'missing'; resolve(); };
      candidate.src = assetUrlForBase('assets/buildings/historical-gate/palisade_straight_nw_se.png', import.meta.env?.BASE_URL ?? '/');
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
      status = 'missing'; resolve();
    }
  });
  return pending;
}
export function timberWallTexture(): HTMLImageElement|null { return image; }
export function timberWallAssetStatus() { return {status,loadError}; }
