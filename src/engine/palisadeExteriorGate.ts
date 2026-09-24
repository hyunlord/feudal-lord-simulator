import type { Building } from "../content/buildingConfig";
import type { Grid, TileCoordinate } from "../world/grid";
import { isPointInsidePalisade, type PalisadePath, type TileEdgePoint } from "../world/palisadeGeometry";
import { canPlaceRoad, existingRoadComponent, getOrthogonalRoadNeighbors } from "../world/roadGraph";
import { canTraverseWallBoundary } from "../world/wallTraversal";
import { canTraverseRoadBoundary } from "../world/bridges";
import { buildingRoadAccessTiles } from "./routing";
import { palisadeRingPoints } from "./palisadeSegments";

export function gatesForExteriorAccess(grid: Grid & { readonly buildings: readonly Building[] }, path: PalisadePath, primary: TileEdgePoint, selected: readonly TileEdgePoint[]): readonly TileEdgePoint[] {
  const plain = { ...grid, palisade: null };
  const potential = { ...plain, tiles: grid.tiles.map(tile => ({ ...tile, hasRoad: tile.hasRoad || canPlaceRoad(plain, tile) })) };
  const source = grid.buildings.find(building => building.kind === "storehouse") ?? grid.buildings[0];
  if (source === undefined) return selected;
  const starts = buildingRoadAccessTiles(potential, source);
  const baseline = existingRoadComponent(potential, starts);
  const outside = new Set(baseline.filter(tile => !isPointInsidePalisade({ x: tile.tx + 0.5, y: tile.ty + 0.5 }, path)).map(tile => `${tile.tx},${tile.ty}`));
  const exteriorGrid = { ...potential, tiles: potential.tiles.map(tile => ({ ...tile, hasRoad: tile.hasRoad && outside.has(`${tile.tx},${tile.ty}`) })) };
  const seen = new Set<string>();
  let largest: readonly { readonly tx: number; readonly ty: number }[] = [];
  for (const tile of baseline) {
    const key = `${tile.tx},${tile.ty}`;
    if (!outside.has(key) || seen.has(key)) continue;
    const component = existingRoadComponent(exteriorGrid, [tile]);
    for (const point of component) seen.add(`${point.tx},${point.ty}`);
    if (component.length > largest.length) largest = component;
  }
  const target = new Set(largest.map(tile => `${tile.tx},${tile.ty}`));
  if (target.size === 0) return selected;
  const gates = [...selected];
  const ring = palisadeRingPoints(path);
  const withGates = (extra: readonly TileEdgePoint[]) => ({ ...potential,
    palisade: { gate: primary, additionalGates: extra, segments: [{ completed: true, edgePath: path }] } });
  const initial = withGates(gates);
  let current = existingRoadComponent(initial, buildingRoadAccessTiles(initial, source));
  if (current.some(tile => target.has(`${tile.tx},${tile.ty}`))) return gates;
  // Gate sets only grow; an initially open edge stays open and bridge topology is unchanged.
  const neighbors = new Map(potential.tiles.filter(tile => tile.hasRoad).map(tile => [
    `${tile.tx},${tile.ty}`, getOrthogonalRoadNeighbors(potential, tile).map(next => ({
      next, open: canTraverseWallBoundary(initial, tile, next),
    })),
  ]));
  const reached = (extra: readonly TileEdgePoint[]): readonly TileCoordinate[] => {
    const state = withGates(extra);
    const frontier = buildingRoadAccessTiles(state, source).filter(tile => canTraverseRoadBoundary(state, tile, tile));
    const component: TileCoordinate[] = [];
    const visited = new Set<string>();
    for (let index = 0; index < frontier.length; index++) {
      const tile = frontier[index];
      if (tile === undefined) continue;
      const key = `${tile.tx},${tile.ty}`;
      if (visited.has(key)) continue;
      visited.add(key);
      component.push(tile);
      for (const edge of neighbors.get(key) ?? []) {
        if (!visited.has(`${edge.next.tx},${edge.next.ty}`)
          && (edge.open || canTraverseWallBoundary(state, tile, edge.next))) frontier.push(edge.next);
      }
    }
    return component;
  };
  while (!current.some(tile => target.has(`${tile.tx},${tile.ty}`))) {
    const options = ring.filter(point => ![primary, ...gates].some(gate => gate.x === point.x && gate.y === point.y)).map(point => {
      const component = reached([...gates, point]);
      return { point, component, connects: component.some(tile => target.has(`${tile.tx},${tile.ty}`)) };
    }).filter(option => option.component.length > current.length);
    const best = options.sort((a, b) => Number(b.connects) - Number(a.connects) || b.component.length - a.component.length || a.point.y - b.point.y || a.point.x - b.point.x)[0];
    if (best === undefined) break;
    gates.push(best.point);
    current = best.component;
  }
  return gates;
}
