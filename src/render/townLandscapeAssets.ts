import { townLandscapeManifest } from "./townLandscapeManifest.generated";
import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import { tileToScreen } from "./iso";
import { townLandscapeAt, type TownLandscapeKind } from "./townLandscape";
import { assetUrlForBase } from "./worldAssets";
import { drawCroppedWorldSprite } from "./worldSprite";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";

type LandscapeAsset = { readonly meta: typeof townLandscapeManifest[number]; image: HTMLImageElement | null; raster: RasterizedWorldSprite | null };
const assets: LandscapeAsset[] = townLandscapeManifest.map(meta => ({ meta, image: null, raster: null }));
let loading: Promise<void> | null = null;

export function preloadTownLandscapeAssets(): Promise<void> {
  if (typeof globalThis.Image !== "function") return Promise.resolve();
  loading ??= Promise.all(assets.map(asset => new Promise<void>(resolve => {
    const image = new Image();
    image.onload = () => {
      asset.image = image;
      try {
        asset.raster = rasterizeWorldSprite(image, { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }, Math.ceil(asset.meta.displayWidth * asset.meta.height / asset.meta.width * 2));
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        asset.raster = null;
      } finally { resolve(); }
    };
    image.onerror = () => resolve();
    image.src = assetUrlForBase(asset.meta.url.replace(/^\//, ""), import.meta.env?.BASE_URL ?? "/");
  }))).then(() => undefined);
  return loading;
}

/** The landscape sprite with its display size and ground anchor (zone orchards reuse the orchard tree, C1b). */
export function townLandscapeSprite(kind: TownLandscapeKind): { image: CanvasImageSource; source: { x: number; y: number; width: number; height: number };
  width: number; height: number; displayWidth: number; anchorY: number } | null {
  const asset = assets.find(candidate => candidate.meta.id === kind);
  if (asset === undefined || asset.image === null) return null;
  return { image: asset.raster?.image ?? asset.image, source: asset.raster?.source ?? { x: 0, y: 0, width: asset.image.naturalWidth, height: asset.image.naturalHeight },
    width: asset.meta.width, height: asset.meta.height, displayWidth: asset.meta.displayWidth, anchorY: asset.meta.groundAnchor.y };
}

export function townLandscapeAssetReady(kind: TownLandscapeKind): boolean {
  return assets.some(asset => asset.meta.id === kind && asset.image !== null);
}

export function drawTownLandscape(context: CanvasRenderingContext2D, state: GameState, tiles: readonly Tile[]): void {
  if (!assets.some(asset => asset.image !== null)) return;
  for (const tile of tiles) {
    const kind = townLandscapeAt(state, tile);
    const asset = assets.find(candidate => candidate.meta.id === kind);
    if (asset?.image === null || asset === undefined) continue;

    const source = asset.raster?.source ?? { x: 0, y: 0, width: asset.image.naturalWidth, height: asset.image.naturalHeight };
    drawCroppedWorldSprite(context, asset.raster?.image ?? asset.image, source, townLandscapeRect(asset.meta, tile), false, true);
  }
}

export function townLandscapeRect(meta: typeof townLandscapeManifest[number], tile: Pick<Tile, "tx" | "ty">) {
  const position = tileToScreen(tile.tx, tile.ty);
  const width = meta.displayWidth, height = width * meta.height / meta.width;
  return { x: position.sx - width * meta.groundAnchor.x, y: position.sy - height * meta.groundAnchor.y, width, height };
}
