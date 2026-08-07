import {
  dragPalisadeRun,
  type PalisadeFailureReason,
  type PalisadeFootprint,
  type TileEdgePoint,
  type ValidPalisadeCandidate,
} from "../world/palisadeGeometry";
import type { Grid, TileCoordinate } from "../world/grid";

export type PalisadeDraftState = {
  readonly status: "editing";
  readonly candidate: ValidPalisadeCandidate;
  readonly selectedRunIndex: number | null;
  readonly dragStartTile: TileCoordinate | null;
  readonly failureReason: PalisadeFailureReason | null;
};

export function initialPalisadeDraft(candidate: ValidPalisadeCandidate): PalisadeDraftState {
  return {
    status: "editing",
    candidate,
    selectedRunIndex: null,
    dragStartTile: null,
    failureReason: null,
  };
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
    selectedRunIndex: selectPalisadeRunAtPoint(input.draft.candidate, input.point),
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
}): PalisadeDraftState {
  if (input.draft.selectedRunIndex === null) return input.draft;
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
