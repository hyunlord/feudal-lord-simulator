type Transform = Readonly<{ a: number; b: number; c: number; d: number; e: number; f: number }>;
export type RasterBounds = Readonly<{ left:number; top:number; right:number; bottom:number }>;
type Entry = Readonly<{ canvas:HTMLCanvasElement; x:number; y:number; pixels:number }>;
const caches = new WeakMap<CanvasRenderingContext2D, Map<string, Entry>>();
const MAX_PIXELS = 8_000_000;

export function rasterCacheKey(content:string, t:Transform, width:number, height:number):string {
  return `${content}|${t.a},${t.b},${t.c},${t.d},${t.e},${t.f}|${width},${height}`;
}

/** Replays only an unchanged static draw at its original device resolution and queue position. */
export function drawCachedWorldRaster(context:CanvasRenderingContext2D, content:string,
  bounds:RasterBounds, draw:(paint:CanvasRenderingContext2D)=>void):void {
  if (typeof document === 'undefined' || typeof context.getTransform !== 'function'
    || context.globalCompositeOperation !== 'source-over' || context.globalAlpha !== 1) {
    draw(context); return;
  }
  const transform = context.getTransform();
  const key = rasterCacheKey(`${content}|${context.imageSmoothingEnabled}:${context.imageSmoothingQuality}`,
    transform, context.canvas.width, context.canvas.height);
  let cache = caches.get(context);
  if (cache === undefined) { cache = new Map(); caches.set(context, cache); }
  let entry = cache.get(key);
  if (entry === undefined) {
    const points = ([[bounds.left, bounds.top], [bounds.right, bounds.top],
      [bounds.left, bounds.bottom], [bounds.right, bounds.bottom]] as const).map(([x, y]) => ({
        x:transform.a*x+transform.c*y+transform.e, y:transform.b*x+transform.d*y+transform.f,
      }));
    const x = Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))));
    const y = Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))));
    const width = Math.min(context.canvas.width,Math.ceil(Math.max(...points.map(p=>p.x))))-x;
    const height = Math.min(context.canvas.height,Math.ceil(Math.max(...points.map(p=>p.y))))-y;
    if (width <= 0 || height <= 0) return;
    const pixels = width*height;
    if (pixels > MAX_PIXELS) { draw(context); return; }
    const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const paint = canvas.getContext('2d');
    if (paint === null) { draw(context); return; }
    paint.setTransform(transform.a,transform.b,transform.c,transform.d,transform.e-x,transform.f-y);
    paint.imageSmoothingEnabled=context.imageSmoothingEnabled;
    paint.imageSmoothingQuality=context.imageSmoothingQuality;
    draw(paint);
    entry={canvas,x,y,pixels};
    let total=pixels;
    for(const existing of cache.values())total+=existing.pixels;
    for(const [oldKey,old] of cache) {
      if(total<=MAX_PIXELS)break;
      total-=old.pixels; cache.delete(oldKey);
    }
    cache.set(key,entry);
  } else { cache.delete(key); cache.set(key,entry); }
  context.save();
  context.setTransform(1,0,0,1,0,0);
  context.drawImage(entry.canvas,entry.x,entry.y);
  context.restore();
}
