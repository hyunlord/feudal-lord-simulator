import { autoplayConstructionSources } from './autoplayConstructionSources';
import { autoplaySearchActive, markAutoplaySearchLimit, spendAutoplaySearch } from './autoplaySearchBudget';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import { houseLotArea } from '../geometry/buildingFootprint';
import { HOUSEHOLD_SERVICE_CONFIG, allocateHouseServices } from '../population/serviceAllocation';
import { canPlaceBuildingBeforeRoad } from '../world/placement';
import type { GameState } from './engine.types';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { marketRoadService } from './marketService';
import { potentialServiceRoads, serviceCandidate, serviceFootprint, serviceSpaceBuildings, serviceSpaceHouses, serviceTileKey, serviceWitnessRoads } from './autoplayServiceSpaceRoutes';

type Kind = 'market' | 'church';
interface Pad { readonly building: Building; readonly mask: bigint; readonly occupied: ReadonlySet<string> }

export function canCoverRemainingServiceLots(
  candidates: readonly Pick<Pad, 'mask' | 'occupied'>[], missing: bigint, remaining: number,
): boolean {
  if (missing === 0n) return true;
  if (remaining <= 0) return false;
  if (remaining > 2) return true;
  const first = missing & -missing;
  for (const left of candidates) {
    if ((left.mask & first) === 0n) continue;
    const rest = missing & ~left.mask;
    if (rest === 0n) return true;
    if (remaining === 1) continue;
    for (const right of candidates) {
      if ((right.mask & rest) !== rest) continue;
      if (![...left.occupied].some(tile => right.occupied.has(tile))) return true;
    }
  }
  return false;
}

export interface ServiceBudgetWitness {
  readonly pads: ReadonlySet<string>;
  readonly roads: ReadonlySet<string>;
}

export interface ServiceBudgetSearch {
  readonly witness: ServiceBudgetWitness | null;
  readonly complete: boolean;
}

export function hasBudgetedServicePlan(state: GameState): boolean {
  return findBudgetedServicePlan(state) !== null;
}

export function findBudgetedServicePlan(state: GameState): ServiceBudgetWitness | null {
  return searchBudgetedServicePlan(state).witness;
}

/** A structural joint plan; incomplete search is not proof that no plan exists. */
export function searchBudgetedServicePlan(state: GameState): ServiceBudgetSearch {
  const buildings = serviceSpaceBuildings(state).map(building => building.kind === 'market' || building.kind === 'church'
    ? { ...building, workers: BUILDING_CONFIG_BY_KIND[building.kind].workersRequired } : building);
  const homes = buildings.filter(building => building.kind === 'house');
  if (homes.length === 0) return { witness: { pads: new Set(), roads: new Set() }, complete: true };
  const lots = homes.reduce((sum, home) => sum + houseLotArea(home), 0);
  const houses = serviceSpaceHouses(state, buildings);
  const full = (1n << BigInt(homes.length)) - 1n;
  const staffedState = { ...state, buildings, constructionSites: state.constructionSites.filter(site => site.kind === 'palisade_segment' || site.kind === 'stone_wall_segment') };
  const potentialConnectivity = marketRoadService(potentialServiceRoads(staffedState, buildings));
  const sources = autoplayConstructionSources(staffedState);
  let branches = 0;
  let truncated = false;
  const candidatePools = new Map<Kind, readonly Pad[]>();
  const candidates = (kind: Kind): readonly Pad[] => {
    const cached = candidatePools.get(kind);
    if (cached !== undefined) return cached;
    const result: Pad[] = [];
    for (const tile of state.tiles) {
      const building = serviceCandidate(kind, tile, `budget-${kind}-${tile.tx}-${tile.ty}`);
      let mask = 0n;
      homes.forEach((home, index) => { if (buildingFootprintDistance(home, building) <= BUILDING_CONFIG_BY_KIND[kind].serviceRadius && potentialConnectivity(home, building)) mask |= 1n << BigInt(index); });
      if (mask === 0n || !sources.some(source => potentialConnectivity(source, building)) || !hasAutoplayBuildingClearance(staffedState, kind, tile)) continue;
      const placement = canPlaceBuildingBeforeRoad({ ...staffedState, era: 'stone_town' }, kind, tile.tx, tile.ty);
      if (!placement.ok && placement.reason !== 'insufficient_materials') continue;
      result.push({ building, mask, occupied: new Set(serviceFootprint(building).map(serviceTileKey)) });
    }
    candidatePools.set(kind, result);
    return result;
  };
  const routesFor = (all: readonly Building[], kind: Kind): ReadonlySet<string> | null => {
    if (!spendAutoplaySearch()) { truncated = true; return null; }
    const potential = potentialServiceRoads(staffedState, all);
    const allocation = allocateHouseServices({ houses, buildings: all, roadService: marketRoadService(potential) });
    const roads = new Set<string>();
    for (const home of homes) {
      const access = allocation.houses.get(home.id)?.[kind];
      if (access?.kind !== 'served') return null;
      const provider = all.find(building => building.id === access.providerId);
      if (provider === undefined) return null;
      const route = serviceWitnessRoads(staffedState, potential, home, [provider]);
      if (route === null) return null;
      for (const tile of route) roads.add(tile);
    }
    return roads;
  };
  const allocatedMask = (all: readonly Building[], kind: Kind): bigint => {
    if (!spendAutoplaySearch()) { truncated = true; return 0n; }
    const potential = potentialServiceRoads(staffedState, all);
    const allocation = allocateHouseServices({ houses, buildings: all, roadService: marketRoadService(potential) });
    return homes.reduce((mask, home, index) => allocation.houses.get(home.id)?.[kind].kind === 'served'
      ? mask | (1n << BigInt(index)) : mask, 0n);
  };
  const plan = (kind: Kind, additions: readonly Pad[], continuation: (additions: readonly Pad[], roads: ReadonlySet<string>) => boolean): boolean => {
    const existing = buildings.filter(building => building.kind === kind);
    const slots = Math.ceil(lots / HOUSEHOLD_SERVICE_CONFIG[kind].capacity) + 1 - existing.length;
    if (slots < 0) return false;
    const covered = allocatedMask([...buildings, ...additions.map(pad => pad.building)], kind);
    const search = (selected: readonly Pad[], mask: bigint, remaining: number): boolean => {
      if (truncated) return false;
      const occupied = new Set(selected.flatMap(pad => [...pad.occupied]));
      let available: readonly Pad[] | undefined;
      if (mask !== full) {
        if (remaining <= 0) return false;
        available = candidates(kind).filter(pad => ![...pad.occupied].some(tile => occupied.has(tile)));
        if (!canCoverRemainingServiceLots(available, full & ~mask, remaining)) return false;
      }
      if (autoplaySearchActive() && branches++ >= 12) { truncated = true; markAutoplaySearchLimit(); return false; }
      if (!spendAutoplaySearch()) { truncated = true; return false; }
      if (mask === full) {
        const all = [...buildings, ...selected.map(pad => pad.building)];
        const roads = routesFor(all, kind);
        if (roads !== null && continuation(selected, roads)) return true;
        mask = allocatedMask(all, kind);
        if (mask === full) return false;
      }
      if (remaining <= 0) return false;
      const missing = full & ~mask;
      const first = missing & -missing;
      available ??= candidates(kind).filter(pad => ![...pad.occupied].some(tile => occupied.has(tile)));
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
  let witness: ServiceBudgetWitness | null = null;
  plan('market', [], markets => plan('church', markets, (all, churchRoads) => {
    const combined = [...buildings, ...all.map(pad => pad.building)];
    const marketRoads = routesFor(combined, 'market');
    if (marketRoads === null) return false;
    witness = { pads: new Set(combined.filter(building => building.kind === 'market' || building.kind === 'church')
      .flatMap(building => serviceFootprint(building).map(serviceTileKey))), roads: new Set([...marketRoads, ...churchRoads]) };
    return true;
  }));
  return { witness, complete: witness !== null || !truncated };
}

function bitCount(value: bigint): number {
  let count = 0;
  for (let remaining = value; remaining !== 0n; remaining &= remaining - 1n) count++;
  return count;
}
