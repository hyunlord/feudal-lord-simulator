import type { Building } from '../content/buildingConfig';
import { buildingRoadAccessTiles } from './routing';
import { getOrthogonalRoadNeighbors, labelRoadComponents } from '../world/roadGraph';
import type { WallGrid } from '../world/wallTraversal';
import type { MarketRoadService } from '../population/marketAccess';
import type { GameState } from './engine.types';
import { houseLotArea } from '../geometry/buildingFootprint';
import type { ServiceAllocation } from '../population/serviceAllocation';

/**
 * MARKET-1 (MK-1): a market serves the homes within this many road steps of it — the smallest reach at which every home
 * the old rule (footprint distance 8 and a road) served is still served in the towns the current rules build (the five
 * guardrail towns need 13–38, the F0-A seed 4 town 40; calibration in docs/design/market-reach.md).
 */
export const MARKET_ROAD_REACH = 40;
/** MK-2: a market beyond the first is allowed only when the markets standing leave this many lots unserved. */
export const MARKET_UNSERVED_LOTS_FOR_ANOTHER = 12;

export function marketRoadService(grid: WallGrid): MarketRoadService {
  const connected = marketConnection(grid);
  const distance = marketRoadDistance(grid);
  return Object.assign(connected, { marketReach: (home: Building, market: Building) => {
    const steps = distance(home, market);
    return steps !== null && steps <= MARKET_ROAD_REACH;
  } });
}

/**
 * MK-4: the road connection alone (no road reach), for the bot's proofs over roads not yet built: a reach measured on
 * those would refuse sites the finished roads serve, so the proofs keep the old 8-tile radius as their stand-in
 * (the 40-step reach was calibrated to cover what that radius covers in the towns).
 */
export function marketConnectionOnly(grid: WallGrid): MarketRoadService {
  const connected = marketConnection(grid);
  return (home: Building, market: Building) => connected(home, market);
}

function marketConnection(grid: WallGrid): (home: Building, market: Building) => boolean {
  const labels = labelRoadComponents(grid);
  const accessLabels = new Map<Building, ReadonlySet<number>>();
  const components = (building: Building): ReadonlySet<number> => {
    const cached = accessLabels.get(building);
    if (cached !== undefined) return cached;
    const result = new Set<number>();
    for (const road of buildingRoadAccessTiles(grid, building)) {
      const label = labels.get(`${road.tx},${road.ty}`);
      if (label !== undefined) result.add(label);
    }
    accessLabels.set(building, result);
    return result;
  };
  return (home, market) => {
    const homeComponents = components(home);
    return [...components(market)].some(label => homeComponents.has(label));
  };
}

/**
 * MARKET-1 (MK-1, spec docs/design/market-reach.md): road steps from a market's road access to each road tile it
 * reaches (walls and bridges as the road graph has them). Cached per grid and market.
 */
const roadDistanceCache = new WeakMap<object, Map<string, ReadonlyMap<string, number>>>();

export function marketRoadDistanceMap(grid: WallGrid, market: Building): ReadonlyMap<string, number> {
  let byMarket = roadDistanceCache.get(grid);
  if (byMarket === undefined) { byMarket = new Map(); roadDistanceCache.set(grid, byMarket); }
  const key = `${market.id}:${market.tx},${market.ty}`;
  const cached = byMarket.get(key);
  if (cached !== undefined) return cached;
  const distances = new Map<string, number>();
  let frontier = buildingRoadAccessTiles(grid, market).map(tile => ({ tx: tile.tx, ty: tile.ty }));
  for (const tile of frontier) distances.set(`${tile.tx},${tile.ty}`, 0);
  for (let step = 1; frontier.length > 0; step += 1) {
    const next: { tx: number; ty: number }[] = [];
    for (const tile of frontier) for (const neighbour of getOrthogonalRoadNeighbors(grid, tile)) {
      const id = `${neighbour.tx},${neighbour.ty}`;
      if (distances.has(id)) continue;
      distances.set(id, step);
      next.push({ tx: neighbour.tx, ty: neighbour.ty });
    }
    frontier = next;
  }
  byMarket.set(key, distances);
  return distances;
}

/** MK-1: the road steps from a market to a home (the nearest of their road accesses), or null if no road joins them. */
export function marketRoadDistance(grid: WallGrid): (home: Building, market: Building) => number | null {
  return (home, market) => {
    const distances = marketRoadDistanceMap(grid, market);
    let best: number | null = null;
    for (const road of buildingRoadAccessTiles(grid, home)) {
      const distance = distances.get(`${road.tx},${road.ty}`);
      if (distance !== undefined && (best === null || distance < best)) best = distance;
    }
    return best;
  };
}

/**
 * MK-2: lots of lived-in homes the markets do not serve — out of reach, or reached but full (a market holds 24 lots).
 * Paused or understaffed markets are a staffing matter, not a reason for another market.
 */
export function marketUnservedLots(state: Pick<GameState, "houses" | "buildings">, services: ServiceAllocation): number {
  const homes = new Map(state.buildings.map(building => [building.id, building]));
  return state.houses.reduce((sum, house) => {
    const kind = services.houses.get(house.buildingId)?.market.kind;
    if (house.residents <= 0 || kind === undefined || kind === 'served' || kind === 'paused' || kind === 'understaffed') return sum;
    return sum + houseLotArea(homes.get(house.buildingId));
  }, 0);
}

/** MK-2: whether another market is allowed: the first always; then only while 12 lots or more go unserved. */
export function anotherMarketAllowed(state: Pick<GameState, "houses" | "buildings">, services: ServiceAllocation): boolean {
  return !state.buildings.some(building => building.kind === 'market') || marketUnservedLots(state, services) >= MARKET_UNSERVED_LOTS_FOR_ANOTHER;
}

/** MK-3: a market's reach for the placement preview: the road tiles within its reach and the homes it would serve. */
export function marketReach(state: GameState, market: Building): { readonly roadTiles: readonly { readonly tx: number; readonly ty: number }[]; readonly homeIds: readonly string[] } {
  const distances = marketRoadDistanceMap(state, market);
  const roadTiles = [...distances].filter(([, steps]) => steps <= MARKET_ROAD_REACH)
    .map(([key]) => { const [tx, ty] = key.split(',').map(Number) as [number, number]; return { tx, ty }; });
  const reach = marketRoadService(state).marketReach!;
  const homeIds = state.buildings.filter(building => building.kind === 'house' && reach(building, market)).map(building => building.id);
  return { roadTiles, homeIds };
}
