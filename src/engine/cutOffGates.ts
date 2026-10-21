import { PRESSURE_BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { palisadeProtectionForBuilding } from '../geometry/palisadeProtection';
import { getTile, type TileCoordinate } from '../world/grid';
import type { TileEdgePoint } from '../world/palisadeGeometry';
import { existingRoadComponent } from '../world/roadGraph';
import { canTraverseWallBoundary } from '../world/wallTraversal';
import type { GameState } from './engine.types';
import { isStraightRingPoint, palisadeRingPoints } from './palisadeSegments';
import { buildingRoadAccessTiles } from './routing';

/**
 * STONE-1a (lord mode, the user's ruling 2026-10-21): a gate for a town its own wall cut in two. Only when the wall
 * stands closed and a building outside it (a store, a working building, a house) has no road to any building inside —
 * the old gates first. For each such road component outside (the largest first), the gate goes where an inside road and
 * an outside road face each other across the wall and the tile outside is not water (seed 32's one gate opened on the
 * river, DGX engine-SINK-diag-695396c): a straight side first, then the top-left. One gate per component, `room` at most.
 * The gate is an opening like the others (`additionalGates`): no cost, no works.
 */
const keyOf = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;

function cutOffKind(building: Building): boolean {
  return building.kind === 'house' || building.kind === 'storehouse' || building.kind === 'granary'
    || BUILDING_CONFIG_BY_KIND[building.kind].workersRequired > 0;
}

/** The road components outside the wall whose buildings reach no building inside, the largest first. */
export function cutOffComponents(state: GameState): readonly (readonly TileCoordinate[])[] {
  const wall = state.palisade;
  if (state.agency === undefined || wall === null || wall.segments.length === 0 || !wall.segments.every(segment => segment.completed)) return [];
  const inside = state.buildings.filter(building => palisadeProtectionForBuilding(building, wall) === 'inside');
  if (inside.length === 0) return [];
  const reached = new Set(existingRoadComponent(state, inside.flatMap(building => buildingRoadAccessTiles(state, building))).map(keyOf));
  const components: { readonly tiles: readonly TileCoordinate[]; readonly buildings: number; readonly first: string }[] = [];
  const seen = new Set<string>();
  for (const building of state.buildings) {
    if (!cutOffKind(building) || palisadeProtectionForBuilding(building, wall) !== 'outside') continue;
    const access = buildingRoadAccessTiles(state, building).filter(tile => getTile(state, tile)?.hasRoad === true);
    if (access.length === 0 || access.some(tile => reached.has(keyOf(tile))) || access.some(tile => seen.has(keyOf(tile)))) continue;
    const tiles = existingRoadComponent(state, access);
    const keys = new Set(tiles.map(keyOf));
    for (const key of keys) seen.add(key);
    const buildings = state.buildings.filter(other => cutOffKind(other) && palisadeProtectionForBuilding(other, wall) === 'outside'
      && buildingRoadAccessTiles(state, other).some(tile => keys.has(keyOf(tile)))).length;
    components.push({ tiles, buildings, first: building.id });
  }
  return components.sort((a, b) => b.buildings - a.buildings || a.first.localeCompare(b.first)).map(entry => entry.tiles);
}

/** The gates to open now, at most `room`: one per cut-off component, where an inside and an outside road face each other. */
export function cutOffGateChoices(state: GameState, room: number): readonly TileEdgePoint[] {
  const wall = state.palisade;
  if (wall === null || room <= 0) return [];
  const components = cutOffComponents(state);
  if (components.length === 0) return [];
  const insideBuildings = state.buildings.filter(building => palisadeProtectionForBuilding(building, wall) === 'inside');
  const insideRoads = new Set(existingRoadComponent(state, insideBuildings.flatMap(building => buildingRoadAccessTiles(state, building))).map(keyOf));
  const ring = palisadeRingPoints(wall.polygon);
  const chosen: TileEdgePoint[] = [];
  for (const component of components) {
    if (chosen.length >= room) break;
    const opened = { ...state, palisade: { ...wall, additionalGates: [...(wall.additionalGates ?? []), ...chosen] } };
    // The crossings an inside road and this component's road make across the wall, the outside tile on land.
    const crossings: [TileCoordinate, TileCoordinate][] = [];
    for (const outside of component) {
      if (getTile(state, outside)?.terrain === 'water') continue;
      for (const next of [{ tx: outside.tx + 1, ty: outside.ty }, { tx: outside.tx - 1, ty: outside.ty }, { tx: outside.tx, ty: outside.ty + 1 }, { tx: outside.tx, ty: outside.ty - 1 }]) {
        if (insideRoads.has(keyOf(next)) && !canTraverseWallBoundary(opened, outside, next)) crossings.push([outside, next]);
      }
    }
    if (crossings.length === 0) continue;
    const best = ring.map((point, index) => {
      const withGate = { ...opened, palisade: { ...opened.palisade, additionalGates: [...opened.palisade.additionalGates, point] } };
      return { point, index, opens: crossings.filter(([from, to]) => canTraverseWallBoundary(withGate, from, to)).length };
    }).filter(option => option.opens > 0).sort((a, b) =>
      Number(isStraightRingPoint(ring, b.index)) - Number(isStraightRingPoint(ring, a.index))
      || b.opens - a.opens || a.point.y - b.point.y || a.point.x - b.point.x)[0];
    if (best !== undefined) chosen.push(best.point);
  }
  return chosen;
}

/** STONE-1a: the extra gates (the wall's own included) stop here — a guard against runaway openings, not a count. */
export const CUT_OFF_GATES_TOTAL_MAX = 3;

/** STONE-1a (save v57): lord mode keeps the tick its wall closed — set when the last segment is done, cleared when one opens. */
export function recordWallClosed(state: GameState): GameState {
  const wall = state.palisade;
  if (state.agency === undefined || wall === null) return state;
  const closed = wall.segments.length > 0 && wall.segments.every(segment => segment.completed);
  if (closed === (wall.closedTick !== undefined)) return state;
  if (closed) return { ...state, palisade: { ...wall, closedTick: state.tick } };
  const { closedTick: _closedTick, ...open } = wall;
  return { ...state, palisade: open };
}

/**
 * STONE-1a: a wall's first season close is not counted — a town the closing wall cuts for a moment is joined again by
 * its own roads by the next close (seeds 1, 22, 34 and 37, DGX engine-STONE1a-gatewhy-base-1f47ec2), so a gate opens from
 * the second close on (the user's ruling 2026-10-21, an approximation of "cut off a whole season": a building cut off for
 * a moment later still gets one — the cap of three bounds it). An older save's closed wall has no tick: closed long ago.
 */
export function pastFirstCloseAfterClosing(wall: { readonly closedTick?: number }, tick: number): boolean {
  if (wall.closedTick === undefined) return true;
  const season = PRESSURE_BALANCE.seasonTicks;
  return tick >= Math.ceil(wall.closedTick / season) * season + season;
}

/** STONE-1a: at each season's close in lord mode, the gates a cut-off town needs, while its extra gates stay at most three. */
export function openCutOffGates(state: GameState): GameState {
  const wall = state.palisade;
  if (state.agency === undefined || wall === null || state.tick <= 0 || state.tick % PRESSURE_BALANCE.seasonTicks !== 0) return state;
  if (!pastFirstCloseAfterClosing(wall, state.tick)) return state;
  const gates = cutOffGateChoices(state, CUT_OFF_GATES_TOTAL_MAX - (wall.additionalGates?.length ?? 0));
  return gates.length === 0 ? state : { ...state, palisade: { ...wall, additionalGates: [...(wall.additionalGates ?? []), ...gates] } };
}
