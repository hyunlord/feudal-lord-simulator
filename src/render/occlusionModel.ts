import { houseCompoundAssetMeta, houseCompoundSpriteRect } from "./houseCompoundAssets";
import { houseCompoundGeometry } from "./houseCompound";
import { buildingFootprint } from "../geometry/buildingFootprint";
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
import { historicalFacilityReady, historicalFacilitySpriteRect } from "./historicalFacilityAssets";
import { historicalHouseAssetMeta, historicalHouseReady, historicalHouseSpriteRect } from "./historicalHouseAssets";
import type { GameState } from "../engine/engine.types";

export {
  setObjectRenderViewMode,
  subscribeObjectRenderViewMode,
  toggleObjectRenderViewMode,
  type ObjectRenderViewMode,
};

export const OBJECT_OUTLINE_ALPHA = 0.35;

type Point = { readonly x: number; readonly y: number };
type Rect = Point & { readonly width: number; readonly height: number };
type Axis = { readonly x: number; readonly y: number };

const DEFAULT_CAMERA = { zoom: 1, panX: 0, panY: 0 } as const satisfies CameraState;
export function buildingSpriteOverlapsCursorTile(input: {
  readonly state?: GameState;
  readonly building: Building;
  readonly houseLevel: number;
  readonly hoveredTile: { readonly tx: number; readonly ty: number };
  readonly camera?: CameraState | undefined;
  readonly dpr?: number | undefined;
}): boolean {
  if (input.building.kind === "wheat_farm") {
    const size = buildingFootprint(input.building);
    return input.hoveredTile.tx >= input.building.tx && input.hoveredTile.tx < input.building.tx + size.width
      && input.hoveredTile.ty >= input.building.ty && input.hoveredTile.ty < input.building.ty + size.height;
  }
  if (input.building.kind === "house" && input.building.houseLot !== undefined) {
    const geometry = houseCompoundGeometry(input.building, input.houseLevel);
    const camera = input.camera ?? DEFAULT_CAMERA;
    const dpr = input.dpr ?? 1;
    const asset = houseCompoundAssetMeta(input.building, input.houseLevel);
    if (asset !== null) {
      const rect = houseCompoundSpriteRect(input.building, asset);
      const origin = worldToCanvas({ x: rect.x, y: rect.y }, camera);
      return rectIntersectsDiamond({ x: origin.x * dpr, y: origin.y * dpr,
        width: rect.width * camera.zoom * dpr, height: rect.height * camera.zoom * dpr }, cursorDiamond(input.hoveredTile, camera, dpr));
    }
    const points = [...geometry.corners, ...geometry.eaves, ...geometry.ridge].map(point => {
      const screen = tileToScreen(point.tx, point.ty);
      const canvas = worldToCanvas({ x: screen.sx, y: screen.sy - point.lift }, camera);
      return { x: canvas.x * dpr, y: canvas.y * dpr };
    });
    const minX = Math.min(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    return rectIntersectsDiamond({ x: minX, y: minY, width: Math.max(...points.map(point => point.x)) - minX,
      height: Math.max(...points.map(point => point.y)) - minY }, cursorDiamond(input.hoveredTile, camera, dpr));
  }
  const fullDetail = (input.camera?.zoom ?? 1) > 0.7;
  const houseMeta = fullDetail && input.building.kind === "house" && historicalHouseReady(input.houseLevel) ? historicalHouseAssetMeta(input.houseLevel) : null;
  const historicalRect = houseMeta === null ? (fullDetail && historicalFacilityReady(input.building, input.state) ? historicalFacilitySpriteRect(input.building) : null)
    : historicalHouseSpriteRect(input.building, houseMeta);
  if (historicalRect !== null) {
    const camera = input.camera ?? DEFAULT_CAMERA;
    const dpr = input.dpr ?? 1;
    const origin = worldToCanvas(historicalRect, camera);
    return rectIntersectsDiamond({ x: origin.x * dpr, y: origin.y * dpr,
      width: historicalRect.width * camera.zoom * dpr, height: historicalRect.height * camera.zoom * dpr }, cursorDiamond(input.hoveredTile, camera, dpr));
  }
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
