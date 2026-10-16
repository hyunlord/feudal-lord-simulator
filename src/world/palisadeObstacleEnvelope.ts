import { getTile, type Grid } from './grid';
import { palisadeCellBoundaryLoops, palisadeEnvelopeCells } from './palisadeLandEnvelope';
import { palisadePathHasBuildingClearance, type PalisadeFootprint, type PalisadePath } from './palisadeGeometry';

export function palisadeObstacleEnvelopes(
  grid: Grid,
  anchors: readonly PalisadeFootprint[],
  obstacles: readonly PalisadeFootprint[],
  margin: number,
  waterReach = false,
  clearance = 1,
): readonly PalisadePath[] {
  const cells = palisadeEnvelopeCells(grid, anchors, margin, waterReach);
  const expanded = new Set<string>();
  for (let pass = 0; pass <= obstacles.length; pass++) {
    const paths = palisadeCellBoundaryLoops(cells);
    const collisions = obstacles.filter(obstacle => !expanded.has(obstacle.id)
      && paths.some(path => !palisadePathHasBuildingClearance(path, [obstacle])));
    if (collisions.length === 0) return paths;
    for (const obstacle of collisions) {
      expanded.add(obstacle.id);
      // Clearance obstacles only add a local buffer; they never anchor gap filling or a convex hull.
      for (let ty = obstacle.ty - clearance; ty < obstacle.ty + obstacle.height + clearance; ty++) {
        for (let tx = obstacle.tx - clearance; tx < obstacle.tx + obstacle.width + clearance; tx++) {
          const tile = getTile(grid, { tx, ty });
          if (tile !== null && (waterReach || tile.terrain !== 'water')) cells.add(`${tx},${ty}`);
        }
      }
    }
  }
  return palisadeCellBoundaryLoops(cells);
}
