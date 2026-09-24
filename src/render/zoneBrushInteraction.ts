import { ZONE_STROKE_LIMITS } from "../content/zoneConfig";
import type { GameAction } from "../state/gameStore.types";
import type { GameState } from "../engine/engine.types";
import { ZONE_KIND_LABELS } from "../zones/zoneCopy.ko";
import { zonePaintAssessment } from "../zones/zoneEdits";
import { normalizeZoneStroke, rasterizeZoneStroke } from "../zones/zoneRaster";
import type { ZoneKind, ZoneStroke, ZoneStrokePoint } from "../zones/zone.types";
import { ZONE_BRUSH_COPY } from "./zoneBrushCopy.ko";

// Zone brush input (C1b). The canvas turns pointer input into intents; this reducer turns intents into the gesture
// being drawn and, when a gesture ends, one `zone_paint` / `zone_erase` action. It never edits zones itself: the
// reducer applies exactly what `zonePaintAssessment` previews (B5 Z-5/Z-9), so the preview and the result agree.
//  - brush: drag = one stroke (the reducer rasterises the swept disc); a click is a single dab.
//  - polygon: click = vertex, double-click (or clicking the first vertex) = close.
//  - Strokes longer than the 256-point limit are sent in pieces while the drag goes on.
// Points are tile-edge space (cell (tx,ty) spans [tx,tx+1), the ZoneStroke convention).

export type ZoneBrushTarget = ZoneKind | "erase";
export type ZoneBrushTool = {
  readonly target: ZoneBrushTarget;
  /** Brush radius in tiles (1..3). */
  readonly radius: number;
  /** Plain clicks place polygon vertices (the Shift modifier does the same for one click). */
  readonly polygon: boolean;
};

export const ZONE_BRUSH_RADII = [1, 2, 3] as const;
export const DEFAULT_ZONE_BRUSH_RADIUS = 2;
/** New brush points closer than this (tiles) to the previous one are dropped. */
const POINT_SPACING = 0.25;
const MAX_POINTS = ZONE_STROKE_LIMITS.maxPoints;

export type ZoneBrushGesture =
  | { readonly mode: "brush"; readonly points: readonly ZoneStrokePoint[] }
  | { readonly mode: "polygon"; readonly points: readonly ZoneStrokePoint[] };

export type ZoneBrushIntent =
  | { readonly type: "strokeBegin" | "strokeMove"; readonly point: ZoneStrokePoint }
  | { readonly type: "strokeEnd" }
  | { readonly type: "polygonPoint"; readonly point: ZoneStrokePoint }
  | { readonly type: "polygonClose" }
  | { readonly type: "cancel" };

export type ZoneBrushOutcome = {
  readonly gesture: ZoneBrushGesture | null;
  readonly action: GameAction | null;
  /** Player feedback for a finished or refused gesture. */
  readonly message: { readonly kind: "success" | "failure"; readonly text: string } | null;
};

export function applyZoneBrushIntent(input: {
  readonly state: GameState;
  readonly tool: ZoneBrushTool;
  readonly gesture: ZoneBrushGesture | null;
  readonly intent: ZoneBrushIntent;
}): ZoneBrushOutcome {
  const { state, tool, gesture, intent } = input;
  const idle = (next: ZoneBrushGesture | null = gesture): ZoneBrushOutcome => ({ gesture: next, action: null, message: null });
  switch (intent.type) {
    case "cancel":
      return { gesture: null, action: null, message: null };
    case "strokeBegin":
      return idle({ mode: "brush", points: [intent.point] });
    case "strokeMove": {
      if (gesture?.mode !== "brush") return idle();
      const last = gesture.points[gesture.points.length - 1];
      if (last !== undefined && Math.hypot(intent.point.x - last.x, intent.point.y - last.y) < POINT_SPACING) return idle();
      if (gesture.points.length < MAX_POINTS) return idle({ mode: "brush", points: [...gesture.points, intent.point] });
      // Full: send this piece and carry on from its last point.
      const finished = finishStroke(state, tool, { tool: "brush", points: gesture.points, radius: tool.radius });
      return { ...finished, gesture: { mode: "brush", points: [gesture.points[gesture.points.length - 1] as ZoneStrokePoint, intent.point] } };
    }
    case "strokeEnd":
      if (gesture?.mode !== "brush") return idle();
      return finishStroke(state, tool, { tool: "brush", points: gesture.points, radius: tool.radius });
    case "polygonPoint": {
      const points = gesture?.mode === "polygon" ? gesture.points : [];
      const first = points[0];
      if (first !== undefined && points.length >= 3 && Math.hypot(intent.point.x - first.x, intent.point.y - first.y) < 0.5) {
        return finishStroke(state, tool, { tool: "polygon", points });
      }
      const last = points[points.length - 1];
      if (last !== undefined && Math.hypot(intent.point.x - last.x, intent.point.y - last.y) < 0.125) return idle();
      if (points.length >= MAX_POINTS) return idle();
      return idle({ mode: "polygon", points: [...points, intent.point] });
    }
    case "polygonClose":
      if (gesture?.mode !== "polygon" || gesture.points.length < 3) return idle();
      return finishStroke(state, tool, { tool: "polygon", points: gesture.points });
  }
}

function finishStroke(state: GameState, tool: ZoneBrushTool, stroke: ZoneStroke): ZoneBrushOutcome {
  if (tool.target === "erase") {
    const normalized = normalizeZoneStroke(stroke);
    const cells = normalized === null ? [] : rasterizeZoneStroke(normalized, state);
    const owned = new Set((state.zones ?? []).flatMap(zone => zone.membership));
    const erased = cells.filter(cell => owned.has(cell)).length;
    if (normalized === null || erased === 0) return { gesture: null, action: null, message: { kind: "failure", text: ZONE_BRUSH_COPY.nothingToErase } };
    return { gesture: null, action: { type: "zone_erase", stroke: normalized }, message: { kind: "success", text: ZONE_BRUSH_COPY.erased(erased) } };
  }
  const assessment = zonePaintAssessment(state, tool.target, stroke);
  if (!assessment.ok) {
    return { gesture: null, action: null,
      message: assessment.reason === "arable_inside_wall" ? { kind: "failure", text: ZONE_BRUSH_COPY.rejected } : null };
  }
  return { gesture: null, action: { type: "zone_paint", kind: tool.target, stroke: assessment.stroke },
    message: { kind: "success", text: ZONE_BRUSH_COPY.painted(ZONE_KIND_LABELS[tool.target], assessment.cells.length) } };
}

/** The stroke the gesture would send now (preview), or null. */
export function gestureStroke(tool: ZoneBrushTool, gesture: ZoneBrushGesture | null, hover: ZoneStrokePoint | null): ZoneStroke | null {
  if (gesture === null) return hover === null || tool.polygon ? null : { tool: "brush", points: [hover], radius: tool.radius };
  if (gesture.mode === "brush") return { tool: "brush", points: gesture.points, radius: tool.radius };
  const points = hover === null ? gesture.points : [...gesture.points, hover];
  return points.length >= 3 ? { tool: "polygon", points } : null;
}

export function nextBrushRadius(radius: number, step: 1 | -1): number {
  return Math.max(1, Math.min(3, Math.round(radius) + step));
}
