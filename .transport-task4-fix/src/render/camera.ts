export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
export const DEFAULT_PAN_MARGIN = 32;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface ClientPoint {
  readonly clientX: number;
  readonly clientY: number;
}

export interface CanvasRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface CameraState {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export interface ViewportBounds {
  readonly width: number;
  readonly height: number;
  readonly margin?: number;
}

export interface WorldBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface AxisClampInput {
  readonly pan: number;
  readonly minWorld: number;
  readonly maxWorld: number;
  readonly viewportSize: number;
  readonly zoom: number;
  readonly margin: number;
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function worldToCanvas(point: Point, camera: CameraState): Point {
  return {
    x: point.x * camera.zoom + camera.panX,
    y: point.y * camera.zoom + camera.panY,
  };
}

export function canvasToWorld(point: Point, camera: CameraState): Point {
  return {
    x: (point.x - camera.panX) / camera.zoom,
    y: (point.y - camera.panY) / camera.zoom,
  };
}

export function clientToCanvas(point: ClientPoint, rect: CanvasRect): Point {
  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
  };
}

export function clampPan(
  camera: CameraState,
  viewport: ViewportBounds,
  world: WorldBounds,
): CameraState {
  const zoom = clampZoom(camera.zoom);
  const margin = viewport.margin ?? DEFAULT_PAN_MARGIN;

  return {
    zoom,
    panX: clampAxis({
      pan: camera.panX,
      minWorld: world.minX,
      maxWorld: world.maxX,
      viewportSize: viewport.width,
      zoom,
      margin,
    }),
    panY: clampAxis({
      pan: camera.panY,
      minWorld: world.minY,
      maxWorld: world.maxY,
      viewportSize: viewport.height,
      zoom,
      margin,
    }),
  };
}

function clampAxis(input: AxisClampInput): number {
  const min = input.minWorld * input.zoom;
  const max = input.maxWorld * input.zoom;
  const size = max - min;

  if (size + input.margin * 2 <= input.viewportSize) {
    return (input.viewportSize - size) / 2 - min;
  }

  const minPan = input.viewportSize - input.margin - max;
  const maxPan = input.margin - min;
  return Math.min(maxPan, Math.max(minPan, input.pan));
}
