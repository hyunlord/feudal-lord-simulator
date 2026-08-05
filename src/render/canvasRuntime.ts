import type { GameState } from "../engine/engine.types";
import { clampPan, type CameraState, type Point } from "./camera";
import { worldBounds } from "./interactions";

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
  canvas: Pick<HTMLCanvasElement, "clientWidth" | "clientHeight">,
  state: Pick<GameState, "width" | "height">,
): CameraState {
  return clampPan(
    { zoom: 1, panX: canvas.clientWidth / 2, panY: 80 },
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
