import type { GameState } from "../engine/engine.types";
import {
  OPENING_VILLAGE_CENTER,
  STARTING_HOUSE_ID,
  openingVillageBuildings,
} from "../state/openingVillage";
import { clampPan, clampZoom, type CameraState, type Point } from "./camera";
import { worldBounds } from "./interactions";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { STARTING_LANDMARKS } from "./startingLandmarks";

const DESKTOP_CONSOLE_HEIGHT = 150;
const TABLET_CONSOLE_HEIGHT = 276;
const MOBILE_CONSOLE_HEIGHT = 224;
const MOBILE_MAX_WIDTH = 600;
const TABLET_MAX_WIDTH = 900;
const MOBILE_TOP_RAIL_SAFE_INSET = 176;
const LOW_HEIGHT_MAX = 400;
const TARGET_ISO_TILE_SPAN = 20;
export const MIN_OPENING_1X1_BUILDING_SCREEN_PX = 80;
const COTTAGE_SPRITE = { width: 96, height: 112, anchorX: 48, anchorY: 96 } as const;
const WELL_SPRITE = { width: 72, height: 80, anchorX: 36, anchorY: 64 } as const;
const MIN_OPENING_1X1_SPRITE_PX = Math.min(
  COTTAGE_SPRITE.width,
  COTTAGE_SPRITE.height,
  WELL_SPRITE.width,
  WELL_SPRITE.height,
);
const COMPACT_OPENING_MIN_ZOOM = MIN_OPENING_1X1_BUILDING_SCREEN_PX / MIN_OPENING_1X1_SPRITE_PX;

type InitialCameraCanvas = Pick<HTMLCanvasElement, "clientWidth" | "clientHeight">;
type InitialCameraState = Pick<GameState, "width" | "height" | "buildings">;
type ScreenBounds = { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number };
type OpeningSpriteMeta = typeof COTTAGE_SPRITE | typeof WELL_SPRITE;

export type DragState = {
  readonly mode: "none" | "pan" | "road" | "palisade";
  readonly lastCanvasPoint: Point | null;
  readonly roadStart: { readonly tx: number; readonly ty: number } | null;
  readonly moved: boolean;
};

export type ViewportResizeCameraInput = {
  readonly camera: CameraState;
  readonly canvas: InitialCameraCanvas;
  readonly state: InitialCameraState;
  readonly userControlled: boolean;
};

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): number {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = Math.max(1, window.devicePixelRatio);
  canvas.width = Math.round(bounds.width * pixelRatio);
  canvas.height = Math.round(bounds.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return pixelRatio;
}

export function initialCamera(
  canvas: InitialCameraCanvas,
  state: InitialCameraState,
): CameraState {
  return cameraForStartingHouse(canvas, state);
}

export function cameraForStartingHouse(
  canvas: InitialCameraCanvas,
  state: InitialCameraState,
): CameraState {
  const house = startingHouse(state.buildings);
  const zoom = startingHouseZoom(canvas, house?.id === STARTING_HOUSE_ID);
  if (house === null) {
    return genericInitialCamera(canvas, state, zoom);
  }
  const anchorCoordinate = house.id === STARTING_HOUSE_ID
    ? OPENING_VILLAGE_CENTER
    : { tx: house.tx, ty: house.ty };
  const anchor = tileToScreen(anchorCoordinate.tx, anchorCoordinate.ty);
  const center = house.id === STARTING_HOUSE_ID
    ? openingTableauViewportCenter(canvas, zoom)
    : usableViewportCenter(canvas);

  return {
    zoom,
    panX: center.x - anchor.sx * zoom,
    panY: center.y - anchor.sy * zoom,
  };
}

export function cameraAfterViewportResize(input: ViewportResizeCameraInput): CameraState {
  if (!input.userControlled) {
    return cameraForStartingHouse(input.canvas, input.state);
  }
  return clampPan(
    input.camera,
    { width: input.canvas.clientWidth, height: input.canvas.clientHeight },
    worldBounds(input.state.width, input.state.height),
  );
}

function startingHouseZoom(canvas: InitialCameraCanvas, useCompactOpeningFloor: boolean): number {
  const usableHeight = usableViewportHeight(canvas);
  const fittedZoom = Math.min(
    canvas.clientWidth / (TILE_W * TARGET_ISO_TILE_SPAN),
    usableHeight / (TILE_H * TARGET_ISO_TILE_SPAN),
  );
  return clampZoom(
    useCompactOpeningFloor
      ? Math.max(fittedZoom, COMPACT_OPENING_MIN_ZOOM)
      : fittedZoom,
  );
}

function usableViewportCenter(canvas: InitialCameraCanvas): Point {
  return {
    x: canvas.clientWidth / 2,
    y: usableViewportHeight(canvas) / 2,
  };
}

function openingTableauViewportCenter(canvas: InitialCameraCanvas, zoom: number): Point {
  if (!usesCompactOpeningTableauFit(canvas)) return usableViewportCenter(canvas);
  const bounds = openingTableauBounds(canvas);
  const anchor = tileToScreen(OPENING_VILLAGE_CENTER.tx, OPENING_VILLAGE_CENTER.ty);
  const safeTop = openingTopInset(canvas);
  const safeBottom = usableViewportHeight(canvas);
  return {
    x: (canvas.clientWidth - (bounds.minX + bounds.maxX - anchor.sx * 2) * zoom) / 2,
    y: (safeTop + safeBottom - (bounds.minY + bounds.maxY - anchor.sy * 2) * zoom) / 2,
  };
}

function usesCompactOpeningTableauFit(canvas: InitialCameraCanvas): boolean {
  return canvas.clientWidth <= MOBILE_MAX_WIDTH || canvas.clientHeight <= LOW_HEIGHT_MAX;
}

function openingTopInset(canvas: InitialCameraCanvas): number {
  return canvas.clientWidth <= MOBILE_MAX_WIDTH && canvas.clientHeight > LOW_HEIGHT_MAX
    ? MOBILE_TOP_RAIL_SAFE_INSET
    : 0;
}

function openingTableauBounds(canvas: InitialCameraCanvas): ScreenBounds {
  const village = openingVillageSpriteBounds();
  const landmarks = pointBounds(STARTING_LANDMARKS.map(({ tx, ty }) => tileToScreen(tx, ty)));
  return {
    minX: Math.min(village.minX, landmarks.minX),
    maxX: Math.max(village.maxX, landmarks.maxX),
    minY: canvas.clientHeight <= LOW_HEIGHT_MAX ? village.minY : Math.min(village.minY, landmarks.minY),
    maxY: canvas.clientHeight <= LOW_HEIGHT_MAX ? village.maxY : Math.max(village.maxY, landmarks.maxY),
  };
}

function openingVillageSpriteBounds(): ScreenBounds {
  const rects = openingVillageBuildings().map((building) => {
    const anchor = tileToScreen(building.tx, building.ty);
    const meta = openingSpriteMeta(building.kind);
    return {
      minX: anchor.sx - meta.anchorX,
      maxX: anchor.sx + meta.width - meta.anchorX,
      minY: anchor.sy - meta.anchorY,
      maxY: anchor.sy + meta.height - meta.anchorY,
    };
  });
  return pointBounds(rects.flatMap((rect) => [
    { sx: rect.minX, sy: rect.minY },
    { sx: rect.maxX, sy: rect.maxY },
  ]));
}

function openingSpriteMeta(kind: InitialCameraState["buildings"][number]["kind"]): OpeningSpriteMeta {
  return kind === "well" ? WELL_SPRITE : COTTAGE_SPRITE;
}

function pointBounds(points: readonly { readonly sx: number; readonly sy: number }[]): ScreenBounds {
  return {
    minX: Math.min(...points.map((point) => point.sx)),
    maxX: Math.max(...points.map((point) => point.sx)),
    minY: Math.min(...points.map((point) => point.sy)),
    maxY: Math.max(...points.map((point) => point.sy)),
  };
}

function usableViewportHeight(canvas: InitialCameraCanvas): number {
  const consoleHeight = courtConsoleHeightForCanvasWidth(canvas.clientWidth);
  return Math.max(1, canvas.clientHeight - consoleHeight);
}

function courtConsoleHeightForCanvasWidth(canvasWidth: number): number {
  if (canvasWidth <= MOBILE_MAX_WIDTH) {
    return MOBILE_CONSOLE_HEIGHT;
  }
  if (canvasWidth <= TABLET_MAX_WIDTH) {
    return TABLET_CONSOLE_HEIGHT;
  }
  return DESKTOP_CONSOLE_HEIGHT;
}

function startingHouse(
  buildings: InitialCameraState["buildings"],
): InitialCameraState["buildings"][number] | null {
  return (
    buildings.find((building) => building.id === STARTING_HOUSE_ID && building.kind === "house") ??
    buildings.find((building) => building.kind === "house") ??
    null
  );
}

function genericInitialCamera(
  canvas: InitialCameraCanvas,
  state: Pick<GameState, "width" | "height">,
  zoom: number,
): CameraState {
  // With no house anchor, keep the previous world-bounds clamp behavior so the
  // fallback is finite and generic instead of inventing a synthetic target.
  return clampPan(
    { zoom, panX: canvas.clientWidth / 2, panY: 80 },
    { width: canvas.clientWidth, height: canvas.clientHeight },
    worldBounds(state.width, state.height),
  );
}

export function hoveredBuildingPosition(
  event: Pick<MouseEvent, "clientX" | "clientY">,
  bounds: Pick<DOMRect, "left" | "top" | "width" | "height">,
): Point {
  return {
    x: Math.min(bounds.width - 232, Math.max(8, event.clientX - bounds.left + 14)),
    y: Math.min(bounds.height - 142, Math.max(8, event.clientY - bounds.top + 14)),
  };
}
