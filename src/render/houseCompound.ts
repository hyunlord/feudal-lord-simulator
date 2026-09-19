import type { Building } from "../content/buildingConfig";
import { PALETTE, RAMPS, SEMANTIC_PALETTE } from "../content/palette";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { tileToScreen } from "./iso";
import { applyPaletteStroke, shade } from "./style";
import type { RenderDetailLevel } from "./buildingVisualState";

type Vertex = Readonly<{ tx: number; ty: number; lift: number }>;

/** A single roof and wall envelope over the complete lot, including downgraded lots. */
export function houseCompoundGeometry(building: Building, level: number) {
  const size = buildingFootprint(building);
  const horizontal = size.width === 2;
  const tx = building.tx + (size.width - 1) / 2;
  const ty = building.ty + (size.height - 1) / 2;
  const dx = size.width / 2 - 0.18;
  const dy = size.height / 2 - 0.18;
  const height = 15 + Math.max(0, Math.min(level, 4)) * 7;
  const roofHeight = 12 + level * 1.5;
  const corner = (x: number, y: number, lift: number): Vertex => ({ tx: tx + x * dx, ty: ty + y * dy, lift });
  const corners = [corner(-1, -1, 0), corner(1, -1, 0), corner(1, 1, 0), corner(-1, 1, 0)] as const;
  const eaves = corners.map(point => ({ ...point, lift: height }));
  const ridge = horizontal
    ? [{ tx: tx - dx, ty, lift: height + roofHeight }, { tx: tx + dx, ty, lift: height + roofHeight }]
    : [{ tx, ty: ty - dy, lift: height + roofHeight }, { tx, ty: ty + dy, lift: height + roofHeight }];
  return { corners, eaves, ridge, height, horizontal };
}

export function drawHouseCompound(context: CanvasRenderingContext2D, building: Building, level: number, detail: RenderDetailLevel, outline = false): void {
  const model = houseCompoundGeometry(building, level);
  const wall = level === 0 ? SEMANTIC_PALETTE.earth : level >= 3 ? SEMANTIC_PALETTE.vellum : SEMANTIC_PALETTE.parchmentDark;
  const roof = level <= 1 ? SEMANTIC_PALETTE.earth : RAMPS.earth[2];
  const face = (points: readonly Vertex[], color: string): void => {
    context.beginPath();
    for (const [index, point] of points.entries()) {
      const screen = tileToScreen(point.tx, point.ty);
      if (index === 0) context.moveTo(screen.sx, screen.sy - point.lift);
      else context.lineTo(screen.sx, screen.sy - point.lift);
    }
    context.closePath(); context.fillStyle = outline ? PALETTE.ink : color; context.fill();
    applyPaletteStroke(context, SEMANTIC_PALETTE.earthDark, 1); context.lineWidth = 0.65; context.stroke();
  };
  const [, b, c, d] = model.corners;
  const [ea, eb, ec, ed] = model.eaves;
  const [r0, r1] = model.ridge;
  if (ea === undefined || eb === undefined || ec === undefined || ed === undefined || r0 === undefined || r1 === undefined) return;
  face([b, c, ec, eb], shade(wall, 0.81));
  face([c, d, ed, ec], wall);
  if (model.horizontal) {
    face([ea, eb, r1, r0], shade(roof, 0.83));
    face([eb, ec, r1], shade(wall, 0.84));
    face([ed, ec, r1, r0], roof);
  } else {
    face([ea, ed, r1, r0], roof);
    face([ed, ec, r1], wall);
    face([eb, ec, r1, r0], shade(roof, 0.82));
  }
  if (outline || detail === "blocks") return;
  // Joinery and openings follow the same two visible walls in either lot orientation.
  for (const [start, end] of [[b, c], [d, c]] as const) {
    const bays = Math.abs(start.tx - end.tx) + Math.abs(start.ty - end.ty) > 1 ? 4 : 2;
    const point = (fraction: number, lift: number): Vertex => ({ tx: start.tx + (end.tx - start.tx) * fraction, ty: start.ty + (end.ty - start.ty) * fraction, lift });
    for (let bay = 0; bay < bays; bay += 1) {
      const f = (bay + 0.5) / bays;
      const half = 0.12 / bays;
      const lower = bay === 0 ? 1 : 7;
      const upper = bay === 0 ? 12 : 13;
      face([point(f - half, lower), point(f + half, lower), point(f + half, upper), point(f - half, upper)], SEMANTIC_PALETTE.inkMuted);
      if (level >= 2 && detail === "full") face([point(f - half, 21), point(f + half, 21), point(f + half, 28), point(f - half, 28)], SEMANTIC_PALETTE.inkMuted);
      if (level >= 4 && detail === "full") face([point(f - half, 34), point(f + half, 34), point(f + half, 40), point(f - half, 40)], SEMANTIC_PALETTE.inkMuted);
    }
    if (level >= 1) {
      for (let bay = 0; bay <= bays; bay += 1) face([point(bay / bays - 0.012, 1), point(bay / bays + 0.012, 1), point(bay / bays + 0.012, model.height), point(bay / bays - 0.012, model.height)], SEMANTIC_PALETTE.inkLight);
      if (level >= 2) face([point(0, 17), point(1, 17), point(1, 19), point(0, 19)], SEMANTIC_PALETTE.inkLight);
    }
  }
}
