import { wallGatePoints, type WallBoundary } from "./wallTraversal";

const signatures = new WeakMap<WallBoundary, string>();

export function roadTopologySignature(wall: WallBoundary | null | undefined): string {
  if (wall === null || wall === undefined) return "";
  const cached = signatures.get(wall);
  if (cached !== undefined) return cached;
  const edges = new Set<string>();
  for (const segment of wall.segments) {
    if (!segment.completed) continue;
    for (let index = 1; index < segment.edgePath.length; index += 1) {
      const a = segment.edgePath[index - 1]; const b = segment.edgePath[index];
      if (a !== undefined && b !== undefined) edges.add([`${a.x},${a.y}`, `${b.x},${b.y}`].sort().join("/"));
    }
  }
  const signature = edges.size === 0 ? "" : `:walls:${JSON.stringify({ gates: wallGatePoints(wall).map(gate => `${gate.x},${gate.y}`).sort(), edges: [...edges].sort() })}`;
  signatures.set(wall, signature);
  return signature;
}
