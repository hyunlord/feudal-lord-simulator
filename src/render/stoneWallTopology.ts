import { wallGatePoints } from "../world/wallTraversal";
import type { PalisadeSegment, PalisadeState } from "../engine/engine.types";
import type { TileEdgePoint } from "../world/palisadeGeometry";
import { palisadeRenderAnchor } from "./palisadeRenderGeometry";

export type StoneWallNode = Readonly<{
  clearanceGates?: readonly TileEdgePoint[];
  point: TileEdgePoint;
  neighbors: readonly TileEdgePoint[];
  kind: "terminal" | "corner" | "junction" | "gate";
}>;
export type StoneWallTopologyEdge = Readonly<{
  key: string;
  segment: PalisadeSegment;
  gate: TileEdgePoint | null;
  gates: readonly TileEdgePoint[];
  nodes: readonly StoneWallNode[];
}>;
const pointKey = (point: TileEdgePoint): string => `${point.x},${point.y}`;
const comparePoint = (a: TileEdgePoint, b: TileEdgePoint): number => a.x - b.x || a.y - b.y;

export function stoneWallTopology(palisade: PalisadeState): readonly StoneWallTopologyEdge[] {
  const allGates = [...wallGatePoints(palisade)].sort(comparePoint);
  const edges = new Map<string, StoneWallTopologyEdge>();
  for (const segment of [...palisade.segments].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!segment.completed || segment.material !== "stone") continue;
    for (let index = 1; index < segment.edgePath.length; index += 1) {
      const a = segment.edgePath[index - 1]; const b = segment.edgePath[index];
      if (!a || !b) continue;
      const [first, last] = comparePoint(a, b) <= 0 ? [a, b] : [b, a];
      if (!first || !last) continue;
      const steps = Math.ceil(Math.max(Math.abs(last.x - first.x), Math.abs(last.y - first.y)));
      for (let step = 0; step < steps; step += 1) {
        const points = [step, step + 1].map(part => ({ x: first.x + (last.x - first.x) * part / steps, y: first.y + (last.y - first.y) * part / steps })).sort(comparePoint);
        const [start, end] = points;
        if (!start || !end) continue;
        const key = `${pointKey(start)}:${pointKey(end)}`;
        if (edges.has(key)) continue;
        const gates = allGates.filter(gate => points.some(point => comparePoint(point, gate) === 0));
        const gate = gates[0] ?? null;
        edges.set(key, { key, segment: { ...segment, edgePath: points }, gate, gates, nodes: [] });
      }
    }
  }
  const ordered = [...edges.values()].sort((a, b) => {
    const left = palisadeRenderAnchor(a.segment.edgePath); const right = palisadeRenderAnchor(b.segment.edgePath);
    return left.depth - right.depth || left.anchorTx - right.anchorTx || a.key.localeCompare(b.key);
  });
  const vertices = new Map<string, { point: TileEdgePoint; neighbors: TileEdgePoint[]; owner: string }>();
  for (const edge of ordered) {
    const [a, b] = edge.segment.edgePath;
    if (!a || !b) continue;
    for (const [point, neighbor] of [[a, b], [b, a]]) {
      if (!point || !neighbor) continue;
      const key = pointKey(point);
      const vertex = vertices.get(key) ?? { point, neighbors: [], owner: edge.key };
      vertex.neighbors.push(neighbor);
      vertex.owner = edge.key;
      vertices.set(key, vertex);
    }
  }
  const nodes = new Map<string, StoneWallNode[]>();
  for (const vertex of vertices.values()) {
    const { point, owner } = vertex;
    const neighbors = vertex.neighbors.sort(comparePoint);
    const [a, b] = neighbors;
    const isGate = allGates.some(gate => comparePoint(point, gate) === 0);
    const straight = neighbors.length === 2 && a && b && Math.abs((a.x - point.x) * (b.y - point.y) - (a.y - point.y) * (b.x - point.x)) < 1e-8;
    if (straight && !isGate) continue;
    const kind = isGate ? "gate" : neighbors.length === 1 ? "terminal" : neighbors.length === 2 ? "corner" : "junction";
    const owned = nodes.get(owner) ?? [];
    owned.push({ point, neighbors, kind, ...(allGates.length > 1 ? { clearanceGates: allGates } : {}) });
    nodes.set(owner, owned);
  }
  return ordered.map(edge => ({ ...edge, nodes: (nodes.get(edge.key) ?? []).sort((a, b) => comparePoint(a.point, b.point)) }));
}
