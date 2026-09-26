import { autoplayConstructionSources } from './autoplayConstructionSources';
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { buildingFootprint } from '../geometry/buildingFootprint';
import type { House } from '../population/population.types';
import { getOrthogonalRoadNeighbors, roadLine } from '../world/roadGraph';
import type { TileCoordinate } from '../world/grid';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { buildingRoadAccessTiles } from './routing';

export const serviceTileKey = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;
export function serviceCandidate(kind: BuildingKind, point: TileCoordinate, id: string): Building {
  return { id, kind, tx: point.tx, ty: point.ty, workers: BUILDING_CONFIG_BY_KIND[kind].workersRequired,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
export function serviceFootprint(building: Building): readonly TileCoordinate[] {
  const size = buildingFootprint(building);
  return Array.from({ length: size.width * size.height }, (_, index) => ({
    tx: building.tx + index % size.width, ty: building.ty + Math.floor(index / size.width),
  }));
}
export function serviceSpaceBuildings(state: GameState): readonly Building[] {
  return [...state.buildings, ...state.constructionSites.filter(isBuildingConstructionSite)
    .map(site => serviceCandidate(site.kind, site, site.id))];
}
export function serviceSpaceHouses(state: GameState, buildings: readonly Building[]): readonly House[] {
  return buildings.filter(building => building.kind === 'house').map(building =>
    state.houses.find(home => home.buildingId === building.id) ?? {
      buildingId: building.id, level: 0, residents: 0, hasWater: false, breadStock: 0,
      lastServicedTick: 0, unmetRequirementTicks: 0,
    });
}
export function projectServiceAction(state: GameState, action: AutoplayAction): GameState {
  switch (action.kind) {
    case 'place_building': {
      const building = serviceCandidate(action.building, action, 'autoplay-service-space-new');
      const occupied = new Set(serviceFootprint(building).map(serviceTileKey));
      return { ...state, buildings: [...state.buildings, building],
        tiles: state.tiles.map(tile => occupied.has(serviceTileKey(tile)) ? { ...tile, buildingId: building.id } : tile) };
    }
    case 'place_road': {
      const road = new Set(roadLine(action.from, action.to).map(serviceTileKey));
      return { ...state, tiles: state.tiles.map(tile => road.has(serviceTileKey(tile)) ? { ...tile, hasRoad: true } : tile) };
    }
    case 'none': case 'proclaim_era': case 'set_wall_construction_priority': case 'paint_zone': case 'erase_zone': return state;
  }
}

const completedWalls = new WeakMap<NonNullable<GameState['palisade']>, NonNullable<GameState['palisade']>>();
/** A structural future-road query: no stock, staffing or era is applied to the game. */
export function potentialServiceRoads(state: GameState, buildings: readonly Building[]): GameState {
  const occupied = new Set(buildings.flatMap(building => serviceFootprint(building).map(serviceTileKey)));
  let palisade = state.palisade;
  if (palisade !== null) {
    let completed = completedWalls.get(palisade);
    if (completed === undefined) {
      completed = { ...palisade, segments: palisade.segments.map(segment => ({ ...segment, completed: true })) };
      completedWalls.set(palisade, completed);
    }
    palisade = completed;
  }
  return { ...state, buildings: [...buildings], palisade,
    tiles: state.tiles.map(tile => {
      const blocked = tile.buildingId !== null || occupied.has(serviceTileKey(tile));
      return { ...tile, hasRoad: !blocked && (tile.hasRoad || tile.terrain !== 'water') };
    }) };
}

/** All selected providers need both service access and construction-supply access. */
export function serviceWitnessRoads(state: GameState, potential: GameState, home: Building, providers: readonly Building[]): ReadonlySet<string> | null {
  const sources = autoplayConstructionSources(state);
  const targets = providers.map(provider => new Set(buildingRoadAccessTiles(potential, provider).map(serviceTileKey)));
  const service = connectTargets(potential, buildingRoadAccessTiles(potential, home), targets);
  if (service === null) return null;
  const supply = connectTargets(potential, sources.flatMap(source => buildingRoadAccessTiles(potential, source)), targets);
  return supply === null ? null : new Set([...service, ...supply]);
}

export function serviceRoadConnected(potential: GameState, home: Building, provider: Building): boolean {
  return connectTargets(potential, buildingRoadAccessTiles(potential, home),
    [new Set(buildingRoadAccessTiles(potential, provider).map(serviceTileKey))]) !== null;
}

function connectTargets(potential: GameState, starts: readonly TileCoordinate[], targets: readonly ReadonlySet<string>[]): ReadonlySet<string> | null {
  if (starts.length === 0 || targets.some(target => target.size === 0)) return null;
  const queue = [...starts];
  const parents = new Map<string, TileCoordinate | null>(starts.map(tile => [serviceTileKey(tile), null]));
  const reached: (TileCoordinate | undefined)[] = targets.map(() => undefined);
  for (let index = 0; index < queue.length; index++) {
    const tile = queue[index];
    if (tile === undefined) continue;
    for (let target = 0; target < targets.length; target++) {
      if (reached[target] === undefined && targets[target]?.has(serviceTileKey(tile))) reached[target] = tile;
    }
    if (reached.every(point => point !== undefined)) break;
    for (const next of getOrthogonalRoadNeighbors(potential, tile)) {
      const key = serviceTileKey(next);
      if (parents.has(key)) continue;
      parents.set(key, tile); queue.push(next);
    }
  }
  if (reached.some(point => point === undefined)) return null;
  const result = new Set<string>();
  for (const destination of reached) {
    let point = destination ?? null;
    while (point !== null) {
      const key = serviceTileKey(point); result.add(key); point = parents.get(key) ?? null;
    }
  }
  return result;
}
