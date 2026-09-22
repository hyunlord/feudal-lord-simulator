import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import { houseLotArea } from '../geometry/buildingFootprint';
import { HOUSEHOLD_SERVICE_CONFIG, allocateHouseServices } from '../population/serviceAllocation';
import { canPlaceBuilding } from '../world/placement';
import type { GameState } from './engine.types';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { marketRoadService } from './marketService';
import { potentialServiceRoads, serviceCandidate, serviceFootprint, serviceSpaceBuildings, serviceSpaceHouses, serviceTileKey, serviceWitnessRoads } from './autoplayServiceSpaceRoutes';

type Kind = 'market' | 'church';
interface Pad { readonly building: Building; readonly mask: bigint; readonly occupied: ReadonlySet<string> }

/** A structural joint plan, with staffing and materials deferred but actual walls and water retained. */
export function hasBudgetedServicePlan(state: GameState): boolean {
  const buildings = serviceSpaceBuildings(state).map(building => building.kind === 'market' || building.kind === 'church'
    ? { ...building, workers: BUILDING_CONFIG_BY_KIND[building.kind].workersRequired } : building);
  const homes = buildings.filter(building => building.kind === 'house');
  if (homes.length === 0) return true;
  const lots = homes.reduce((sum, home) => sum + houseLotArea(home), 0);
  const houses = serviceSpaceHouses(state, buildings);
  const full = (1n << BigInt(homes.length)) - 1n;
  const staffedState = { ...state, buildings, constructionSites: state.constructionSites.filter(site => site.kind === 'palisade_segment' || site.kind === 'stone_wall_segment') };
  const candidatePools = new Map<Kind, readonly Pad[]>();
  const candidates = (kind: Kind): readonly Pad[] => {
    const cached = candidatePools.get(kind);
    if (cached !== undefined) return cached;
    const result: Pad[] = [];
    for (const tile of state.tiles) {
      const building = serviceCandidate(kind, tile, `budget-${kind}-${tile.tx}-${tile.ty}`);
      let mask = 0n;
      homes.forEach((home, index) => { if (buildingFootprintDistance(home, building) <= BUILDING_CONFIG_BY_KIND[kind].serviceRadius) mask |= 1n << BigInt(index); });
      if (mask === 0n || !hasAutoplayBuildingClearance(staffedState, kind, tile)) continue;
      const placement = canPlaceBuilding({ ...staffedState, era: 'stone_town' }, kind, tile.tx, tile.ty);
      if (!placement.ok && placement.reason !== 'insufficient_materials') continue;
      result.push({ building, mask, occupied: new Set(serviceFootprint(building).map(serviceTileKey)) });
    }
    candidatePools.set(kind, result);
    return result;
  };
  const feasible = (all: readonly Building[], kind: Kind): boolean => {
    const potential = potentialServiceRoads(staffedState, all);
    const allocation = allocateHouseServices({ houses, buildings: all, roadService: marketRoadService(potential) });
    return homes.every(home => allocation.houses.get(home.id)?.[kind].kind === 'served')
      && homes.every(home => {
        const id = allocation.houses.get(home.id)?.[kind].providerId;
        const provider = all.find(building => building.id === id);
        return provider !== undefined && serviceWitnessRoads(staffedState, potential, home, [provider]) !== null;
      });
  };
  const allocatedMask = (all: readonly Building[], kind: Kind): bigint => {
    const potential = potentialServiceRoads(staffedState, all);
    const allocation = allocateHouseServices({ houses, buildings: all, roadService: marketRoadService(potential) });
    return homes.reduce((mask, home, index) => allocation.houses.get(home.id)?.[kind].kind === 'served'
      ? mask | (1n << BigInt(index)) : mask, 0n);
  };
  const plan = (kind: Kind, additions: readonly Pad[], continuation: (additions: readonly Pad[]) => boolean): boolean => {
    const existing = buildings.filter(building => building.kind === kind);
    const slots = Math.ceil(lots / HOUSEHOLD_SERVICE_CONFIG[kind].capacity) + 1 - existing.length;
    const covered = allocatedMask([...buildings, ...additions.map(pad => pad.building)], kind);
    const search = (selected: readonly Pad[], mask: bigint, remaining: number): boolean => {
      if (mask === full) {
        const all = [...buildings, ...selected.map(pad => pad.building)];
        if (feasible(all, kind) && continuation(selected)) return true;
        mask = allocatedMask(all, kind);
        if (mask === full) return false;
      }
      if (remaining <= 0) return false;
      const missing = full & ~mask;
      const first = missing & -missing;
      const occupied = new Set(selected.flatMap(pad => [...pad.occupied]));
      const available = candidates(kind).filter(pad => ![...pad.occupied].some(tile => occupied.has(tile)));
      if ((available.reduce((union, pad) => union | pad.mask, mask) & full) !== full) return false;
      const options = available.filter(pad => (pad.mask & first) !== 0n)
        .map(pad => ({ pad, gain: bitCount(pad.mask & missing) }))
        .sort((a, b) => b.gain - a.gain || a.pad.building.ty - b.pad.building.ty || a.pad.building.tx - b.pad.building.tx);
      for (const { pad } of options) {
        if (search([...selected, pad], mask | pad.mask, remaining - 1)) return true;
      }
      return false;
    };
    return search(additions, covered, slots);
  };
  return plan('market', [], markets => plan('church', markets, all => {
    const combined = [...buildings, ...all.map(pad => pad.building)];
    return feasible(combined, 'market');
  }));
}

function bitCount(value: bigint): number {
  let count = 0;
  for (let remaining = value; remaining !== 0n; remaining &= remaining - 1n) count++;
  return count;
}
