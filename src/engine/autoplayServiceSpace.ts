import { autoplaySearchExhausted } from './autoplaySearchBudget';
import { searchBudgetedServicePlan, type ServiceBudgetSearch } from './autoplayServiceBudget';
import { autoplayConstructionSources } from './autoplayConstructionSources';
import { HOUSEHOLD_SERVICE_CONFIG } from '../population/serviceAllocation';
import { buildingFootprint, houseLotArea } from '../geometry/buildingFootprint';
import { roadLine } from '../world/roadGraph';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { findAutoplayServiceWitness, type ServiceSpaceWitness } from './autoplayServiceSpaceWitness';
import { projectServiceAction, serviceCandidate, serviceFootprint, serviceSpaceBuildings, serviceTileKey } from './autoplayServiceSpaceRoutes';

type Layout = { readonly signature: string; budget?: ServiceBudgetSearch; readonly tiles: GameState['tiles']; readonly geometry: string; readonly witnesses: Map<string, ServiceSpaceWitness | null>; readonly decisions: Map<string, boolean> };
let byState = new WeakMap<GameState, Layout>();
const tileKeys = new WeakMap<GameState['tiles'], string>();
const layouts = new Map<string, Layout>();
/** Per-decision ownership prevents bounded-search answers depending on prior cache warmth.
 * The key retains terrain, occupancy, walls and eligible supply-source identities.
 * Current workers, stocks and house levels cannot change this future-layout proof:
 * staffing/materials are deferred and demand is lot area. Candidate-limit measurements
 * (seed 3: >12s to 0.23s) are recorded in S8-search-budget.md. */
export function resetAutoplayServiceSearch(): void {
  byState = new WeakMap();
  layouts.clear();
}
function rememberLayout(layout: Layout): Layout {
  layouts.delete(layout.signature); layouts.set(layout.signature, layout);
  if (layouts.size > 128) {
    const oldest = layouts.keys().next().value;
    if (oldest !== undefined) layouts.delete(oldest);
  }
  return layout;
}
function layoutFor(state: GameState): Layout {
  const cached = byState.get(state);
  if (cached !== undefined) return rememberLayout(cached);
  const buildings = serviceSpaceBuildings(state);
  let tiles = tileKeys.get(state.tiles);
  if (tiles === undefined) {
    tiles = state.tiles.map(tile => `${tile.tx},${tile.ty},${tile.terrain},${Number(tile.hasRoad)},${Number(tile.buildingId !== null)}`).join(';');
    tileKeys.set(state.tiles, tiles);
  }
  const geometry = JSON.stringify([state.width, state.height, autoplayConstructionSources(state).map(source => source.id).sort(),
    buildings.map(building => [building.id, building.kind, building.tx, building.ty, buildingFootprint(building), building.operationPaused === true]).sort(),
    state.palisade, state.constructionSites.filter(site => site.kind === 'palisade_segment' || site.kind === 'stone_wall_segment').map(site => [site.id, site.path])]);
  const signature = geometry + tiles;
  let layout = layouts.get(signature);
  if (layout === undefined) {
    layout = { signature, tiles: state.tiles, geometry, witnesses: new Map(), decisions: new Map() };
    const previous = [...layouts.values()].reverse().find(entry => entry.geometry === geometry);
    const lots = buildings.filter(building => building.kind === 'house').reduce((sum, home) => {
      const size = buildingFootprint(home); return sum + size.width * size.height;
    }, 0);
    if (previous !== undefined && lots <= HOUSEHOLD_SERVICE_CONFIG.market.capacity
      && state.tiles.every((tile, index) => tile.terrain === previous.tiles[index]?.terrain
        && (tile.terrain !== 'water' || tile.hasRoad === previous.tiles[index]?.hasRoad))) {
      const changed = new Set(state.tiles.filter((tile, index) => {
        const old = previous.tiles[index];
        return old === undefined || tile.buildingId !== old.buildingId || tile.hasRoad !== old.hasRoad || tile.tx !== old.tx || tile.ty !== old.ty;
      }).map(serviceTileKey));
      const budget = previous.budget?.witness;
      if (budget !== undefined && budget !== null && state.tiles.every((tile, index) => {
        const old = previous.tiles[index];
        if (old === undefined || old.tx !== tile.tx || old.ty !== tile.ty) return false;
        const key = serviceTileKey(tile);
        return !changed.has(key) || (!budget.pads.has(key) && (!budget.roads.has(key)
          || (tile.buildingId === old.buildingId && (!old.hasRoad || tile.hasRoad))));
      }) && previous.budget !== undefined) layout.budget = previous.budget;
      for (const [id, witness] of previous.witnesses) {
        if (witness !== null && ![...changed].some(tile => witness.pads.has(tile) || witness.roads.has(tile))) layout.witnesses.set(id, witness);
      }
    }
  }
  byState.set(state, layout);
  return rememberLayout(layout);
}
function budgetFor(layout: Layout, state: GameState): ServiceBudgetSearch {
  if (layout.budget !== undefined) return layout.budget;
  const result = searchBudgetedServicePlan(state);
  if (result.complete) layout.budget = result;
  return result;
}

function witnessFor(layout: Layout, state: GameState, home: ReturnType<typeof serviceSpaceBuildings>[number]): ServiceSpaceWitness | null {
  const cached = layout.witnesses.get(home.id);
  if (cached !== undefined) return cached;
  const witness = findAutoplayServiceWitness(state, home);
  if (!autoplaySearchExhausted()) layout.witnesses.set(home.id, witness);
  return witness;
}

/** Existing impossible homes do not freeze recovery; new losses and unsupported new homes are rejected. */
export function preservesAutoplayServiceSpace(state: GameState, action: AutoplayAction, knownProjection?: GameState): boolean {
  if (autoplaySearchExhausted()) return false;
  if (action.kind === 'none' || (action.kind === 'proclaim_era' && knownProjection === undefined)) return true;
  const layout = layoutFor(state);
  const key = knownProjection === undefined ? JSON.stringify(action) : null;
  const cached = key === null ? undefined : layout.decisions.get(key);
  if (cached !== undefined) return cached;
  let projected = knownProjection;
  const occupied = action.kind === 'place_building'
    ? serviceFootprint(serviceCandidate(action.building, action, 'autoplay-service-space-new'))
    : action.kind === 'place_road' ? roadLine(action.from, action.to) : [];
  const changed = new Set(occupied.map(serviceTileKey));
  const addsHouse = action.kind === 'place_building' && action.building === 'house';
  const lots = serviceSpaceBuildings(state).filter(building => building.kind === 'house')
    .reduce((sum, home) => sum + houseLotArea(home), 0);
  // Below both capacities, one extra lot cannot displace an existing allocation.
  // Its occupied pads/routes still trigger reproof, and its own joint plan is new.
  const changesAllocation = lots + Number(addsHouse) > Math.min(HOUSEHOLD_SERVICE_CONFIG.market.capacity, HOUSEHOLD_SERVICE_CONFIG.church.capacity)
    || (action.kind === 'place_building' && ['market', 'church'].includes(action.building));
  let allowed = true;
  let complete = true;
  for (const home of serviceSpaceBuildings(state).filter(building => building.kind === 'house')) {
    const witness = witnessFor(layout, state, home);
    if (autoplaySearchExhausted()) return false;
    if (witness === null) continue;
    if (knownProjection === undefined && !changesAllocation && ![...changed].some(tile =>
      witness.pads.has(tile) || (action.kind === 'place_building' && witness.roads.has(tile)))) continue;
    projected ??= projectServiceAction(state, action);
    if (witnessFor(layoutFor(projected), projected, home) === null || autoplaySearchExhausted()) { allowed = false; break; }
  }
  if (allowed && action.kind === 'place_building' && action.building === 'house') {
    projected ??= projectServiceAction(state, action);
    const home = projected.buildings.find(building => building.id === 'autoplay-service-space-new');
    allowed = home !== undefined && witnessFor(layoutFor(projected), projected, home) !== null;
  }
  if (allowed && (action.kind === 'place_building' || action.kind === 'place_road' || knownProjection !== undefined)) {
    projected ??= projectServiceAction(state, action);
    const nextLayout = layoutFor(projected);
    const search = budgetFor(layout, state);
    const witness = search.witness;
    if ((action.kind === 'place_building' && action.building === 'house') || witness !== null || !search.complete) {
      if (knownProjection === undefined && !addsHouse && !changesAllocation && witness !== null
        && ![...changed].some(tile => witness.pads.has(tile) || (action.kind === 'place_building' && witness.roads.has(tile)))) {
        nextLayout.budget = search;
      }
      const nextSearch = budgetFor(nextLayout, projected);
      complete = search.complete && nextSearch.complete;
      allowed = nextSearch.witness !== null;
    }
  }
  if (autoplaySearchExhausted()) return false;
  if (key !== null && complete) layout.decisions.set(key, allowed);
  return allowed;
}

/** Preserve a legal nonempty prefix; the next decision searches with the new road occupancy. */
export function serviceSafeRoadAction(state: GameState, action: AutoplayAction): AutoplayAction {
  if (action.kind !== 'place_road') return action;
  const line = roadLine(action.from, action.to);
  for (let length = line.length; length > 0; length--) {
    const to = line[length - 1];
    if (to === undefined) continue;
    const candidate = { ...action, to };
    if (preservesAutoplayServiceSpace(state, candidate)) return candidate;
  }
  return { kind: 'none' };
}
