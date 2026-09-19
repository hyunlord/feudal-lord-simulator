import { gatePortalBranches } from "./gatePortalBranches";
import type { StoneWallNode } from "./stoneWallTopology";
import type { StoneWallSolid } from "./stoneWallFallbackGeometry";
import { palisadeScreenPath } from "./palisadeRenderGeometry";
import type { TileEdgePoint } from "../world/palisadeGeometry";

function pier(point: TileEdgePoint, radius: number, base: number, height: number): StoneWallSolid {
  const [a, b, c, d] = palisadeScreenPath([
    { x: point.x - radius, y: point.y - radius },
    { x: point.x + radius, y: point.y - radius },
    { x: point.x + radius, y: point.y + radius },
    { x: point.x - radius, y: point.y + radius },
  ]);
  if (!a || !b || !c || !d) throw new Error("Masonry footprint requires four corners");
  return { footprint: [a, b, c, d], base, height };
}

export function stoneWallNodeSolids(node: StoneWallNode): readonly StoneWallSolid[] {
  if (node.kind !== "gate") return [pier(node.point, 0.105, 0, 14), pier(node.point, 0.115, 14, 4)];
  const [first, second] = node.neighbors;
  const straight = node.neighbors.length === 2 && first !== undefined && second !== undefined
    && Math.abs((first.x - node.point.x) * (second.y - node.point.y)
      - (first.y - node.point.y) * (second.x - node.point.x)) < 1e-8;
  if (node.neighbors.length >= 2 && !straight) {
    const branches = gatePortalBranches(node);
    const [left, right] = branches;
    if (branches.length === 2 && left?.pier && right?.pier && first !== undefined && second !== undefined
      && Math.abs((first.x - node.point.x) * (second.x - node.point.x)
        + (first.y - node.point.y) * (second.y - node.point.y)) < 1e-8) {
      const dx = right.point.x - left.point.x; const dy = right.point.y - left.point.y;
      const length = Math.hypot(dx, dy);
      const wx = -dy * 0.1 / length; const wy = dx * 0.1 / length;
      const [a, b, c, d] = palisadeScreenPath([
        { x: left.point.x + wx, y: left.point.y + wy },
        { x: right.point.x + wx, y: right.point.y + wy },
        { x: right.point.x - wx, y: right.point.y - wy },
        { x: left.point.x - wx, y: left.point.y - wy },
      ]);
      if (a && b && c && d) return [
        pier(left.point, 0.15, 0, 24), pier(right.point, 0.15, 0, 24),
        { footprint: [a, b, c, d], base: 20, height: 4 },
      ];
    }
    return branches.filter(branch => branch.pier).map(branch => pier(branch.point, 0.15, 0, 18));
  }
  const solids: StoneWallSolid[] = [];
  for (const branch of gatePortalBranches(node)) {
    const end = branch.point;
    const dx = end.x - node.point.x; const dy = end.y - node.point.y;
    const distance = Math.hypot(dx, dy);
    if (branch.pier) solids.push(pier(end, 0.15, 0, 30));
    if (node.neighbors.length < 2) continue;
    const widthX = -dy * 0.15 / distance; const widthY = dx * 0.15 / distance;
    const [a, b, c, d] = palisadeScreenPath([
      { x: node.point.x + widthX, y: node.point.y + widthY },
      { x: end.x + widthX, y: end.y + widthY },
      { x: end.x - widthX, y: end.y - widthY },
      { x: node.point.x - widthX, y: node.point.y - widthY },
    ]);
    if (a && b && c && d) solids.push({ footprint: [a, b, c, d], base: 20, height: 10 });
    if (!branch.pier) continue;
    for (const ox of [-0.11, 0.11]) {
      for (const oy of [-0.11, 0.11]) solids.push(pier({ x: end.x + ox, y: end.y + oy }, 0.04, 30, 4));
    }
  }
  if (node.neighbors.length >= 2) solids.push(pier(node.point, 0.1, 30, 3));
  return solids.sort((a, b) => Math.max(...a.footprint.map(point => point.y)) - Math.max(...b.footprint.map(point => point.y)) || a.base - b.base);
}
