import { ARABLE_CONFIG } from "../content/arableConfig";
import type { Building } from "../content/buildingConfig";
import { PALETTE, RAMPS } from "../content/palette";
import { PARCEL_RULES, ZONE_KIND_CONFIG } from "../content/zoneConfig";
import type { GameState } from "../engine/engine.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import { cellInsideWall } from "../zones/zoneEdits";
import type { ZoneKind } from "../zones/zone.types";
import { tileToScreen } from "./iso";
import { colorblindEnabled } from "./placementPaletteFlag";
import { applyPaletteStroke, withAlpha } from "./style";

// UX-3R2 (UX3R 5절): with a zone kind armed, the land it can be painted on, in three grades read from the rules
// (never invented): barred = the stroke would lose the cell (water; arable inside the wall, Z-9a) — dark with a 45°
// hatch; good / fair = the cell takes the zone and it works there or not:
//  - arable: good where a road-connected barn could tend it (a 1 × 1 farmstead spot with road access by the rules'
//    own test within ARABLE_CONFIG.tendRadius, Manhattan — the brush preview's "헛간이 닿지 못하는 칸" rule), fair
//    elsewhere (painted but untended until a barn is near). The engine has no fertility map yet (every strip starts
//    at initialFertilityPermille), so the grades are reach, not fertility (decision US-D10).
//  - burgage: good within the frontage depth of a road (PARCEL_RULES.depthTiles, Chebyshev), where plots form; fair
//    farther in.
//  - pasture, orchard and the others have no placement rule yet: good everywhere they can be painted.
// Cache (AGENTS rule 10): the grade grid and its three paths, keyed by the state's tiles and palisade objects (roads
// and the wall; C1d's brush preview keys the same objects), the width and the kind (the colours are set per draw); reason:
// the grid runs the road-access test for all 4,096 cells and the paths hold a run per row; measured locally 0.75 ms
// (arable) / 0.57 ms (burgage) per grade grid on the 64 × 64 map, where a per-frame rebuild would repeat it at 60 fps;
// the cached draw is three fills and a clipped hatch.

export type PaintableGrade = 0 | 1 | 2;
export const GRADE_BARRED: PaintableGrade = 0;
export const GRADE_FAIR: PaintableGrade = 1;
export const GRADE_GOOD: PaintableGrade = 2;

type Land = Pick<GameState, "width" | "height" | "tiles" | "palisade">;

export function paintableLandGrades(state: Land, kind: ZoneKind): Uint8Array {
  const { width, height } = state;
  const grades = new Uint8Array(width * height).fill(GRADE_GOOD);
  const barredInside = ZONE_KIND_CONFIG[kind].forbiddenInsideWall;
  for (let cell = 0; cell < width * height; cell += 1) {
    if (state.tiles[cell]?.terrain === "water" || (barredInside && cellInsideWall(state, cell))) grades[cell] = GRADE_BARRED;
  }
  if (kind === "arable") {
    const reach = manhattanReach(state, cell => {
      const farmstead = { id: "zone-land-farmstead", kind: "farmstead", tx: cell % width, ty: Math.floor(cell / width) } as Building;
      return buildingRoadAccessTiles(state as GameState, farmstead).length > 0;
    }, ARABLE_CONFIG.tendRadius);
    for (let cell = 0; cell < width * height; cell += 1) if (grades[cell] !== GRADE_BARRED && !reach[cell]) grades[cell] = GRADE_FAIR;
  } else if (kind === "burgage") {
    const depth = Math.floor(PARCEL_RULES.depthTiles);
    const road = (cell: number) => state.tiles[cell]?.hasRoad === true;
    for (let cell = 0; cell < width * height; cell += 1) {
      if (grades[cell] === GRADE_BARRED) continue;
      const tx = cell % width; const ty = Math.floor(cell / width);
      let near = false;
      for (let dy = -depth; dy <= depth && !near; dy += 1) for (let dx = -depth; dx <= depth && !near; dx += 1) {
        const x = tx + dx; const y = ty + dy;
        near = x >= 0 && y >= 0 && x < width && y < height && road(y * width + x);
      }
      if (!near) grades[cell] = GRADE_FAIR;
    }
  }
  return grades;
}

/** Cells within `radius` (Manhattan, 4-neighbour steps) of a cell where `source` holds. */
function manhattanReach(state: Land, source: (cell: number) => boolean, radius: number): Uint8Array {
  const { width, height } = state;
  const distance = new Int16Array(width * height).fill(-1);
  let frontier: number[] = [];
  for (let cell = 0; cell < width * height; cell += 1) if (source(cell)) { distance[cell] = 0; frontier.push(cell); }
  for (let step = 1; step <= radius && frontier.length > 0; step += 1) {
    const next: number[] = [];
    for (const cell of frontier) {
      const tx = cell % width;
      for (const neighbour of [tx > 0 ? cell - 1 : -1, tx < width - 1 ? cell + 1 : -1, cell - width, cell + width]) {
        if (neighbour < 0 || neighbour >= width * height || distance[neighbour] !== -1) continue;
        distance[neighbour] = step; next.push(neighbour);
      }
    }
    frontier = next;
  }
  return Uint8Array.from(distance, value => (value >= 0 ? 1 : 0));
}

type LandPaths = { readonly good: Path2D; readonly fair: Path2D; readonly barred: Path2D; readonly bounds: { x0: number; y0: number; x1: number; y1: number } };
let cached: { readonly key: readonly unknown[]; readonly paths: LandPaths } | null = null;

function landPaths(state: Land, kind: ZoneKind): LandPaths {
  const key = [state.tiles, state.palisade, state.width, kind];
  if (cached !== null && cached.key.every((value, index) => value === key[index])) return cached.paths;
  const grades = paintableLandGrades(state, kind);
  const paths = { good: new Path2D(), fair: new Path2D(), barred: new Path2D() };
  const byGrade = [paths.barred, paths.fair, paths.good] as const;
  for (let ty = 0; ty < state.height; ty += 1) {
    let start = 0;
    for (let tx = 1; tx <= state.width; tx += 1) {
      const at = ty * state.width;
      if (tx < state.width && grades[at + tx] === grades[at + start]) continue;
      // One parallelogram per run of equal grade along the row (fewer sub-paths than one diamond per cell).
      const path = byGrade[grades[at + start] as PaintableGrade];
      const top = tileToScreen(start - 0.5, ty - 0.5); const right = tileToScreen(tx - 0.5, ty - 0.5);
      const bottom = tileToScreen(tx - 0.5, ty + 0.5); const left = tileToScreen(start - 0.5, ty + 0.5);
      path.moveTo(top.sx, top.sy); path.lineTo(right.sx, right.sy); path.lineTo(bottom.sx, bottom.sy); path.lineTo(left.sx, left.sy); path.closePath();
      start = tx;
    }
  }
  const corners = [tileToScreen(-0.5, -0.5), tileToScreen(state.width - 0.5, -0.5), tileToScreen(state.width - 0.5, state.height - 0.5), tileToScreen(-0.5, state.height - 0.5)];
  const bounds = { x0: Math.min(...corners.map(c => c.sx)), y0: Math.min(...corners.map(c => c.sy)), x1: Math.max(...corners.map(c => c.sx)), y1: Math.max(...corners.map(c => c.sy)) };
  cached = { key, paths: { ...paths, bounds } };
  return cached.paths;
}

/** Draws the three grades for the armed kind (world space; the canvas transform holds the camera). */
export function drawPaintableLand(context: CanvasRenderingContext2D, state: Land, kind: ZoneKind, zoom: number): void {
  const paths = landPaths(state, kind);
  // The semantic palette's sage / water, gold and ink (the legend swatches use the same --palette-* variables).
  context.fillStyle = withAlpha(colorblindEnabled() ? RAMPS.water[3] : RAMPS.foliage[4], 0.24);
  context.fill(paths.good);
  context.fillStyle = withAlpha(PALETTE.gold, 0.2);
  context.fill(paths.fair);
  context.fillStyle = withAlpha(PALETTE.ink, 0.34);
  context.fill(paths.barred);
  // The barred cells also carry a 45° hatch, so the grade never rests on colour alone.
  context.save();
  context.clip(paths.barred);
  applyPaletteStroke(context, PALETTE.ink, zoom);
  context.lineWidth = 1.5 / zoom;
  const previousAlpha = context.globalAlpha;
  context.globalAlpha = previousAlpha * 0.55;
  context.beginPath();
  const { x0, y0, x1, y1 } = paths.bounds; const spacing = 10;
  for (let x = x0 - (y1 - y0); x < x1; x += spacing) { context.moveTo(x, y1); context.lineTo(x + (y1 - y0), y0); }
  context.stroke();
  context.globalAlpha = previousAlpha;
  context.restore();
}
