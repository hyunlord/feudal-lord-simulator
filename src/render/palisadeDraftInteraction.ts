import {
  diagnosePalisadeDraft,
  dragPalisadeRun,
  snapPalisadeStroke,
  type PalisadeFailureReason,
  type PalisadeFootprint,
  type PalisadePath,
  type TileEdgePoint,
  type ValidPalisadeCandidate,
} from "../world/palisadeGeometry";
import type { Grid, TileCoordinate } from "../world/grid";
import type { GameState } from '../engine/engine.types';
import { palisadeFootprintsForState, palisadeCoreFootprintsForState } from '../engine/palisadeFootprints';

export type PalisadeDraftState = {
  readonly status: "editing";
  readonly mode: 'draw' | 'edit';
  readonly path: PalisadePath;
  readonly candidate: ValidPalisadeCandidate | null;
  readonly strokes: readonly PalisadePath[];
  readonly selectedRunIndex: number | null;
  readonly selectedVertexIndex: number | null;
  readonly dragStartTile: TileCoordinate | null;
  readonly failureReason: PalisadeFailureReason | null;
  readonly failurePoint: TileEdgePoint | null;
  readonly affectedFootprintIds: readonly string[];
  readonly activeGesture: 'stroke' | 'vertex' | null;
  readonly gestureBasePath: PalisadePath | null;
  readonly gestureEnd: 'start' | 'end' | null;
  readonly gesturePoint: TileEdgePoint | null;
};

export function initialOpenPalisadeDraft(): PalisadeDraftState {
  return {
    status: 'editing', mode: 'draw', path: [], candidate: null, strokes: [],
    selectedRunIndex: null, selectedVertexIndex: null, dragStartTile: null,
    failureReason: 'open_polygon', activeGesture: null, gestureBasePath: null, gestureEnd: null,
    failurePoint: null, affectedFootprintIds: [],
    gesturePoint: null,
  };
}

export function initialPalisadeDraft(candidate: ValidPalisadeCandidate): PalisadeDraftState {
  return {
    ...initialOpenPalisadeDraft(), mode: 'edit', path: candidate.path, candidate, failureReason: null,
  };
}

export type PalisadeDraftIntent =
  | { readonly type: 'strokeBegin' | 'strokeMove'; readonly point: TileEdgePoint }
  | { readonly type: 'strokeEnd' | 'cancel' | 'undo' | 'vertexEnd' }
  | { readonly type: 'vertexBegin'; readonly index: number }
  | { readonly type: 'vertexMove'; readonly point: TileEdgePoint }
  | { readonly type: 'eraseSegment'; readonly index: number };

export function applyPalisadeIntent(input: {
  readonly state: GameState;
  readonly draft: PalisadeDraftState;
  readonly intent: PalisadeDraftIntent;
}): PalisadeDraftState | null {
  const { state, draft, intent } = input;
  switch (intent.type) {
    case 'strokeBegin': {
      if (draft.activeGesture !== null || draft.candidate !== null) return draft;
      const point = integerPoint(intent.point);
      const first = draft.path[0], last = draft.path[draft.path.length - 1];
      const end = first === undefined || last === undefined || samePoint(last, point) ? 'end'
        : samePoint(first, point) ? 'start' : null;
      if (end === null) return draft;
      return { ...draft, path: first === undefined ? [point] : draft.path,
        activeGesture: 'stroke', gestureBasePath: draft.path, gestureEnd: end, gesturePoint: point,
        selectedRunIndex: null, selectedVertexIndex: null };
    }
    case 'strokeMove': {
      if (draft.activeGesture !== 'stroke' || draft.gestureBasePath === null || draft.gestureEnd === null) return draft;
      const point = integerPoint(intent.point);
      if (draft.gesturePoint !== null && samePoint(draft.gesturePoint, point)) return draft;
      const base = draft.gestureBasePath;
      const anchor = draft.gestureEnd === 'end' ? base[base.length - 1] : base[0];
      const start = anchor ?? draft.path[0];
      if (start === undefined) return draft;
      const stroke = snapPalisadeStroke(start, point);
      const path = draft.gestureEnd === 'end'
        ? [...(base.length === 0 ? [start] : base), ...stroke.slice(1)]
        : [...stroke.slice(1).reverse(), ...base];
      return samePath(path, draft.path) ? draft : validatePath(state, { ...draft, path, mode: 'draw', gesturePoint: point });
    }
    case 'strokeEnd': {
      if (draft.activeGesture !== 'stroke' || draft.gestureBasePath === null) return draft;
      return { ...draft, path: draft.candidate?.path ?? draft.path,
        strokes: samePath(draft.path, draft.gestureBasePath)
        ? draft.strokes : [...draft.strokes, draft.gestureBasePath],
      activeGesture: null, gestureBasePath: null, gestureEnd: null, gesturePoint: null };
    }
    case 'vertexBegin':
      if (draft.activeGesture !== null || intent.index < 0 || intent.index >= draft.path.length) return draft;
      return { ...draft, selectedVertexIndex: intent.index, activeGesture: 'vertex',
        gestureBasePath: draft.path, gestureEnd: null, gesturePoint: draft.path[intent.index] ?? null };
    case 'vertexMove': {
      if (draft.activeGesture !== 'vertex' || draft.gestureBasePath === null || draft.selectedVertexIndex === null) return draft;
      const source = draft.gestureBasePath, index = draft.selectedVertexIndex, point = integerPoint(intent.point);
      if (draft.gesturePoint !== null && samePoint(draft.gesturePoint, point)) return draft;
      if (samePoint(source[index] ?? point, point)) return draft;
      const vertices = source.map((vertex, vertexIndex) => vertexIndex === index
        || (index === 0 && vertexIndex === source.length - 1)
        || (index === source.length - 1 && vertexIndex === 0) ? point : vertex);
      const path = routedVertices(vertices);
      return samePath(path, draft.path) ? draft : validatePath(state, { ...draft, path, mode: 'edit', gesturePoint: point });
    }
    case 'vertexEnd': {
      if (draft.activeGesture !== 'vertex' || draft.gestureBasePath === null) return draft;
      return { ...draft, path: draft.candidate?.path ?? draft.path,
        strokes: samePath(draft.path, draft.gestureBasePath)
        ? draft.strokes : [...draft.strokes, draft.gestureBasePath],
        activeGesture: null, gestureBasePath: null, gestureEnd: null, gesturePoint: null, selectedVertexIndex: null };
    }
    case 'eraseSegment': {
      const run = draft.candidate?.runs[intent.index];
      if (run === undefined || draft.candidate === null) return draft;
      const path = [...draft.candidate.path.slice(run.endIndex, -1),
        ...draft.candidate.path.slice(0, run.startIndex + 1)];
      return validatePath(state, { ...draft, path, mode: 'draw', strokes: [...draft.strokes, draft.path],
        selectedRunIndex: null, selectedVertexIndex: null });
    }
    case 'undo':
    case 'cancel': {
      if (draft.gestureBasePath !== null) return validatePath(state, { ...draft, path: draft.gestureBasePath,
        activeGesture: null, gestureBasePath: null, gestureEnd: null, gesturePoint: null, selectedVertexIndex: null });
      const previous = draft.strokes[draft.strokes.length - 1];
      if (previous !== undefined) return validatePath(state, { ...draft, path: previous,
        mode: 'draw', strokes: draft.strokes.slice(0, -1), selectedRunIndex: null, selectedVertexIndex: null });
      if (intent.type === 'undo') return draft;
      return draft.path.length > 0 ? initialOpenPalisadeDraft() : null;
    }
  }
}

function validatePath(state: GameState, draft: PalisadeDraftState): PalisadeDraftState {
  const diagnosis = diagnosePalisadeDraft(state, draft.path,
    palisadeFootprintsForState(state), palisadeCoreFootprintsForState(state), 1);
  return diagnosis.validation.ok
    ? { ...draft, candidate: diagnosis.validation.candidate,
      path: draft.activeGesture === null ? diagnosis.validation.candidate.path : draft.path,
      failureReason: null, failurePoint: null, affectedFootprintIds: [] }
    : { ...draft, candidate: null, failureReason: diagnosis.validation.reason,
      failurePoint: diagnosis.segments.find(segment => segment.reason !== null)?.point ?? null,
      affectedFootprintIds: diagnosis.segments.flatMap(segment => segment.footprintIds) };
}

function routedVertices(vertices: PalisadePath): PalisadePath {
  const result: TileEdgePoint[] = [];
  for (let index = 1; index < vertices.length; index += 1) {
    const from = vertices[index - 1], to = vertices[index];
    if (from === undefined || to === undefined) continue;
    const segment = snapPalisadeStroke(from, to);
    result.push(...(result.length === 0 ? segment : segment.slice(1)));
  }
  return result;
}

function integerPoint(point: TileEdgePoint): TileEdgePoint {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

function samePoint(a: TileEdgePoint, b: TileEdgePoint): boolean {
  return a.x === b.x && a.y === b.y;
}

function samePath(a: PalisadePath, b: PalisadePath): boolean {
  return a.length === b.length && a.every((point, index) =>
    b[index] !== undefined && samePoint(point, b[index]));
}

export function selectPalisadeRunAtPoint(
  candidate: ValidPalisadeCandidate,
  point: TileEdgePoint,
): number | null {
  let bestIndex: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  candidate.runs.forEach((run, index) => {
    const start = candidate.path[run.startIndex];
    const end = candidate.path[run.endIndex];
    if (start === undefined || end === undefined) return;
    const distance = pointToSegmentDistanceSquared(point, start, end);
    if (distance < bestDistance || (distance === bestDistance && (bestIndex === null || index < bestIndex))) {
      bestIndex = index;
      bestDistance = distance;
    }
  });
  return bestIndex;
}

export function selectDraftRun(input: {
  readonly draft: PalisadeDraftState;
  readonly point: TileEdgePoint;
}): PalisadeDraftState {
  return {
    ...input.draft,
    selectedRunIndex: input.draft.candidate === null ? null : selectPalisadeRunAtPoint(input.draft.candidate, input.point),
    dragStartTile: { tx: input.point.x, ty: input.point.y },
    failureReason: null,
  };
}

export function dragDraftRunByTiles(input: {
  readonly grid: Grid;
  readonly draft: PalisadeDraftState;
  readonly startTile: TileCoordinate;
  readonly currentTile: TileCoordinate;
  readonly footprints: readonly PalisadeFootprint[];
  readonly enclosureFootprints?: readonly PalisadeFootprint[];
  readonly minimumEnclosureRatio?: number;
}): PalisadeDraftState {
  if (input.draft.selectedRunIndex === null || input.draft.candidate === null) return input.draft;
  const run = input.draft.candidate.runs[input.draft.selectedRunIndex];
  if (run === undefined) return input.draft;
  const deltaX = input.currentTile.tx - input.startTile.tx;
  const deltaY = input.currentTile.ty - input.startTile.ty;
  const normalMagnitude = Math.max(Math.abs(run.normal.x), Math.abs(run.normal.y), 1);
  const wholeSteps = Math.trunc((deltaX * run.normal.x + deltaY * run.normal.y) / normalMagnitude);
  if (wholeSteps === 0) return input.draft;
  const result = dragPalisadeRun(
    input.grid,
    input.draft.candidate,
    input.draft.selectedRunIndex,
    wholeSteps,
    input.footprints,
    input.enclosureFootprints,
    input.minimumEnclosureRatio,
  );
  if (!result.ok) {
    return {
      ...input.draft,
      dragStartTile: input.currentTile,
      failureReason: result.reason,
    };
  }
  return {
    ...input.draft,
    candidate: result.candidate,
    path: result.candidate.path,
    strokes: [...input.draft.strokes, input.draft.path],
    dragStartTile: input.currentTile,
    failureReason: null,
  };
}

function pointToSegmentDistanceSquared(
  point: TileEdgePoint,
  start: TileEdgePoint,
  end: TileEdgePoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projectedX = start.x + ratio * dx;
  const projectedY = start.y + ratio * dy;
  return (point.x - projectedX) ** 2 + (point.y - projectedY) ** 2;
}
