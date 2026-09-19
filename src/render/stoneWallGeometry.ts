import { GATE_HALF_CLEARANCE } from "../world/wallTraversal";
import type { TileEdgePoint } from "../world/palisadeGeometry";
import { palisadeScreenPath } from "./palisadeRenderGeometry";

type Point = Readonly<{ x: number; y: number }>;
export type StoneWallAxis = "descending" | "ascending";
export type StoneWallPiece = Readonly<{
  start: Point; end: Point; axis: StoneWallAxis | null; from: number; to: number;
}>;
export const STONE_WALL_SOURCES = {
  descending: { start: { x: 145, y: 530 }, end: { x: 1075, y: 1110 }, filename: "stone_wall_straight_nw_se-v3.png" },
  ascending: { start: { x: 173, y: 1105 }, end: { x: 1140, y: 510 }, filename: "stone_wall_straight_ne_sw-v3.png" },
} as const;

export function stoneWallTransform(piece: StoneWallPiece, source: Readonly<{ start: Point; end: Point }>) {
  const a = (piece.end.x - piece.start.x) / (source.end.x - source.start.x);
  const d = 32 / (source.end.x - source.start.x);
  const b = (piece.end.y - piece.start.y - d * (source.end.y - source.start.y)) / (source.end.x - source.start.x);
  return { a, b, c: 0, d, e: piece.start.x - a * source.start.x, f: piece.start.y - b * source.start.x - d * source.start.y };
}

export function stoneWallPieces(path: readonly TileEdgePoint[], gate: TileEdgePoint | null, gates: readonly TileEdgePoint[] = gate === null ? [] : [gate]): readonly StoneWallPiece[] {
  const pieces: StoneWallPiece[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const first = path[index - 1];
    const last = path[index];
    if (first === undefined || last === undefined) continue;
    const steps = Math.ceil(Math.max(Math.abs(last.x - first.x), Math.abs(last.y - first.y)));
    for (let step = 0; step < steps; step += 1) {
      const a = { x: first.x + (last.x - first.x) * step / steps, y: first.y + (last.y - first.y) * step / steps };
      const b = { x: first.x + (last.x - first.x) * (step + 1) / steps, y: first.y + (last.y - first.y) * (step + 1) / steps };
      const screens = palisadeScreenPath([a, b]);
      const p = screens[0]; const q = screens[1];
      if (p === undefined || q === undefined) continue;
      const reverse = p.x > q.x || (p.x === q.x && p.y > q.y);
      const start = reverse ? q : p; const end = reverse ? p : q;
      const worldStart = reverse ? b : a; const worldEnd = reverse ? a : b;
      const atGate = (point: Point) => gates.some(candidate => Math.hypot(point.x - candidate.x, point.y - candidate.y) < 1e-6);
      const axis = a.y === b.y ? "descending" : a.x === b.x ? "ascending" : null;
      const from = atGate(worldStart) ? GATE_HALF_CLEARANCE : 0;
      const to = atGate(worldEnd) ? 1 - GATE_HALF_CLEARANCE : 1;
      if (from < to) pieces.push({ start, end, axis, from, to });
    }
  }
  return pieces.sort((a, b) => (a.start.y + a.end.y) - (b.start.y + b.end.y) || a.start.x - b.start.x);
}
