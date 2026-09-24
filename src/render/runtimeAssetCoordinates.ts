import { runtimeAssetDerivatives } from "./runtimeAssetDerivatives.generated";

type Crop = Readonly<{ x: number; y: number; width: number; height: number }>;
const imageScales = new WeakMap<CanvasImageSource, Readonly<{ x: number; y: number }>>();
const derivatives = new Map(runtimeAssetDerivatives.map(asset => [asset.url, asset]));

/** Authored registrations stay in source pixels; only image sampling uses derivative pixels. */
export function registerRuntimeAsset(image: HTMLImageElement, url: string, originalWidth: number, originalHeight: number): boolean {
  const path = url.slice(url.indexOf("assets/"));
  const derivative = derivatives.get(path);
  if (image.naturalWidth === originalWidth && image.naturalHeight === originalHeight) {
    imageScales.delete(image);
    return true;
  }
  if (derivative === undefined || derivative.originalWidth !== originalWidth || derivative.originalHeight !== originalHeight
    || image.naturalWidth !== derivative.width || image.naturalHeight !== derivative.height) return false;
  imageScales.set(image, { x: derivative.width / originalWidth, y: derivative.height / originalHeight });
  return true;
}

/**
 * A variant painted in another asset's frame (Wave 2 visual variants): authored coordinates are the base's, so only
 * the sampling scale is recorded. The image must keep the base canvas proportions (within one pixel).
 */
export function registerRuntimeAssetVariant(image: HTMLImageElement, originalWidth: number, originalHeight: number): boolean {
  const scaleX = image.naturalWidth / originalWidth; const scaleY = image.naturalHeight / originalHeight;
  if (!(scaleX > 0) || Math.abs(scaleX * originalHeight - image.naturalHeight) > 1) return false;
  if (scaleX === 1 && scaleY === 1) imageScales.delete(image); else imageScales.set(image, { x: scaleX, y: scaleY });
  return true;
}

export function runtimeAssetCrop(image: CanvasImageSource, source: Crop): Crop {
  const scale = imageScales.get(image);
  return scale === undefined ? source : {
    x: source.x * scale.x, y: source.y * scale.y,
    width: source.width * scale.x, height: source.height * scale.y,
  };
}
