import type { GameState } from "../engine/engine.types";
import { clampPan, clampZoom, type CameraState, type Point } from "./camera";
import { worldBounds } from "./interactions";
import { TILE_H, TILE_W, tileToScreen } from "./iso";

const STARTING_HOUSE_ID = "house-0-0-0";
const DESKTOP_CONSOLE_HEIGHT = 150;
const MOBILE_CONSOLE_HEIGHT = 188;
const MOBILE_MAX_WIDTH = 600;
const TARGET_ISO_TILE_SPAN = 20;

type InitialCameraCanvas = Pick<HTMLCanvasElement, "clientWidth" | "clientHeight">;
type InitialCameraState = Pick<GameState, "width" | "height" | "buildings">;

export type DragState = {
  readonly mode: "none" | "pan" | "road";
  readonly lastCanvasPoint: Point | null;
  readonly roadStart: { readonly tx: number; readonly ty: number } | null;
  readonly moved: boolean;
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
  const zoom = startingHouseZoom(canvas);
  const house = startingHouse(state.buildings);
  if (house === null) {
    return genericInitialCamera(canvas, state, zoom);
  }
  const anchor = tileToScreen(house.tx, house.ty);
  const center = usableViewportCenter(canvas);

  return {
    zoom,
    panX: center.x - anchor.sx * zoom,
    panY: center.y - anchor.sy * zoom,
  };
}

function startingHouseZoom(canvas: InitialCameraCanvas): number {
  const usableHeight = usableViewportHeight(canvas);
  return clampZoom(
    Math.min(
      canvas.clientWidth / (TILE_W * TARGET_ISO_TILE_SPAN),
      usableHeight / (TILE_H * TARGET_ISO_TILE_SPAN),
    ),
  );
}

function usableViewportCenter(canvas: InitialCameraCanvas): Point {
  return {
    x: canvas.clientWidth / 2,
    y: usableViewportHeight(canvas) / 2,
  };
}

function usableViewportHeight(canvas: InitialCameraCanvas): number {
  const consoleHeight = canvas.clientWidth <= MOBILE_MAX_WIDTH
    ? MOBILE_CONSOLE_HEIGHT
    : DESKTOP_CONSOLE_HEIGHT;
  return Math.max(1, canvas.clientHeight - consoleHeight);
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
