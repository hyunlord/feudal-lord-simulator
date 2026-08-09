import type { Building } from "../content/buildingConfig";
import { worldToCanvas, type CameraState } from "./camera";
import { buildingSpriteKey } from "./buildingSprites";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import {
  setObjectRenderViewMode,
  subscribeObjectRenderViewMode,
  toggleObjectRenderViewMode,
  type ObjectRenderViewMode,
} from "./objectRenderViewMode";
import { spriteMeta } from "./worldAssets";

export {
  setObjectRenderViewMode,
  subscribeObjectRenderViewMode,
  toggleObjectRenderViewMode,
  type ObjectRenderViewMode,
};

export const CURSOR_OVERLAP_ALPHA = 0.5;
export const DENSE_BUILDING_ALPHA = 0.8;
export const OBJECT_OUTLINE_ALPHA = 0.35;

type Point = { readonly x: number; readonly y: number };
type Rect = Point & { readonly width: number; readonly height: number };
type Axis = { readonly x: number; readonly y: number };

const DEFAULT_CAMERA = { zoom: 1, panX: 0, panY: 0 } as const satisfies CameraState;
const DENSE_WINDOW_SIZE = 5;
const DENSE_BUILDING_THRESHOLD = 6;

export function normalBuildingAlpha(input: {
  readonly cursorOverlaps: boolean;
  readonly dense: boolean;
}): number {
  return (
    (input.cursorOverlaps ? CURSOR_OVERLAP_ALPHA : 1) *
    (input.dense ? DENSE_BUILDING_ALPHA : 1)
  );
}

export function denseBuildingClusterIds(buildings: readonly Building[]): ReadonlySet<string> {
  const windowCounts = new Map<string, number>();
  for (const building of buildings) {
    forEachWindowContaining(building, (key) => {
      windowCounts.set(key, (windowCounts.get(key) ?? 0) + 1);
    });
  }

  const denseIds = new Set<string>();
  for (const building of buildings) {
    forEachWindowContaining(building, (key) => {
      if ((windowCounts.get(key) ?? 0) > DENSE_BUILDING_THRESHOLD) denseIds.add(building.id);
    });
  }
  return denseIds;
}

export function buildingSpriteOverlapsCursorTile(input: {
  readonly building: Building;
  readonly houseLevel: number;
  readonly hoveredTile: { readonly tx: number; readonly ty: number };
  readonly camera?: CameraState | undefined;
  readonly dpr?: number | undefined;
}): boolean {
  const meta = spriteMeta(buildingSpriteKey(input.building, input.houseLevel));
  if (meta === null) return false;
  const camera = input.camera ?? DEFAULT_CAMERA;
  const dpr = input.dpr ?? 1;
  const spriteRect = spriteScreenRect({
    meta,
    tx: input.building.tx + meta.footprint.width - 1,
    ty: input.building.ty + meta.footprint.height - 1,
    camera,
    dpr,
  });
  return rectIntersectsDiamond(spriteRect, cursorDiamond(input.hoveredTile, camera, dpr));
}

function forEachWindowContaining(building: Building, visit: (key: string) => void): void {
  for (let wy = building.ty - DENSE_WINDOW_SIZE + 1; wy <= building.ty; wy += 1) {
    for (let wx = building.tx - DENSE_WINDOW_SIZE + 1; wx <= building.tx; wx += 1) {
      visit(`${wx}:${wy}`);
    }
  }
}

function spriteScreenRect(input: {
  readonly meta: NonNullable<ReturnType<typeof spriteMeta>>;
  readonly tx: number;
  readonly ty: number;
  readonly camera: CameraState;
  readonly dpr: number;
}): Rect {
  const anchor = tileToScreen(input.tx, input.ty);
  const canvasAnchor = worldToCanvas({ x: anchor.sx, y: anchor.sy }, input.camera);
  const scale = input.camera.zoom * input.meta.renderScale;
  return {
    x: (canvasAnchor.x - input.meta.anchor.x * scale) * input.dpr,
    y: (canvasAnchor.y - input.meta.anchor.y * scale) * input.dpr,
    width: input.meta.width * scale * input.dpr,
    height: input.meta.height * scale * input.dpr,
  };
}

function cursorDiamond(
  tile: { readonly tx: number; readonly ty: number },
  camera: CameraState,
  dpr: number,
): readonly Point[] {
  const center = tileToScreen(tile.tx, tile.ty);
  const canvasCenter = worldToCanvas({ x: center.sx, y: center.sy }, camera);
  const rx = (TILE_W / 2) * camera.zoom * dpr;
  const ry = (TILE_H / 2) * camera.zoom * dpr;
  const x = canvasCenter.x * dpr;
  const y = canvasCenter.y * dpr;
  return [
    { x, y: y - ry },
    { x: x + rx, y },
    { x, y: y + ry },
    { x: x - rx, y },
  ];
}

function rectIntersectsDiamond(rect: Rect, diamond: readonly Point[]): boolean {
  const rectPoints = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  return polygonsIntersect(rectPoints, diamond);
}

function polygonsIntersect(left: readonly Point[], right: readonly Point[]): boolean {
  for (const axis of [...axesFor(left), ...axesFor(right)]) {
    const leftProjection = project(left, axis);
    const rightProjection = project(right, axis);
    if (leftProjection.max < rightProjection.min || rightProjection.max < leftProjection.min) {
      return false;
    }
  }
  return true;
}

function axesFor(points: readonly Point[]): readonly Axis[] {
  const axes: Axis[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current === undefined || next === undefined) continue;
    const edge = { x: next.x - current.x, y: next.y - current.y };
    const length = Math.hypot(edge.x, edge.y);
    if (length > 0) axes.push({ x: -edge.y / length, y: edge.x / length });
  }
  return axes;
}

function project(points: readonly Point[], axis: Axis): { readonly min: number; readonly max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const value = point.x * axis.x + point.y * axis.y;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}
