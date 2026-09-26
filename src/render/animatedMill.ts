import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import { drawCroppedWorldSprite } from "./worldSprite";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { tileToScreen, TILE_H } from './iso';
import { assetUrlForBase } from './worldAssets';

export const millRegistration = {
  body: { url: 'assets/buildings/runtime-mill-v1/mill_body-v1.png', width: 1254, height: 1254 },
  sails: { url: 'assets/buildings/runtime-mill-v1/mill_sails-v3.png', width: 1312, height: 1199 },
  bodyHub: { x: 428, y: 450 },
  sailHub: { x: 655, y: 602 },
  bodyDisplayWidth: 68,
  /** R0-2: the body painting's alpha centre (it sits right of its canvas centre); it is centred on the tile. */
  bodyCentreX: 751,
  groundY: 1170,
  rotorScale: 0.039,
  plane: { a: 0.72, b: 0.25, c: 0, d: 1 },
  sourcePlane: { a: 1, b: 0.04, c: 0, d: 0.92 },
} as const;

type MillAsset = {
  readonly id: 'body' | 'sails';
  readonly url: string;
  readonly width: number;
  readonly height: number;
  status: 'idle' | 'loading' | 'ready' | 'missing';
  image: HTMLImageElement | null;
  raster: RasterizedWorldSprite | null;
};
const parts: MillAsset[] = (['body', 'sails'] as const).map(id => ({
  id, ...millRegistration[id], url: assetUrlForBase(millRegistration[id].url, import.meta.env?.BASE_URL ?? '/'),
  status: 'idle', image: null, raster: null,
}));
let preload: Promise<void> | null = null;

export function preloadMillAssets(): Promise<void> {
  if (typeof globalThis.Image !== 'function') return Promise.resolve();
  preload ??= Promise.all(parts.map(part => new Promise<void>(resolve => {
    part.status = 'loading';
    try {
      const image = new Image();
      image.onload = () => {
        part.status = registerRuntimeAsset(image, part.url, part.width, part.height) ? 'ready' : 'missing';
        part.image = part.status === 'ready' ? image : null;
        try {
          if (part.image !== null) part.raster = rasterizeWorldSprite(image, { x: 0, y: 0, width: part.width, height: part.height }, part.id === 'body' ? 204 : 144);
        } catch (error) {
          if (!(error instanceof Error)) throw error;
          part.raster = null;
        } finally { resolve(); }
      };
      image.onerror = () => { part.status = 'missing'; resolve(); };
      image.src = part.url;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      part.status = 'missing';
      resolve();
    }
  }))).then(() => undefined);
  return preload;
}

export function millAssetStatuses() {
  return parts.map(({ id, url, status }) => ({ id, url, status }));
}

export function millSailAngle(building: Building): number {
  const cycle = BUILDING_CONFIG_BY_KIND.mill.production?.ticksPerOutput ?? 1;
  return (building.productionProgress % cycle) / cycle * Math.PI * 2;
}

export function drawAnimatedMill(context: CanvasRenderingContext2D, building: Building): boolean {
  if (building.kind !== 'mill') return false;
  const body = parts.find(part => part.id === 'body');
  const sails = parts.find(part => part.id === 'sails');
  if (body?.image == null || sails?.image == null) return false;
  const registration = millRegistration;
  const scale = registration.bodyDisplayWidth / registration.body.width;
  const center = tileToScreen(building.tx, building.ty);
  const left = center.sx - registration.bodyCentreX * scale;
  const top = center.sy + TILE_H / 2 - registration.groundY * scale;
  context.save();
  context.imageSmoothingEnabled = true;
  drawCroppedWorldSprite(context, body.raster?.image ?? body.image, body.raster?.source ?? { x: 0, y: 0, width: body.width, height: body.height }, { x: left, y: top, width: registration.bodyDisplayWidth, height: registration.body.height * scale }, false, true);
  context.translate(left + registration.bodyHub.x * scale, top + registration.bodyHub.y * scale);
  const plane = registration.plane;
  context.transform(plane.a, plane.b, plane.c, plane.d, 0, 0);
  context.rotate(millSailAngle(building));
  const sourcePlane = registration.sourcePlane;
  const determinant = sourcePlane.a * sourcePlane.d - sourcePlane.b * sourcePlane.c;
  context.transform(sourcePlane.d / determinant, -sourcePlane.b / determinant,
    -sourcePlane.c / determinant, sourcePlane.a / determinant, 0, 0);
  const rotorScale = registration.rotorScale;
  drawCroppedWorldSprite(context, sails.raster?.image ?? sails.image, sails.raster?.source ?? { x: 0, y: 0, width: sails.width, height: sails.height },
    { x: -registration.sailHub.x * rotorScale, y: -registration.sailHub.y * rotorScale, width: registration.sails.width * rotorScale, height: registration.sails.height * rotorScale }, false, true);
  context.restore();
  return true;
}
