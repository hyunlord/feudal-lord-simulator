export type TileCoordinate = {
  readonly tx: number;
  readonly ty: number;
};

export type TileEdgePoint = {
  readonly x: number;
  readonly y: number;
};

export type TileEdgePath = readonly TileEdgePoint[];

function segmentSteps(from: TileEdgePoint, to: TileEdgePoint): number {
  return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
}

export function tileEdgePathSteps(path: TileEdgePath): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (previous !== undefined && current !== undefined) total += segmentSteps(previous, current);
  }
  return total;
}
