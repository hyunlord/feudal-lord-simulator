import type { GameState } from '../engine/engine.types';
import type { BoundaryPoint } from '../world/boundary/boundaryGeometry';
import { pointInPolygon } from '../world/boundary/buildingGrounds';
import { ART_REGISTRY } from './art/wave42Registry';
import masks from './art/snowFootprintSupport.json';
import { groundBoundaryScene } from './groundBoundaryScene';
import { boundaryV2Enabled } from './renderBoundaryFlag';
import { screenToTile } from './iso';

type Stamp = { readonly x: number; readonly y: number };
const cross = (a: BoundaryPoint, b: BoundaryPoint, c: BoundaryPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function intersects(a: BoundaryPoint, b: BoundaryPoint, c: BoundaryPoint, d: BoundaryPoint): boolean {
  return cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0
    && Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x))
    && Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <= Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y));
}
function edgesTouch(a: readonly BoundaryPoint[], b: readonly BoundaryPoint[]): boolean {
  const left = Math.min(...a.map(p => p.x)), right = Math.max(...a.map(p => p.x));
  const top = Math.min(...a.map(p => p.y)), bottom = Math.max(...a.map(p => p.y));
  return b.some((q, j) => {
    const end = b[(j + 1) % b.length];
    if (end === undefined) return false;
    if (Math.max(q.x, end.x) < left || Math.min(q.x, end.x) > right || Math.max(q.y, end.y) < top || Math.min(q.y, end.y) > bottom) return false;
    return a.some((p, i) => {
      const next = a[(i + 1) % a.length];
      return next !== undefined && intersects(p, next, q, end);
    });
  });
}
/** Use displayed anchors, not the walker's logical/rounded cell. */
export function dryRoadAt(state: GameState, point: Stamp): boolean {
  const p = screenToTile(point.x, point.y), tx = Math.round(p.tx), ty = Math.round(p.ty);
  const tile = state.tiles[ty * state.width + tx];
  return tile !== undefined && tile.tx === tx && tile.ty === ty && tile.hasRoad && tile.terrain !== 'water' && tile.buildingId === null;
}
/** The full nonzero-alpha hull is an overestimate, so no faint edge pixels escape its support. */
export function footprintHull(id: string, stamp: Stamp): readonly BoundaryPoint[] {
  const mask = masks.find(row => row.id === id), entry = ART_REGISTRY.entry(id);
  if (mask === undefined || entry?.kind !== 'ground-prop' || entry.placement !== 'nature-ground' || entry.role !== 'snow-footprint') return [];
  return mask.hull.map(([x, y]) => {
    const p = screenToTile(stamp.x + ((x ?? 0) - entry.geometry.pivot.x) * entry.geometry.scale, stamp.y + ((y ?? 0) - entry.geometry.pivot.y) * entry.geometry.scale);
    return { x: p.tx, y: p.ty };
  });
}
/** Conservative subset of what drawRoadRibbons paints: actual plazas and trimmed straight ribbon crowns. */
export function createFootprintGroundSupport(state: GameState): (stamp: Stamp, id?: string) => boolean {
  if (!boundaryV2Enabled()) return () => false;
  const scene = groundBoundaryScene(state);
  const roads: (readonly BoundaryPoint[])[] = scene.roads.plazaLoops.map(loop => loop.smoothed);
  scene.roads.chains.forEach((chain, index) => {
    const a = chain.centreline[0], b = chain.centreline.at(-1), trim = scene.ribbons.trims[index];
    if (chain.closed || a === undefined || b === undefined || trim === undefined) return;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length <= trim.start + trim.end || chain.centreline.some(p => Math.abs(cross(a, b, p)) > 1e-8)) return;
    const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length, half = scene.ribbons.width / 2;
    const start = { x: a.x + ux * trim.start, y: a.y + uy * trim.start }, end = { x: b.x - ux * trim.end, y: b.y - uy * trim.end };
    roads.push([{ x: start.x - uy * half, y: start.y + ux * half }, { x: end.x - uy * half, y: end.y + ux * half }, { x: end.x + uy * half, y: end.y - ux * half }, { x: start.x + uy * half, y: start.y - ux * half }]);
  });
  return (stamp, id) => {
    if (!dryRoadAt(state, stamp)) return false;
    return (id === undefined ? masks.map(row => row.id) : [id]).some(key => {
      const hull = footprintHull(key, stamp);
      const first = hull[0];
      if (first === undefined || hull.length < 3 || !roads.some(road => pointInPolygon(first, road) && !edgesTouch(hull, road))) return false;
      const left = Math.min(...hull.map(p => p.x)), right = Math.max(...hull.map(p => p.x));
      const top = Math.min(...hull.map(p => p.y)), bottom = Math.max(...hull.map(p => p.y));
      for (let ty = Math.floor(top + 0.5); ty <= Math.floor(bottom + 0.5); ty++) for (let tx = Math.floor(left + 0.5); tx <= Math.floor(right + 0.5); tx++) {
        const tile = state.tiles[ty * state.width + tx];
        if (tile === undefined || tile.tx !== tx || tile.ty !== ty || !tile.hasRoad || tile.terrain === 'water' || tile.buildingId !== null) return false;
      }
      let wet = false;
      for (const loop of scene.shore.loops) {
        if (pointInPolygon(first, loop.smoothed)) wet = !wet;
        if (edgesTouch(hull, loop.smoothed) || loop.smoothed.some(p => pointInPolygon(p, hull))) return false;
      }
      return !wet;
    });
  };
}
