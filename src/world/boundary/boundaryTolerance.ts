import { distanceToCell, distanceToSegment, type BoundaryPoint } from "./boundaryGeometry";
import type { CellContourLoop } from "./cellContours";
import type { RoadCenterlineGraph } from "./roadCenterline";

// Logic-vs-picture tolerance measurements (D1a gate 1). Curves are sampled every SAMPLE_STEP tiles.
//  - Road: distance from each centreline sample to the road cells it runs through (0 inside a road cell square),
//    and, for reference, to the cell-centre chain the walkers actually use.
//  - Forest/field outlines: distance from each outline sample to the nearest tile edge that separates inside from
//    outside cells.

export const SAMPLE_STEP = 0.05;

export type ToleranceReport = { readonly samples: number; readonly max: number; readonly over: number };

export function roadCentrelineTolerance(graph: RoadCenterlineGraph, limit: number): ToleranceReport & { readonly maxToCentreChain: number } {
  let samples = 0; let max = 0; let over = 0; let maxToCentreChain = 0;
  for (const chain of graph.chains) {
    const line = chain.closed ? [...chain.centreline, chain.centreline[0] as BoundaryPoint] : chain.centreline;
    const centres = chain.cells.map(cell => ({ x: cell.tx, y: cell.ty }));
    if (chain.closed) centres.push(centres[0] as BoundaryPoint);
    for (const point of sampleLine(line)) {
      samples += 1;
      let distance = Infinity;
      for (const cell of chain.cells) distance = Math.min(distance, distanceToCell(point, cell.tx, cell.ty));
      max = Math.max(max, distance);
      if (distance > limit + 1e-9) over += 1;
      let toChain = Infinity;
      for (let index = 1; index < centres.length; index += 1) toChain = Math.min(toChain, distanceToSegment(point, centres[index - 1] as BoundaryPoint, centres[index] as BoundaryPoint));
      if (centres.length === 1) toChain = Math.hypot(point.x - (centres[0] as BoundaryPoint).x, point.y - (centres[0] as BoundaryPoint).y);
      maxToCentreChain = Math.max(maxToCentreChain, toChain);
    }
  }
  return { samples, max, over, maxToCentreChain };
}

export function outlineTolerance(loops: readonly (CellContourLoop & { readonly smoothed: readonly BoundaryPoint[] })[], limit: number): ToleranceReport {
  let samples = 0; let max = 0; let over = 0;
  for (const loop of loops) {
    const edges = loop.edgeMidpoints.map((mid, index) => {
      const inside = loop.insideCells[index] as { readonly tx: number; readonly ty: number };
      // The tile edge through `mid`, perpendicular to the inside->outside direction.
      return mid.x !== inside.tx
        ? [{ x: mid.x, y: mid.y - 0.5 }, { x: mid.x, y: mid.y + 0.5 }] as const
        : [{ x: mid.x - 0.5, y: mid.y }, { x: mid.x + 0.5, y: mid.y }] as const;
    });
    for (const point of sampleLine([...loop.smoothed, loop.smoothed[0] as BoundaryPoint])) {
      samples += 1;
      let distance = Infinity;
      for (const [a, b] of edges) distance = Math.min(distance, distanceToSegment(point, a, b));
      max = Math.max(max, distance);
      if (distance > limit + 1e-9) over += 1;
    }
  }
  return { samples, max, over };
}

function sampleLine(line: readonly BoundaryPoint[]): BoundaryPoint[] {
  const points: BoundaryPoint[] = [];
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1] as BoundaryPoint; const b = line[index] as BoundaryPoint;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SAMPLE_STEP));
    for (let step = 0; step < steps; step += 1) points.push({ x: a.x + (b.x - a.x) * step / steps, y: a.y + (b.y - a.y) * step / steps });
  }
  const last = line[line.length - 1];
  if (last !== undefined) points.push(last);
  return points;
}
