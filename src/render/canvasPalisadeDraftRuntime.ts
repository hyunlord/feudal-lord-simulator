import type { GameState } from "../engine/engine.types";
import { canvasToWorld, type CameraState } from './camera';
import { screenToTile, tileToScreen } from './iso';
import type { TileEdgePoint } from '../world/palisadeGeometry';
import { palisadeFootprintsForState } from "../ui/eraConsoleModel";
import { palisadeCoreFootprintsForState } from '../engine/palisadeFootprints';
import type { TileCoordinate } from "../world/grid";
import type { Point } from "./camera";
import type { DragState } from "./canvasRuntime";
import {
  applyPalisadeIntent,
  dragDraftRunByTiles,
  selectDraftRun,
  type PalisadeDraftState,
} from "./palisadeDraftInteraction";

export type PalisadeDraftDragStart = {
  readonly draft: PalisadeDraftState;
  readonly drag: DragState;
};

export function beginPalisadeDraftDrag(input: {
  readonly button: number;
  readonly hover: TileCoordinate | null;
  readonly draft: PalisadeDraftState | null;
  readonly point: Point;
  readonly camera: CameraState;
  readonly state: GameState;
}): PalisadeDraftDragStart | null {
  if (input.button !== 0 || input.draft === null) return null;
  const vertexIndex = palisadeVertexAtCanvas(input.draft, input.point, input.camera);
  const edgePoint = vertexIndex === null
    ? palisadeEdgePointAtCanvas(input.point, input.camera)
    : input.draft.path[vertexIndex] ?? palisadeEdgePointAtCanvas(input.point, input.camera);
  const endIndex = input.draft.path.length - 1;
  const editableVertex = vertexIndex !== null && (input.draft.candidate !== null
    || (vertexIndex !== 0 && vertexIndex !== endIndex)
    || (endIndex > 2 && sameEdgePoint(input.draft.path[0], input.draft.path[endIndex])));
  if (editableVertex && vertexIndex !== null) {
    const draft = applyPalisadeIntent({ state: input.state, draft: input.draft,
      intent: { type: 'vertexBegin', index: vertexIndex } });
    if (draft === null) return null;
    return { draft, drag: palisadeDrag(input.point) };
  }
  if (input.draft.candidate === null) {
    const draft = applyPalisadeIntent({ state: input.state, draft: input.draft,
      intent: { type: 'strokeBegin', point: edgePoint } });
    if (draft === null || draft.activeGesture !== 'stroke') return null;
    return { draft, drag: palisadeDrag(input.point) };
  }
  if (!nearPalisadeRun(input.draft, input.point, input.camera)) return null;
  return {
    draft: selectDraftRun({
      draft: input.draft,
      point: edgePoint,
    }),
    drag: palisadeDrag(input.point),
  };
}

function sameEdgePoint(a: TileEdgePoint | undefined, b: TileEdgePoint | undefined): boolean {
  return a !== undefined && b !== undefined && a.x === b.x && a.y === b.y;
}

export function advancePalisadeDraftDrag(input: {
  readonly drag: DragState;
  readonly state: GameState;
  readonly draft: PalisadeDraftState | null;
  readonly hover: TileCoordinate | null;
  readonly point: Point;
  readonly camera: CameraState;
}): PalisadeDraftState | null {
  if (input.drag.mode !== 'palisade' || input.draft === null) return null;
  if (input.draft.activeGesture === 'stroke' || input.draft.activeGesture === 'vertex') {
    const next = applyPalisadeIntent({ state: input.state, draft: input.draft,
      intent: { type: input.draft.activeGesture === 'stroke' ? 'strokeMove' : 'vertexMove',
        point: palisadeEdgePointAtCanvas(input.point, input.camera) } });
    return next === input.draft ? null : next;
  }
  if (input.draft.dragStartTile === null || input.hover === null) return null;
  const next = dragDraftRunByTiles({
    grid: input.state,
    draft: input.draft,
    startTile: input.draft.dragStartTile,
    currentTile: input.hover,
    footprints: palisadeFootprintsForState(input.state),
    enclosureFootprints: palisadeCoreFootprintsForState(input.state),
    minimumEnclosureRatio: 1,
  });
  return next === input.draft ? null : next;
}

export function finishPalisadeDraftDrag(state: GameState, draft: PalisadeDraftState | null): PalisadeDraftState | null {
  if (draft === null || draft.activeGesture === null) return draft;
  return applyPalisadeIntent({ state, draft,
    intent: { type: draft.activeGesture === 'stroke' ? 'strokeEnd' : 'vertexEnd' } });
}

export function palisadeEdgePointAtCanvas(point: Point, camera: CameraState): TileEdgePoint {
  const world = canvasToWorld(point, camera);
  const tile = screenToTile(world.x, world.y + 16);
  return { x: Math.round(tile.tx), y: Math.round(tile.ty) };
}

function palisadeDrag(point: Point): DragState {
  return { mode: 'palisade', startCanvasPoint: point, startCamera: null,
    lastCanvasPoint: point, roadStart: null, moved: false };
}

function palisadeVertexAtCanvas(draft: PalisadeDraftState, point: Point, camera: CameraState): number | null {
  const path = draft.candidate?.path ?? draft.path;
  const limit = path.length > 1 && sameEdgePoint(path[0], path[path.length - 1])
    ? path.length - 1 : path.length;
  let selected: number | null = null;
  let best = 12 * 12;
  for (let index = 0; index < limit; index += 1) {
    const vertex = path[index];
    if (vertex === undefined) continue;
    const screen = tileToScreen(vertex.x, vertex.y);
    const dx = screen.sx * camera.zoom + camera.panX - point.x;
    const dy = (screen.sy - 16) * camera.zoom + camera.panY - point.y;
    const distance = dx * dx + dy * dy;
    if (distance >= best) continue;
    selected = index;
    best = distance;
  }
  return selected;
}

function nearPalisadeRun(draft: PalisadeDraftState, point: Point, camera: CameraState): boolean {
  const candidate = draft.candidate;
  if (candidate === null) return false;
  return candidate.runs.some(run => {
    const from = candidate.path[run.startIndex], to = candidate.path[run.endIndex];
    if (from === undefined || to === undefined) return false;
    const a = tileToScreen(from.x, from.y), b = tileToScreen(to.x, to.y);
    const start = { x: a.sx * camera.zoom + camera.panX, y: (a.sy - 16) * camera.zoom + camera.panY };
    const end = { x: b.sx * camera.zoom + camera.panX, y: (b.sy - 16) * camera.zoom + camera.panY };
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = dx * dx + dy * dy;
    const ratio = length === 0 ? 0 : Math.max(0, Math.min(1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
    return (point.x - start.x - ratio * dx) ** 2 + (point.y - start.y - ratio * dy) ** 2 <= 12 * 12;
  });
}
