import type { Dispatch, RefObject, SetStateAction } from "react";

import type { GameState, OverlayMode } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import type { HoveredBuilding } from "./BuildingInspector";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import type { PalisadeDraftState } from "./palisadeDraftInteraction";
import type { PlacementTool } from "./renderer";
import type { AnchoredWorldSelection } from "./worldSelection";
import { clampPan, type CameraState, type Point, type ViewportBounds, type WorldBounds } from "./camera";
import type { DragState } from "./canvasRuntime";

export type GameCanvasRuntimeInput = {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly state: GameState;
  readonly previousRenderState: Pick<GameState, "constructionSites" | "walkers">;
  readonly interpolationAlpha: () => number;
  readonly dispatch: Dispatch<GameAction>;
  readonly selectedTool: PlacementTool | null;
  readonly overlayMode: OverlayMode;
  readonly setHoveredBuilding: Dispatch<SetStateAction<HoveredBuilding | null>>;
  readonly selection: AnchoredWorldSelection | null;
  readonly setSelection: Dispatch<SetStateAction<AnchoredWorldSelection | null>>;
  readonly highlightedHouseIds: readonly string[];
  readonly palisadeDraft?: PalisadeDraftState | null;
  readonly houseMaterialWave?: HouseMaterialWave | null;
  readonly palisadeCeremonyStartedAtMs?: number | null;
  readonly onPalisadeDraftChange?: Dispatch<SetStateAction<PalisadeDraftState | null>> | undefined;
  readonly onPalisadeDraftCancel?: (() => void) | undefined;
};

const CAMERA_DRAG_THRESHOLD_PX = 4;
const EDGE_PAN_MARGIN_PX = 20;
const KEY_PAN_RAMP_MS = 400;
const KEY_PAN_DECAY_MS = 300;
const KEY_PAN_START_TILES_PER_SECOND = 8;
const KEY_PAN_MAX_TILES_PER_SECOND = 24;
const EDGE_PAN_TILES_PER_SECOND = 12;
const CAMERA_TILE_PX = 64;

export type CameraInputState = {
  readonly pressedKeys: Set<string>;
  keyboardPanStartedAtMs: number | null;
  keyboardReleaseAtMs: number | null;
  keyboardReleaseVelocity: Point;
  edgePoint: Point | null;
};

export type CameraMotionInput = Readonly<{
  input: CameraInputState;
  camera: CameraState;
  nowMs: number;
  previousMs: number;
  viewport: ViewportBounds;
  world: WorldBounds;
}>;

export function cameraDragThresholdExceeded(start: Point, current: Point): boolean {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return dx * dx + dy * dy > CAMERA_DRAG_THRESHOLD_PX * CAMERA_DRAG_THRESHOLD_PX;
}

export function createCameraInputState(): CameraInputState {
  return {
    pressedKeys: new Set<string>(),
    keyboardPanStartedAtMs: null,
    keyboardReleaseAtMs: null,
    keyboardReleaseVelocity: { x: 0, y: 0 },
    edgePoint: null,
  };
}

export function cameraInputKeyDown(state: CameraInputState, key: string, nowMs: number): boolean {
  if (!isCameraPanKey(key)) return false;
  if (state.pressedKeys.size === 0) {
    state.keyboardPanStartedAtMs = nowMs;
  }
  state.pressedKeys.add(key);
  state.keyboardReleaseAtMs = null;
  state.keyboardReleaseVelocity = { x: 0, y: 0 };
  return true;
}

export function cameraInputKeyUp(state: CameraInputState, key: string, nowMs: number): boolean {
  if (!isCameraPanKey(key)) return false;
  state.keyboardReleaseVelocity = keyboardVelocityAt(state, nowMs);
  state.pressedKeys.delete(key);
  if (state.pressedKeys.size === 0) {
    state.keyboardPanStartedAtMs = null;
    state.keyboardReleaseAtMs = nowMs;
  }
  return true;
}

export function updateCameraEdgePoint(state: CameraInputState, point: Point | null): void {
  state.edgePoint = point;
}

export function resetCameraInputState(state: CameraInputState): void {
  state.pressedKeys.clear();
  state.keyboardPanStartedAtMs = null;
  state.keyboardReleaseAtMs = null;
  state.keyboardReleaseVelocity = { x: 0, y: 0 };
  state.edgePoint = null;
}

export function shouldAdvanceCameraMotion(drag: Pick<DragState, "mode">): boolean {
  return drag.mode !== "pan";
}

export function advanceCameraMotion(input: CameraMotionInput): CameraState {
  const delta = addPoint(
    keyboardDelta(input.input, input.previousMs, input.nowMs),
    addPoint(
      keyboardReleaseDelta(input.input, input.previousMs, input.nowMs),
      edgePanDelta(input.input.edgePoint, input.viewport, input.previousMs, input.nowMs),
    ),
  );
  if (delta.x === 0 && delta.y === 0) return input.camera;
  return clampPan(
    {
      zoom: input.camera.zoom,
      panX: input.camera.panX + delta.x,
      panY: input.camera.panY + delta.y,
    },
    input.viewport,
    input.world,
  );
}

function keyboardDelta(state: CameraInputState, previousMs: number, nowMs: number): Point {
  if (state.keyboardPanStartedAtMs === null || state.pressedKeys.size === 0) return { x: 0, y: 0 };
  const seconds = (nowMs - previousMs) / 1_000;
  const speed = averageKeyboardSpeed(state.keyboardPanStartedAtMs, previousMs, nowMs);
  return scalePoint(normalizedKeyboardDirection(state.pressedKeys), speed * CAMERA_TILE_PX * seconds);
}

function keyboardReleaseDelta(state: CameraInputState, previousMs: number, nowMs: number): Point {
  if (state.keyboardReleaseAtMs === null) return { x: 0, y: 0 };
  const decayEndMs = state.keyboardReleaseAtMs + KEY_PAN_DECAY_MS;
  const startMs = Math.max(previousMs, state.keyboardReleaseAtMs);
  const endMs = Math.min(nowMs, decayEndMs);
  if (startMs >= endMs) return { x: 0, y: 0 };
  const startFactor = 1 - (startMs - state.keyboardReleaseAtMs) / KEY_PAN_DECAY_MS;
  const endFactor = 1 - (endMs - state.keyboardReleaseAtMs) / KEY_PAN_DECAY_MS;
  return scalePoint(state.keyboardReleaseVelocity, ((startFactor + endFactor) / 2) * ((endMs - startMs) / 1_000));
}

function edgePanDelta(point: Point | null, viewport: ViewportBounds, previousMs: number, nowMs: number): Point {
  if (point === null) return { x: 0, y: 0 };
  const direction = {
    x: point.x <= EDGE_PAN_MARGIN_PX ? 1 : point.x >= viewport.width - EDGE_PAN_MARGIN_PX ? -1 : 0,
    y: point.y <= EDGE_PAN_MARGIN_PX ? 1 : point.y >= viewport.height - EDGE_PAN_MARGIN_PX ? -1 : 0,
  };
  return scalePoint(
    normalizePoint(direction),
    EDGE_PAN_TILES_PER_SECOND * CAMERA_TILE_PX * ((nowMs - previousMs) / 1_000),
  );
}

function keyboardVelocityAt(state: CameraInputState, nowMs: number): Point {
  if (state.keyboardPanStartedAtMs === null || state.pressedKeys.size === 0) return { x: 0, y: 0 };
  return scalePoint(
    normalizedKeyboardDirection(state.pressedKeys),
    keyboardSpeedAt(state.keyboardPanStartedAtMs, nowMs) * CAMERA_TILE_PX,
  );
}

function averageKeyboardSpeed(startedAtMs: number, previousMs: number, nowMs: number): number {
  return (keyboardSpeedAt(startedAtMs, previousMs) + keyboardSpeedAt(startedAtMs, nowMs)) / 2;
}

function keyboardSpeedAt(startedAtMs: number, nowMs: number): number {
  const progress = Math.min(1, Math.max(0, (nowMs - startedAtMs) / KEY_PAN_RAMP_MS));
  return KEY_PAN_START_TILES_PER_SECOND
    + (KEY_PAN_MAX_TILES_PER_SECOND - KEY_PAN_START_TILES_PER_SECOND) * progress;
}

function normalizedKeyboardDirection(keys: ReadonlySet<string>): Point {
  let x = 0;
  let y = 0;
  for (const key of keys) {
    const direction = keyDirection(key);
    x += direction.x;
    y += direction.y;
  }
  return normalizePoint({ x, y });
}

function keyDirection(key: string): Point {
  switch (key) {
    case "a":
    case "ArrowLeft":
      return { x: 1, y: 0 };
    case "d":
    case "ArrowRight":
      return { x: -1, y: 0 };
    case "w":
    case "ArrowUp":
      return { x: 0, y: 1 };
    case "s":
    case "ArrowDown":
      return { x: 0, y: -1 };
    default:
      return { x: 0, y: 0 };
  }
}

function isCameraPanKey(key: string): boolean {
  return keyDirection(key).x !== 0 || keyDirection(key).y !== 0;
}

function normalizePoint(point: Point): Point {
  const length = Math.hypot(point.x, point.y);
  return length === 0 ? { x: 0, y: 0 } : { x: point.x / length, y: point.y / length };
}

function scalePoint(point: Point, scale: number): Point {
  return { x: point.x * scale, y: point.y * scale };
}

function addPoint(left: Point, right: Point): Point {
  return { x: left.x + right.x, y: left.y + right.y };
}
