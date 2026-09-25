import { PALETTE, SEMANTIC_PALETTE } from '../content/palette';
import { A_QUADRUPLE_PRIME_WALL_COPY, palisadeFailureLabel } from '../ui/aQuadruplePrimeWallCopy';
import type { GameState } from '../engine/engine.types';
import type { PalisadeRouteSegment } from '../engine/palisadeRouteAccess';
import { palisadeFootprintsForState, palisadeCoreFootprintsForState } from '../engine/palisadeFootprints';
import { diagnosePalisadeDraft, type PalisadeDraftDiagnosis, type PalisadeFailureReason,
  type PalisadePath, type TileEdgePoint } from '../world/palisadeGeometry';
import type { PalisadeDraftState } from './palisadeDraftInteraction';
import { palisadeScreenPath } from './palisadeRenderGeometry';
import { tileToScreen } from './iso';
import { WALL_CARRY_COPY } from '../ui/wallCarryCopy.ko';
import { applyPaletteStroke, withAlpha } from './style';

const SHORT_FAILURE_LABELS: Partial<Record<PalisadeFailureReason, string>> = A_QUADRUPLE_PRIME_WALL_COPY.shortFailure;

let diagnosisCache: { readonly path: PalisadePath; readonly tiles: GameState['tiles'];
  readonly footprintKey: string; readonly diagnosis: PalisadeDraftDiagnosis } | null = null;

export function palisadeDraftDiagnosis(state: GameState, path: PalisadePath): PalisadeDraftDiagnosis {
  const footprints = palisadeFootprintsForState(state);
  const footprintKey = footprints.map(footprint =>
    `${footprint.id}:${footprint.tx}:${footprint.ty}:${footprint.width}:${footprint.height}`).join('|');
  if (diagnosisCache?.path === path && diagnosisCache.tiles === state.tiles
    && diagnosisCache.footprintKey === footprintKey) return diagnosisCache.diagnosis;
  const diagnosis = diagnosePalisadeDraft(state, path, footprints,
    palisadeCoreFootprintsForState(state), 1);
  diagnosisCache = { path, tiles: state.tiles, footprintKey, diagnosis };
  return diagnosis;
}

export function drawPalisadeDraftOverlay(
  context: CanvasRenderingContext2D,
  state: GameState,
  draft: PalisadeDraftState,
  zoom: number,
  gates: readonly TileEdgePoint[] = [],
  routeSegments: readonly PalisadeRouteSegment[] = [],
  anchorCandidateSiteId: string | null = null,
): void {
  const diagnosis = palisadeDraftDiagnosis(state, draft.path);
  context.save();
  const blockedFootprints = new Set([...draft.affectedFootprintIds,
    ...diagnosis.segments.flatMap(segment => segment.footprintIds)]);
  for (const footprint of palisadeFootprintsForState(state)) {
    if (!blockedFootprints.has(footprint.id) && !diagnosis.outsideFootprintIds.includes(footprint.id)) continue;
    const blocked = blockedFootprints.has(footprint.id);
    tracePath(context, [
      { x: footprint.tx, y: footprint.ty },
      { x: footprint.tx + footprint.width, y: footprint.ty },
      { x: footprint.tx + footprint.width, y: footprint.ty + footprint.height },
      { x: footprint.tx, y: footprint.ty + footprint.height },
      { x: footprint.tx, y: footprint.ty },
    ], false);
    context.fillStyle = withAlpha(blocked ? PALETTE.vermilion : PALETTE.gold, 0.25);
    context.fill();
    applyPaletteStroke(context, blocked ? PALETTE.vermilion : PALETTE.gold, zoom);
    context.lineWidth = 4 / zoom;
    context.stroke();
  }
  let previousFailure: PalisadeFailureReason | null = null;
  for (const segment of diagnosis.segments) {
    if (segment.reason === null) continue;
    tracePath(context, [segment.from, segment.to], true);
    applyPaletteStroke(context, PALETTE.vermilion, zoom);
    context.lineWidth = 7 / zoom;
    context.stroke();
    if (segment.reason !== previousFailure) {
      const anchor = segment.point ?? midpoint(segment.from, segment.to);
      drawFailureTarget(context, anchor, zoom);
      drawFailureLabel(context, anchor, SHORT_FAILURE_LABELS[segment.reason] ?? palisadeFailureLabel(segment.reason), zoom);
    }
    previousFailure = segment.reason;
  }
  if (draft.failurePoint !== null && !diagnosis.segments.some(segment => segment.reason !== null)) {
    drawFailureTarget(context, draft.failurePoint, zoom);
    const reason = draft.failureReason;
    drawFailureLabel(context, draft.failurePoint, reason === null ? A_QUADRUPLE_PRIME_WALL_COPY.recommendationUnavailable
      : SHORT_FAILURE_LABELS[reason] ?? palisadeFailureLabel(reason), zoom);
  }
  for (const gate of gates) drawGatePreview(context, gate, zoom);
  for (const segment of routeSegments) {
    drawRouteStatus(context, segment, zoom);
    if (segment.siteId === anchorCandidateSiteId) {
      const first = segment.path[0], last = segment.path.at(-1);
      if (first !== undefined && last !== undefined) {
        drawFailureLabel(context, midpoint(first, last), WALL_CARRY_COPY.anchorTarget, zoom);
      }
    }
  }
  const selectedRun = draft.selectedRunIndex === null ? undefined : draft.candidate?.runs[draft.selectedRunIndex];
  if (selectedRun !== undefined && draft.candidate !== null) {
    const from = draft.candidate.path[selectedRun.startIndex];
    const to = draft.candidate.path[selectedRun.endIndex];
    if (from !== undefined && to !== undefined) {
      tracePath(context, [from, to], true);
      applyPaletteStroke(context, SEMANTIC_PALETTE.vellum, zoom);
      context.lineWidth = 12 / zoom;
      context.stroke();
      applyPaletteStroke(context, PALETTE.ultramarine, zoom);
      context.lineWidth = 6 / zoom;
      context.stroke();
    }
  }
  for (const vertex of displayVertices(draft.path)) drawVertexHandle(context, vertex, zoom);
  context.restore();
}

function drawFailureTarget(context: CanvasRenderingContext2D, point: TileEdgePoint, zoom: number): void {
  tracePath(context, [point, { x: point.x + 1, y: point.y },
    { x: point.x + 1, y: point.y + 1 }, { x: point.x, y: point.y + 1 }], false);
  context.fillStyle = withAlpha(PALETTE.vermilion, 0.25);
  context.fill();
  applyPaletteStroke(context, PALETTE.vermilion, zoom);
  context.lineWidth = 3 / zoom;
  context.stroke();
}

function displayVertices(path: PalisadePath): readonly TileEdgePoint[] {
  if (path.length <= 2) return path;
  const vertices: TileEdgePoint[] = [path[0]].filter((point): point is TileEdgePoint => point !== undefined);
  for (let index = 1; index < path.length - 1; index += 1) {
    const before = path[index - 1], point = path[index], after = path[index + 1];
    if (before === undefined || point === undefined || after === undefined) continue;
    const incoming = { x: Math.sign(point.x - before.x), y: Math.sign(point.y - before.y) };
    const outgoing = { x: Math.sign(after.x - point.x), y: Math.sign(after.y - point.y) };
    if (incoming.x !== outgoing.x || incoming.y !== outgoing.y) vertices.push(point);
  }
  const last = path[path.length - 1];
  if (last !== undefined && (vertices.length === 0 || vertices[0]?.x !== last.x || vertices[0]?.y !== last.y)) vertices.push(last);
  return vertices;
}

function tracePath(context: CanvasRenderingContext2D, path: PalisadePath, elevated: boolean): void {
  const screen = elevated ? palisadeScreenPath(path) : path.map(point => {
    const screenPoint = tileToScreen(point.x, point.y);
    return { x: screenPoint.sx, y: screenPoint.sy };
  });
  context.beginPath();
  screen.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  if (!elevated) context.closePath();
}

function drawFailureLabel(context: CanvasRenderingContext2D, point: TileEdgePoint, label: string, zoom: number): void {
  const anchor = palisadeScreenPath([point])[0];
  if (anchor === undefined) return;
  const fontSize = 13 / zoom;
  context.font = `bold ${fontSize}px sans-serif`;
  const width = context.measureText(label).width + 16 / zoom;
  const height = 23 / zoom;
  const left = anchor.x - width / 2;
  const top = anchor.y - 35 / zoom;
  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fillRect(left, top, width, height);
  applyPaletteStroke(context, PALETTE.vermilion, zoom);
  context.lineWidth = 2 / zoom;
  context.strokeRect(left, top, width, height);
  context.fillStyle = PALETTE.ink;
  context.fillText(label, left + 8 / zoom, top + 16 / zoom);
}

function drawGatePreview(context: CanvasRenderingContext2D, point: TileEdgePoint, zoom: number): void {
  const anchor = palisadeScreenPath([point])[0];
  if (anchor === undefined) return;
  context.fillStyle = SEMANTIC_PALETTE.vellum;
  applyPaletteStroke(context, PALETTE.gold, zoom);
  context.lineWidth = 3 / zoom;
  context.fillRect(anchor.x - 8 / zoom, anchor.y - 8 / zoom, 16 / zoom, 16 / zoom);
  context.strokeRect(anchor.x - 8 / zoom, anchor.y - 8 / zoom, 16 / zoom, 16 / zoom);
  context.fillStyle = PALETTE.ink;
  context.font = `bold ${12 / zoom}px sans-serif`;
  context.fillText(A_QUADRUPLE_PRIME_WALL_COPY.gateGlyph, anchor.x - 6 / zoom, anchor.y + 4 / zoom);
}

function drawRouteStatus(context: CanvasRenderingContext2D, segment: PalisadeRouteSegment, zoom: number): void {
  const first = segment.path[0], last = segment.path[segment.path.length - 1];
  if (first === undefined || last === undefined) return;
  const anchor = palisadeScreenPath([midpoint(first, last)])[0];
  if (anchor === undefined) return;
  const color = segment.status === 'reachable' ? SEMANTIC_PALETTE.sageDark
    : segment.status === 'unreachable' ? PALETTE.vermilion : PALETTE.gold;
  const label = segment.status === 'reachable' ? A_QUADRUPLE_PRIME_WALL_COPY.routeReachableGlyph
    : segment.status === 'unreachable' ? A_QUADRUPLE_PRIME_WALL_COPY.routeUnreachableGlyph
      : A_QUADRUPLE_PRIME_WALL_COPY.routeUnavailableGlyph;
  context.beginPath();
  context.arc(anchor.x, anchor.y - 13 / zoom, 9 / zoom, 0, Math.PI * 2);
  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fill();
  applyPaletteStroke(context, color, zoom);
  context.lineWidth = 2 / zoom;
  context.stroke();
  context.fillStyle = color;
  context.font = `bold ${12 / zoom}px sans-serif`;
  context.fillText(label, anchor.x - 5 / zoom, anchor.y - 9 / zoom);
}

function drawVertexHandle(context: CanvasRenderingContext2D, point: TileEdgePoint, zoom: number): void {
  const anchor = palisadeScreenPath([point])[0];
  if (anchor === undefined) return;
  context.beginPath();
  context.arc(anchor.x, anchor.y, 6 / zoom, 0, Math.PI * 2);
  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fill();
  applyPaletteStroke(context, PALETTE.gold, zoom);
  context.lineWidth = 2 / zoom;
  context.stroke();
}

function midpoint(a: TileEdgePoint, b: TileEdgePoint): TileEdgePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
