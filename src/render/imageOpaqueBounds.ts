import { IMAGE_OPAQUE_BOUNDS } from "./pixelFacts.generated";

// SMOOTH-2R: an image's opaque bounds (its pixels with alpha > 0), measured at build time into pixelFacts.generated.ts
// (scripts/buildPixelFacts.ts), so the raster trim never reads pixels. A canvas made from an image (a downscaled module,
// the mirrored gate) has no entry: its whole area counts (measured over 1,848 wall rasters in the big town, the trim
// then keeps 3.9 % more pixels than the pixel scan did). Browser image cache, keyed by the image object.
export type OpaqueBounds = Readonly<{ left: number; top: number; right: number; bottom: number }>;
const registered = new WeakMap<object, OpaqueBounds | null>();
/** One source pixel of slack around the opaque pixels (a smoothed or scaled sample reaches its neighbour). */
const PAD = 1;

/** Opaque bounds in the image's own pixels (right and bottom exclusive, padded by one pixel); null when the image is
 * wholly transparent; undefined when unknown (the whole image then counts). */
export function imageOpaqueBounds(image: CanvasImageSource): OpaqueBounds | null | undefined {
  const known = registered.get(image);
  if (known !== undefined || registered.has(image)) return known;
  const element = image as Partial<HTMLImageElement>;
  if (typeof element.src !== "string" || typeof element.naturalWidth !== "number" || element.naturalWidth === 0) return undefined;
  const at = element.src.indexOf("assets/");
  const facts = at < 0 ? undefined : IMAGE_OPAQUE_BOUNDS[element.src.slice(at).split(/[?#]/)[0] as keyof typeof IMAGE_OPAQUE_BOUNDS];
  if (facts === undefined) return undefined;
  const scaleX = element.naturalWidth / facts.width; const scaleY = (element.naturalHeight ?? 0) / facts.height;
  const bounds = facts.right <= facts.left ? null : {
    left: Math.max(0, facts.left - PAD) * scaleX, top: Math.max(0, facts.top - PAD) * scaleY,
    right: Math.min(facts.width, facts.right + PAD) * scaleX, bottom: Math.min(facts.height, facts.bottom + PAD) * scaleY,
  };
  registered.set(image, bounds);
  return bounds;
}
