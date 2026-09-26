import { PALETTE, RAMPS } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import type { PredictionLine } from "../ui/predictionTypes";
import { zonePaintLines } from "../ui/zonePrediction";
import { cellInsideWall, zonePaintAssessment } from "../zones/zoneEdits";
import { normalizeZoneStroke, rasterizeZoneStroke } from "../zones/zoneRaster";
import { ZONE_KIND_CONFIG } from "../content/zoneConfig";
import { ARABLE_CONFIG } from "../content/arableConfig";
import type { ZoneStrokePoint } from "../zones/zone.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import type { Building } from "../content/buildingConfig";
import { tileToScreen } from "./iso";
import { ZONE_BRUSH_COPY } from "./zoneBrushCopy.ko";
import { applyPaletteStroke, withAlpha } from "./style";
import { gestureStroke, type ZoneBrushGesture, type ZoneBrushTool } from "./zoneBrushInteraction";
import { ZONE_STYLES } from "./drawZones";
import { drawPaintableLand } from "./zonePaintableLand";

// Live preview while a zone tool is armed (C1b): the cells the gesture would take, tinted by kind; for a refused
// arable stroke the cells inside the wall in red and the rest pale; for the eraser the owned cells it would clear.
// Plus the brush ring under the cursor and the open polygon. Drawn every frame outside the chunk cache.
// C1d: with the tool only armed (no stroke or polygon under way) just the cursor ring shows: no cell tint and no
// prediction text until the drag starts. An arable stroke also hatches the cells a wheat farm there could not reach a
// road from, and says how many ("도로 접근 없는 칸 N"), judged by the rules' own road access (buildingRoadAccessTiles).
//
// Cache (AGENTS rule 10): the last assessment, keyed by the state's zones, palisade and tiles objects (tiles since C1d:
// the road-access count reads roads), the tool, the gesture object (replaced on every accepted point) and the hover
// point rounded to 1/8 tile. Rasterising a long
// stroke costs ~0.1-0.5 ms, so it runs once per change, not once per frame.

export type ZoneBrushView = {
  readonly tool: ZoneBrushTool;
  readonly gesture: ZoneBrushGesture | null;
  /** Pointer position in tile-edge space. */
  readonly hover: ZoneStrokePoint | null;
};

type Preview = { readonly cells: readonly number[]; readonly refused: ReadonlySet<number>; readonly noRoad: ReadonlySet<number>;
  /** The stroke would paint nothing (wholly inside the wall): its cells show pale and the ring red. */
  readonly blocked: boolean; readonly lines: readonly PredictionLine[] };
const EMPTY: Preview = { cells: [], refused: new Set(), noRoad: new Set(), blocked: false, lines: [] };
let last: { readonly key: readonly unknown[]; readonly preview: Preview } | null = null;

export function zoneBrushPreview(state: GameState, view: ZoneBrushView): Preview {
  const hoverKey = view.hover === null ? null : `${Math.round(view.hover.x * 8)},${Math.round(view.hover.y * 8)}`;
  const key = [state.zones, state.palisade, state.tiles, state.width, view.tool.target, view.tool.radius, view.tool.polygon, view.gesture, hoverKey];
  if (last !== null && last.key.length === key.length && last.key.every((value, index) => value === key[index])) return last.preview;
  const stroke = view.gesture === null ? null : gestureStroke(view.tool, view.gesture, view.hover);
  let preview: Preview = EMPTY;
  if (stroke !== null) {
    if (view.tool.target === "erase") {
      const normalized = normalizeZoneStroke(stroke);
      const owned = new Set((state.zones ?? []).flatMap(zone => zone.membership));
      preview = { ...EMPTY, cells: normalized === null ? [] : rasterizeZoneStroke(normalized, state).filter(cell => owned.has(cell)) };
    } else {
      const assessment = zonePaintAssessment(state, view.tool.target, stroke);
      // A kind barred inside the wall (arable): the stroke's cells inside it show red, the rest as they will be
      // painted (C1c rule Z-9a keeps the outside cells of a stroke that crosses the wall; a stroke wholly inside is
      // refused, and then every cell is red).
      const normalized = ZONE_KIND_CONFIG[view.tool.target].forbiddenInsideWall ? normalizeZoneStroke(stroke) : null;
      const raster = normalized === null ? assessment.cells : rasterizeZoneStroke(normalized, state);
      const refused = new Set(normalized === null ? [] : raster.filter(cell => cellInsideWall(state, cell)));
      const painted = assessment.ok ? assessment.cells : [];
      const noRoad = view.tool.target === "arable" ? cellsWithoutRoadAccess(state, painted) : new Set<number>();
      const lines = zonePaintLines(state, view.tool.target, stroke);
      preview = { cells: raster, refused, noRoad, blocked: !assessment.ok,
        lines: noRoad.size === 0 ? lines : [...lines, { id: "zone-road-access", severity: "warn", text: ZONE_BRUSH_COPY.noRoadAccessCells(noRoad.size), sources: [] }] };
    }
  }
  last = { key, preview };
  return preview;
}

/**
 * Cells no road-connected farmstead could tend (C1f; before, the test was a 2x2 wheat farm over the cell, a building
 * C1c-2 retired): arable strips are worked from a farmstead within ARABLE_CONFIG.tendRadius (Manhattan, as the rules'
 * stripTending), and a farmstead without road access leaves them untended (`farmstead_no_road`). A cell is counted
 * when no 1x1 farmstead spot within that radius has road access by the rules' own test (read only; the rules decide
 * nothing here, and placement terrain is not checked, as before).
 */
function cellsWithoutRoadAccess(state: GameState, cells: readonly number[]): Set<number> {
  const reach = new Map<number, boolean>();
  const farmsteadReaches = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
    const key = ty * state.width + tx;
    let value = reach.get(key);
    if (value === undefined) {
      const farmstead = { id: "zone-preview-farmstead", kind: "farmstead", tx, ty } as Building;
      value = buildingRoadAccessTiles(state, farmstead).length > 0;
      reach.set(key, value);
    }
    return value;
  };
  const radius = ARABLE_CONFIG.tendRadius;
  const missing = new Set<number>();
  for (const cell of cells) {
    const tx = cell % state.width; const ty = Math.floor(cell / state.width);
    let found = false;
    for (let dy = -radius; dy <= radius && !found; dy += 1) {
      const span = radius - Math.abs(dy);
      for (let dx = -span; dx <= span && !found; dx += 1) found = farmsteadReaches(tx + dx, ty + dy);
    }
    if (!found) missing.add(cell);
  }
  return missing;
}

export function drawZoneBrushOverlay(context: CanvasRenderingContext2D, state: GameState, view: ZoneBrushView, zoom: number): void {
  // UX-3R2: the land the armed kind can be painted on, under the stroke preview (zonePaintableLand).
  if (view.tool.target !== "erase") drawPaintableLand(context, state, view.tool.target, zoom);
  const preview = zoneBrushPreview(state, view);
  const tint = view.tool.target === "erase" ? PALETTE.ink : ZONE_STYLES[view.tool.target].line;
  const anyRefused = preview.blocked;
  for (const cell of preview.cells) {
    const refused = preview.refused.has(cell);
    context.fillStyle = refused ? withAlpha(PALETTE.vermilion, 0.5) : withAlpha(tint, anyRefused ? 0.12 : view.gesture === null ? 0.16 : 0.3);
    traceDiamond(context, cell % state.width, Math.floor(cell / state.width));
    context.fill();
  }
  if (preview.noRoad.size > 0) {
    // Pale hatch: two short strokes along the tile y axis in each cell no farm there could reach a road from.
    applyPaletteStroke(context, PALETTE.ink, zoom);
    context.lineWidth = 1 / zoom;
    const previousAlpha = context.globalAlpha;
    context.globalAlpha = previousAlpha * 0.45;
    context.beginPath();
    for (const cell of preview.noRoad) {
      const tx = cell % state.width; const ty = Math.floor(cell / state.width);
      for (const offset of [-0.2, 0.2]) {
        const a = tileToScreen(tx + offset, ty - 0.35); const b = tileToScreen(tx + offset, ty + 0.35);
        context.moveTo(a.sx, a.sy); context.lineTo(b.sx, b.sy);
      }
    }
    context.stroke();
    context.globalAlpha = previousAlpha;
  }
  if (view.hover !== null && !view.tool.polygon && view.gesture?.mode !== "polygon") {
    // Brush ring: a tile-space circle of the brush radius around the pointer.
    applyPaletteStroke(context, anyRefused ? PALETTE.vermilion : RAMPS.plaster[5], zoom);
    context.lineWidth = 1.5 / zoom;
    context.beginPath();
    for (let step = 0; step <= 32; step += 1) {
      const angle = step * Math.PI / 16;
      const screen = tileToScreen(view.hover.x - 0.5 + Math.cos(angle) * view.tool.radius, view.hover.y - 0.5 + Math.sin(angle) * view.tool.radius);
      if (step === 0) context.moveTo(screen.sx, screen.sy); else context.lineTo(screen.sx, screen.sy);
    }
    context.stroke();
  }
  if (view.gesture?.mode === "polygon") {
    const points = view.hover === null ? view.gesture.points : [...view.gesture.points, view.hover];
    applyPaletteStroke(context, anyRefused ? PALETTE.vermilion : RAMPS.plaster[5], zoom);
    context.lineWidth = 1.5 / zoom;
    context.beginPath();
    points.forEach((point, index) => {
      const screen = tileToScreen(point.x - 0.5, point.y - 0.5);
      if (index === 0) context.moveTo(screen.sx, screen.sy); else context.lineTo(screen.sx, screen.sy);
    });
    context.stroke();
    context.fillStyle = withAlpha(RAMPS.plaster[5], 0.9);
    for (const point of view.gesture.points) {
      const screen = tileToScreen(point.x - 0.5, point.y - 0.5);
      context.beginPath();
      context.arc(screen.sx, screen.sy, 3 / zoom, 0, Math.PI * 2);
      context.fill();
    }
    // UX3R 5절: the area the polygon would take, before it is closed (beside the pointer).
    const last = points[points.length - 1];
    if (last !== undefined && preview.cells.length > 0) {
      const screen = tileToScreen(last.x - 0.5, last.y - 0.5);
      const label = ZONE_BRUSH_COPY.polygonArea(preview.cells.length);
      context.font = `600 ${Math.round(13 / Math.max(zoom, 0.5))}px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`;
      const width = context.measureText(label).width; const pad = 4 / zoom; const x = screen.sx + 10 / zoom; const y = screen.sy - 22 / zoom;
      context.fillStyle = withAlpha(RAMPS.plaster[5], 0.92);
      context.fillRect(x - pad, y - 14 / zoom, width + pad * 2, 19 / zoom);
      context.fillStyle = PALETTE.ink;
      context.fillText(label, x, y);
    }
  }
}

function traceDiamond(context: CanvasRenderingContext2D, tx: number, ty: number): void {
  const top = tileToScreen(tx - 0.5, ty - 0.5); const right = tileToScreen(tx + 0.5, ty - 0.5);
  const bottom = tileToScreen(tx + 0.5, ty + 0.5); const left = tileToScreen(tx - 0.5, ty + 0.5);
  context.beginPath();
  context.moveTo(top.sx, top.sy); context.lineTo(right.sx, right.sy); context.lineTo(bottom.sx, bottom.sy); context.lineTo(left.sx, left.sy);
  context.closePath();
}
