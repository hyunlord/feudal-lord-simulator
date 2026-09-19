import type { TileEdgePoint } from "../world/palisadeGeometry";
import { GATE_HALF_CLEARANCE } from "../world/wallTraversal";

export function timberWallPostPoints(path: readonly TileEdgePoint[], gate: TileEdgePoint | null, gates: readonly TileEdgePoint[] = gate === null ? [] : [gate]): readonly TileEdgePoint[] {
  const posts: TileEdgePoint[] = [];
  const runs = path.slice(1).flatMap((end, index) => {
    const start = path[index];
    if (!start) return [];
    const dx = end.x - start.x; const dy = end.y - start.y;
    return [{ start, end, length: Math.hypot((dx - dy) * 32, (dx + dy) * 16) }];
  });
  const length = runs.reduce((total, run) => total + run.length, 0);
  for (const ratio of [0.125, 0.375, 0.625, 0.875]) {
    let remaining = length * ratio;
    for (const run of runs) {
      if (run.length === 0) continue;
      if (remaining > run.length) { remaining -= run.length; continue; }
      const fraction = remaining / run.length;
      const point = { x: run.start.x + (run.end.x - run.start.x) * fraction,
        y: run.start.y + (run.end.y - run.start.y) * fraction };
      if (gates.every(candidate => Math.max(Math.abs(point.x - candidate.x), Math.abs(point.y - candidate.y)) >= GATE_HALF_CLEARANCE + 0.125)) posts.push(point);
      break;
    }
  }
  return gate === null ? posts : posts.sort((a, b) => a.x + a.y - b.x - b.y || a.x - b.x);
}

export function timberGatePiers(path: readonly TileEdgePoint[], gate: TileEdgePoint): readonly TileEdgePoint[] {
  const piers = new Map<string, TileEdgePoint>();
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]; const end = path[index];
    if (!start || !end) continue;
    const cross = (gate.x - start.x) * (end.y - start.y) - (gate.y - start.y) * (end.x - start.x);
    if (Math.abs(cross) > 1e-8 || gate.x < Math.min(start.x, end.x) || gate.x > Math.max(start.x, end.x)
      || gate.y < Math.min(start.y, end.y) || gate.y > Math.max(start.y, end.y)) continue;
    for (const neighbor of [start, end]) {
      const dx = neighbor.x - gate.x; const dy = neighbor.y - gate.y;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      if (distance === 0) continue;
      const offset = (GATE_HALF_CLEARANCE + 0.15) / distance;
      const pier = { x: gate.x + dx * offset, y: gate.y + dy * offset };
      piers.set(`${pier.x},${pier.y}`, pier);
    }
  }
  return [...piers.values()].sort((a, b) => a.x + a.y - b.x - b.y || a.x - b.x);
}
