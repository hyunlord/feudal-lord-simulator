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

export function runtimeAssetCrop(image: CanvasImageSource, source: Crop): Crop {
  const scale = imageScales.get(image);
  return scale === undefined ? source : {
    x: source.x * scale.x, y: source.y * scale.y,
    width: source.width * scale.x, height: source.height * scale.y,
  };
}
