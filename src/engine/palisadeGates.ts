import { gatesForExteriorAccess } from "./palisadeExteriorGate";
import type { Building } from "../content/buildingConfig";
import { existingRoadComponent } from "../world/roadGraph";
import { buildingRoadAccessTiles } from "./routing";
import type { Grid, TileCoordinate } from "../world/grid";
import { getTile } from "../world/grid";
import type { PalisadePath, TileEdgePoint } from "../world/palisadeGeometry";
import { canTraverseWallBoundary, type WallBoundary } from "../world/wallTraversal";
import { canTraverseRoadBoundary } from "../world/bridges";
import { palisadeRingPoints } from "./palisadeSegments";

type Crossing = readonly [TileCoordinate, TileCoordinate];

export function additionalRoadGates(grid: Grid & { readonly buildings?: readonly Building[] }, path: PalisadePath, primary: TileEdgePoint): readonly TileEdgePoint[] {
  const ring = palisadeRingPoints(path);
  const selected: TileEdgePoint[] = [];
  const segments = [{ completed: true, edgePath: path }];
  const wall = (extra: readonly TileEdgePoint[]): WallBoundary => ({ gate: primary, additionalGates: extra, segments });
  const primaryWall = { ...grid, palisade: wall([]) };
  let blocked: Crossing[] = [];
  for (const tile of grid.tiles) {
    if (!tile.hasRoad || tile.buildingId !== null) continue;
    for (const next of [{ tx: tile.tx + 1, ty: tile.ty }, { tx: tile.tx, ty: tile.ty + 1 }]) {
      const target = getTile(grid, next);
      if (target?.hasRoad !== true || target.buildingId !== null || !canTraverseRoadBoundary({ ...grid, palisade: null }, tile, next)) continue;
      if (!canTraverseWallBoundary(primaryWall, tile, next)) blocked.push([tile, next]);
    }
  }
  const indexOf = (point: TileEdgePoint) => ring.findIndex(candidate => candidate.x === point.x && candidate.y === point.y);
  while (blocked.length > 0) {
    const choices = ring.map((point, index) => {
      const candidate = { ...grid, palisade: wall([...selected, point]) };
      const remaining = blocked.filter(([from, to]) => !canTraverseWallBoundary(candidate, from, to));
      const distance = Math.min(...[primary, ...selected].map(gate => {
        const delta = Math.abs(index - indexOf(gate));
        return Math.min(delta, ring.length - delta);
      }));
      return { point, remaining, distance, gain: blocked.length - remaining.length };
    }).filter(choice => choice.gain > 0);
    const separated = choices.filter(choice => choice.distance >= 2);
    const best = (separated.length > 0 ? separated : choices).sort((a, b) => b.gain - a.gain || b.distance - a.distance || a.point.y - b.point.y || a.point.x - b.point.x)[0];
    if (best === undefined) break;
    selected.push(best.point);
    blocked = best.remaining;
  }
  if (grid.buildings === undefined) return selected;
  const original = { ...grid, palisade: null };
  const groups: (readonly Building[])[] = [];
  const visited = new Set<string>();
  const coordinateKey = (point: TileCoordinate) => `${point.tx},${point.ty}`;
  for (const building of grid.buildings) {
    for (const port of buildingRoadAccessTiles(original, building)) {
      if (visited.has(coordinateKey(port))) continue;
      const reachable = new Set(existingRoadComponent(original, [port]).map(coordinateKey));
      for (const tile of reachable) visited.add(tile);
      const group = grid.buildings.filter(candidate => buildingRoadAccessTiles(original, candidate).some(tile => reachable.has(coordinateKey(tile))));
      if (group.length > 1) groups.push(group);
    }
  }
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const remaining = selected.filter((_, candidateIndex) => candidateIndex !== index);
    const candidate = { ...grid, palisade: wall(remaining) };
    const preserves = groups.every(group => {
      const first = group[0];
      if (first === undefined) return true;
      return buildingRoadAccessTiles(candidate, first).some(port => {
        const reachable = new Set(existingRoadComponent(candidate, [port]).map(coordinateKey));
        return group.every(building => buildingRoadAccessTiles(candidate, building).some(tile => reachable.has(coordinateKey(tile))));
      });
    });
    if (preserves) selected.splice(index, 1);
  }
  return gatesForExteriorAccess({ ...grid, buildings: grid.buildings }, path, primary, selected);
}
