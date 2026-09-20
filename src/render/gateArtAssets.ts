import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import { assetUrlForBase } from './worldAssets';
import type { StoneWallAxis } from './stoneWallGeometry';
export const GATE_PARTS = ['stone_arch', 'timber_frame', 'doors_open', 'doors_closed'] as const;
export type GatePart = typeof GATE_PARTS[number];
type Asset = { readonly part: GatePart; readonly axis: StoneWallAxis; readonly url: string; status: 'idle'|'loading'|'ready'|'missing'; image: HTMLImageElement|null; loadError: string|null };
const assets: Asset[] = GATE_PARTS.flatMap(part => (['descending','ascending'] as const).map(axis => ({
  part, axis, url: assetUrlForBase(`assets/buildings/historical-gate/gate_part_${part}_${axis === 'descending' ? 'nw_se' : 'ne_sw'}-v1.png`, import.meta.env?.BASE_URL ?? '/'), status:'idle', image:null, loadError:null,
})));
let pending: Promise<void>|null = null;
export function preloadGateAssets(): Promise<void> {
  if (typeof globalThis.Image !== 'function') return Promise.resolve();
  pending ??= Promise.all(assets.map(asset => new Promise<void>(resolve => {
    asset.status = 'loading';
    try {
      const image = new Image();
      image.onload = () => {
        asset.status = registerRuntimeAsset(image, asset.url, 1254, 1254) ? 'ready' : 'missing';
        asset.image = asset.status === 'ready' ? image : null;
        resolve();
      };
      image.onerror = () => { asset.status = 'missing'; resolve(); };
      image.src = asset.url;
    } catch (error) {
      asset.loadError = error instanceof Error ? error.message : String(error);
      asset.status = 'missing'; resolve();
    }
  }))).then(() => undefined);
  return pending;
}
export function gateArtImage(part: GatePart, axis: StoneWallAxis): HTMLImageElement|null {
  return assets.find(asset => asset.part === part && asset.axis === axis)?.image ?? null;
}
export function gateAssetStatuses() { return assets.map(({part,axis,url,status,loadError}) => ({part,axis,url,status,loadError})); }
