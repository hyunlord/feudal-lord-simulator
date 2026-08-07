import {
  palisadePerimeterSteps,
  type PalisadePath,
  type TileEdgePoint,
} from "../world/palisadeGeometry";

export type PalisadeConstructionSegmentPath = {
  readonly path: PalisadePath;
  readonly tileCount: number;
};

export const PALISADE_SEGMENT_SITE_STEPS = 4;

export function palisadeStepPoints(path: PalisadePath): readonly TileEdgePoint[] {
  const points: TileEdgePoint[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    if (start === undefined || end === undefined) continue;
    let cursor = start;
    if (points.length === 0) points.push(cursor);
    while (cursor.x !== end.x || cursor.y !== end.y) {
      cursor = {
        x: cursor.x + Math.sign(end.x - cursor.x),
        y: cursor.y + Math.sign(end.y - cursor.y),
      };
      points.push(cursor);
    }
  }
  return points;
}

export function palisadeRingPoints(path: PalisadePath): readonly TileEdgePoint[] {
  const points = palisadeStepPoints(path);
  const first = points[0];
  const last = points[points.length - 1];
  if (first !== undefined && last !== undefined && first.x === last.x && first.y === last.y) {
    return points.slice(0, -1);
  }
  return points;
}

export function segmentPalisadePathForConstruction(
  path: PalisadePath,
): readonly PalisadeConstructionSegmentPath[] {
  const points = palisadeStepPoints(path);
  const segments: PalisadeConstructionSegmentPath[] = [];
  for (let index = 0; index < points.length - 1; index += PALISADE_SEGMENT_SITE_STEPS) {
    const end = Math.min(points.length - 1, index + PALISADE_SEGMENT_SITE_STEPS);
    const segmentPath = points.slice(index, end + 1);
    const tileCount = palisadePerimeterSteps(segmentPath);
    if (tileCount > 0) segments.push({ path: segmentPath, tileCount });
  }
  return segments;
}
