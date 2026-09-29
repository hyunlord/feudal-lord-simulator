import { imageOpaqueBounds } from "./imageOpaqueBounds";

// SMOOTH-2R: the device-pixel extent a raster's draw callback paints, recorded from its canvas calls instead of read
// back from the pixels. worldRasterCache trims each cached wall piece to it; the pixel read it replaces
// (getImageData of the whole padded raster) took 126 reads / 0.8 s in the big town's first 30 s and 1,722 reads /
// 2.9 s during a 20 s camera pan (headless Chrome, dpr 2, before this change).
// The extent is conservative: every painted pixel lies inside it (a path's control points bound the path, a stroke
// adds its half width with the join's reach, an image counts only its opaque part from the build-time manifest, a
// clip only shrinks). A call whose extent it cannot bound (text, a Path2D, pixel writes, a filter) makes the whole
// raster count. Shadows are forbidden in src (renderSourceGuards), so they are not handled.

export type DeviceExtent = { left: number; top: number; right: number; bottom: number };
/** The painted extent in device pixels of the raster, null when nothing was painted, "unbounded" when unknown. */
export type RecordedExtent = Readonly<DeviceExtent> | null | "unbounded";
type Matrix = readonly [number, number, number, number, number, number];
type State = { matrix: Matrix; clip: DeviceExtent | null };
const SQRT2 = Math.SQRT2;
/** A smoothed image may bleed past its opaque source pixels by the filter's footprint (device px). */
const SMOOTHING_BLEED = 2;
/** Antialiased edges reach up to a pixel past the geometry (measured: 36 of 1,848 wall rasters without it). */
const EDGE_BLEED = 1;

const emptyExtent = (): DeviceExtent => ({ left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
const isEmpty = (box: DeviceExtent): boolean => !(box.right >= box.left && box.bottom >= box.top);
const multiply = (m: Matrix, a: number, b: number, c: number, d: number, e: number, f: number): Matrix => [
  m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d,
  m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];

/**
 * Runs `draw` on a recording view of `paint` (every call reaches `paint` unchanged) and returns what it painted.
 * `transform` is the transform `paint` holds when `draw` starts (the caller set it; no getTransform read).
 */
export function recordDrawExtent(paint: CanvasRenderingContext2D, transform: Matrix,
  draw: (paint: CanvasRenderingContext2D) => void): RecordedExtent {
  let state: State = { matrix: transform, clip: null };
  const stack: State[] = [];
  let path = emptyExtent();
  const painted = emptyExtent();
  let unbounded = false;
  const addPoint = (x: number, y: number) => {
    const m = state.matrix; const px = m[0] * x + m[2] * y + m[4]; const py = m[1] * x + m[3] * y + m[5];
    if (px < path.left) path.left = px; if (px > path.right) path.right = px;
    if (py < path.top) path.top = py; if (py > path.bottom) path.bottom = py;
  };
  const addBox = (x0: number, y0: number, x1: number, y1: number) => { addPoint(x0, y0); addPoint(x1, y0); addPoint(x0, y1); addPoint(x1, y1); };
  const paintBox = (box: DeviceExtent, grow: number) => {
    if (isEmpty(box)) return;
    if (typeof paint.filter === "string" && paint.filter !== "none") { unbounded = true; return; }
    const clip = state.clip;
    const reach = grow + EDGE_BLEED;
    const left = Math.max(box.left - reach, (clip?.left ?? -Infinity) - EDGE_BLEED); const right = Math.min(box.right + reach, (clip?.right ?? Infinity) + EDGE_BLEED);
    const top = Math.max(box.top - reach, (clip?.top ?? -Infinity) - EDGE_BLEED); const bottom = Math.min(box.bottom + reach, (clip?.bottom ?? Infinity) + EDGE_BLEED);
    if (right < left || bottom < top) return;
    painted.left = Math.min(painted.left, left); painted.right = Math.max(painted.right, right);
    painted.top = Math.min(painted.top, top); painted.bottom = Math.max(painted.bottom, bottom);
  };
  /** Half the line width in device px, times the farthest a join or cap reaches (the matrix norm bounds its scale). */
  const strokeGrow = () => {
    const m = state.matrix; const reach = paint.lineJoin === "miter" ? Math.max(paint.miterLimit, SQRT2) : SQRT2;
    return paint.lineWidth / 2 * reach * Math.hypot(m[0], m[1], m[2], m[3]);
  };
  const box = (run: () => void): DeviceExtent => { const saved = path; path = emptyExtent(); run(); const made = path; path = saved; return made; };
  const isPath2D = (value: unknown) => typeof value === "object" && value !== null;
  const forward = (name: string, args: readonly unknown[]) => Reflect.apply(Reflect.get(paint, name) as (...values: unknown[]) => unknown, paint, args);

  const handlers: Record<string, (...args: never[]) => unknown> = {
    save: () => { stack.push(state); return forward("save", []); },
    restore: () => { state = stack.pop() ?? state; return forward("restore", []); },
    setTransform: (...args: unknown[]) => {
      const [a, b, c, d, e, f] = args.length >= 6 ? args as number[] : matrixOf(args[0]);
      state = { ...state, matrix: [a, b, c, d, e, f] };
      return forward("setTransform", args);
    },
    resetTransform: () => { state = { ...state, matrix: [1, 0, 0, 1, 0, 0] }; return forward("resetTransform", []); },
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
      state = { ...state, matrix: multiply(state.matrix, a, b, c, d, e, f) }; return forward("transform", [a, b, c, d, e, f]);
    },
    translate: (x: number, y: number) => { state = { ...state, matrix: multiply(state.matrix, 1, 0, 0, 1, x, y) }; return forward("translate", [x, y]); },
    scale: (x: number, y: number) => { state = { ...state, matrix: multiply(state.matrix, x, 0, 0, y, 0, 0) }; return forward("scale", [x, y]); },
    rotate: (angle: number) => {
      const cos = Math.cos(angle); const sin = Math.sin(angle);
      state = { ...state, matrix: multiply(state.matrix, cos, sin, -sin, cos, 0, 0) }; return forward("rotate", [angle]);
    },
    beginPath: () => { path = emptyExtent(); return forward("beginPath", []); },
    moveTo: (x: number, y: number) => { addPoint(x, y); return forward("moveTo", [x, y]); },
    lineTo: (x: number, y: number) => { addPoint(x, y); return forward("lineTo", [x, y]); },
    quadraticCurveTo: (...args: number[]) => { for (let i = 0; i < 4; i += 2) addPoint(args[i]!, args[i + 1]!); return forward("quadraticCurveTo", args); },
    bezierCurveTo: (...args: number[]) => { for (let i = 0; i < 6; i += 2) addPoint(args[i]!, args[i + 1]!); return forward("bezierCurveTo", args); },
    rect: (x: number, y: number, w: number, h: number) => { addBox(x, y, x + w, y + h); return forward("rect", [x, y, w, h]); },
    roundRect: (...args: unknown[]) => { const [x, y, w, h] = args as number[]; addBox(x!, y!, x! + w!, y! + h!); return forward("roundRect", args); },
    arc: (...args: unknown[]) => { const [x, y, r] = args as number[]; addBox(x! - r!, y! - r!, x! + r!, y! + r!); return forward("arc", args); },
    ellipse: (...args: unknown[]) => {
      const [x, y, rx, ry] = args as number[]; const r = Math.max(rx!, ry!); addBox(x! - r, y! - r, x! + r, y! + r); return forward("ellipse", args);
    },
    arcTo: (...args: unknown[]) => { unbounded = true; return forward("arcTo", args); },
    fill: (...args: unknown[]) => { if (isPath2D(args[0])) unbounded = true; else paintBox(path, 0); return forward("fill", args); },
    stroke: (...args: unknown[]) => { if (isPath2D(args[0])) unbounded = true; else paintBox(path, strokeGrow()); return forward("stroke", args); },
    clip: (...args: unknown[]) => {
      if (!isPath2D(args[0])) {
        const clip = state.clip; const next = { ...path };
        if (clip !== null) { next.left = Math.max(next.left, clip.left); next.right = Math.min(next.right, clip.right); next.top = Math.max(next.top, clip.top); next.bottom = Math.min(next.bottom, clip.bottom); }
        state = { ...state, clip: next };
      }
      return forward("clip", args);
    },
    fillRect: (x: number, y: number, w: number, h: number) => { paintBox(box(() => addBox(x, y, x + w, y + h)), 0); return forward("fillRect", [x, y, w, h]); },
    strokeRect: (x: number, y: number, w: number, h: number) => { paintBox(box(() => addBox(x, y, x + w, y + h)), strokeGrow()); return forward("strokeRect", [x, y, w, h]); },
    drawImage: (image: CanvasImageSource, ...args: number[]) => {
      paintImage(image, args);
      return forward("drawImage", [image, ...args]);
    },
    fillText: (...args: unknown[]) => { unbounded = true; return forward("fillText", args); },
    strokeText: (...args: unknown[]) => { unbounded = true; return forward("strokeText", args); },
    putImageData: (...args: unknown[]) => { unbounded = true; return forward("putImageData", args); },
  };

  function paintImage(image: CanvasImageSource, args: readonly number[]): void {
    const size = sourceSize(image);
    const full = args.length >= 8;
    if (!full && size === null) { unbounded = true; return; }
    const [sx, sy, sw, sh] = full ? args : [0, 0, size!.width, size!.height];
    const [dx, dy, dw, dh] = full ? args.slice(4) : args.length >= 4 ? args : [args[0]!, args[1]!, sw!, sh!];
    const opaque = imageOpaqueBounds(image);
    if (opaque === null) return;
    const x0 = Math.min(sx!, sx! + sw!); const x1 = Math.max(sx!, sx! + sw!);
    const y0 = Math.min(sy!, sy! + sh!); const y1 = Math.max(sy!, sy! + sh!);
    const left = Math.max(x0, opaque?.left ?? x0); const right = Math.min(x1, opaque?.right ?? x1);
    const top = Math.max(y0, opaque?.top ?? y0); const bottom = Math.min(y1, opaque?.bottom ?? y1);
    if (right <= left || bottom <= top || sw === 0 || sh === 0) return;
    const mapX = (x: number) => dx! + (x - sx!) * dw! / sw!; const mapY = (y: number) => dy! + (y - sy!) * dh! / sh!;
    paintBox(box(() => addBox(mapX(left), mapY(top), mapX(right), mapY(bottom))), paint.imageSmoothingEnabled ? SMOOTHING_BLEED : 0);
  }

  const bound = new Map<PropertyKey, unknown>();
  const view = new Proxy(paint, {
    get(target, property) {
      const handler = handlers[property as string];
      if (handler !== undefined) return handler;
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== "function") return value;
      let method = bound.get(property);
      if (method === undefined) { method = (value as (...values: unknown[]) => unknown).bind(target); bound.set(property, method); }
      return method;
    },
    set(target, property, value) { return Reflect.set(target, property, value, target); },
  });
  draw(view);
  if (unbounded) return "unbounded";
  return isEmpty(painted) ? null : painted;
}

function matrixOf(value: unknown): Matrix {
  const m = (value ?? {}) as Partial<Record<"a" | "b" | "c" | "d" | "e" | "f" | "m11" | "m12" | "m21" | "m22" | "m41" | "m42", number>>;
  return [m.a ?? m.m11 ?? 1, m.b ?? m.m12 ?? 0, m.c ?? m.m21 ?? 0, m.d ?? m.m22 ?? 1, m.e ?? m.m41 ?? 0, m.f ?? m.m42 ?? 0];
}

function sourceSize(image: CanvasImageSource): { width: number; height: number } | null {
  const source = image as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number; width?: unknown; height?: unknown };
  const width = source.naturalWidth ?? source.videoWidth ?? (typeof source.width === "number" ? source.width : NaN);
  const height = source.naturalHeight ?? source.videoHeight ?? (typeof source.height === "number" ? source.height : NaN);
  return width > 0 && height > 0 ? { width, height } : null;
}
