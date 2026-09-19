import type { StoneWallPiece } from "./stoneWallGeometry";

type Point = Readonly<{ x: number; y: number }>;
export type StoneWallSolid = Readonly<{
  footprint: readonly [Point, Point, Point, Point];
  base: number;
  height: number;
}>;

/** Ground thickness is projected at 2:1; it never collapses for a vertical screen path. */
export function stoneWallFallbackSolids(piece: StoneWallPiece): readonly StoneWallSolid[] {
  const dx = piece.end.x - piece.start.x;
  const dy = piece.end.y - piece.start.y;
  const length = Math.hypot(dx, dy * 2);
  if (length === 0 || piece.from >= piece.to) return [];
  const normal = { x: -dy * 7 / length, y: dx * 1.75 / length };
  const solid = (from: number, to: number, base: number, height: number): StoneWallSolid => {
    const a = { x: piece.start.x + dx * from, y: piece.start.y + dy * from };
    const b = { x: piece.start.x + dx * to, y: piece.start.y + dy * to };
    return { base, height, footprint: [
      { x: a.x + normal.x, y: a.y + normal.y },
      { x: b.x + normal.x, y: b.y + normal.y },
      { x: b.x - normal.x, y: b.y - normal.y },
      { x: a.x - normal.x, y: a.y - normal.y },
    ] };
  };
  const solids = [solid(piece.from, piece.to, 0, 14)];
  const count = Math.max(2, Math.round(Math.hypot(dx, dy) / 11));
  for (let index = 0; index < count; index += 1) {
    const from = Math.max(piece.from, (index + 0.12) / count);
    const to = Math.min(piece.to, (index + 0.68) / count);
    if (to > from) solids.push(solid(from, to, 14, 4));
  }
  return solids;
}
