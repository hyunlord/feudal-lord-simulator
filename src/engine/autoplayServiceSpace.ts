import { hasBudgetedServicePlan } from './autoplayServiceBudget';
import { autoplayConstructionSources } from './autoplayConstructionSources';
import { HOUSEHOLD_SERVICE_CONFIG } from '../population/serviceAllocation';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { roadLine } from '../world/roadGraph';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { findAutoplayServiceWitness, type ServiceSpaceWitness } from './autoplayServiceSpaceWitness';
import { projectServiceAction, serviceCandidate, serviceFootprint, serviceSpaceBuildings, serviceTileKey } from './autoplayServiceSpaceRoutes';

type Layout = { budget?: boolean; readonly tiles: GameState['tiles']; readonly geometry: string; readonly witnesses: Map<string, ServiceSpaceWitness | null>; readonly decisions: Map<string, boolean> };
const byState = new WeakMap<GameState, Layout>();
const tileKeys = new WeakMap<GameState['tiles'], string>();
const layouts = new Map<string, Layout>();
function layoutFor(state: GameState): Layout {
  const cached = byState.get(state);
  if (cached !== undefined) return cached;
  const buildings = serviceSpaceBuildings(state);
  let tiles = tileKeys.get(state.tiles);
  if (tiles === undefined) {
    tiles = state.tiles.map(tile => `${tile.tx},${tile.ty},${tile.terrain},${Number(tile.hasRoad)},${Number(tile.buildingId !== null)}`).join(';');
    tileKeys.set(state.tiles, tiles);
  }
  const geometry = JSON.stringify([state.width, state.height, autoplayConstructionSources(state).map(source => source.id).sort(),
    buildings.map(building => [building.id, building.kind, building.tx, building.ty, buildingFootprint(building)]).sort(),
    state.palisade, state.constructionSites.filter(site => site.kind === 'palisade_segment' || site.kind === 'stone_wall_segment').map(site => [site.id, site.path])]);
  const signature = geometry + tiles;
  let layout = layouts.get(signature);
  if (layout === undefined) {
    layout = { tiles: state.tiles, geometry, witnesses: new Map(), decisions: new Map() };
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
      for (const [id, witness] of previous.witnesses) {
        if (witness !== null && ![...changed].some(tile => witness.pads.has(tile) || witness.roads.has(tile))) layout.witnesses.set(id, witness);
      }
    }
  }
  byState.set(state, layout);
  layouts.delete(signature); layouts.set(signature, layout);
  if (layouts.size > 128) {
    const oldest = layouts.keys().next().value;
    if (oldest !== undefined) layouts.delete(oldest);
  }
  return layout;
}
function witnessFor(layout: Layout, state: GameState, home: ReturnType<typeof serviceSpaceBuildings>[number]): ServiceSpaceWitness | null {
  const cached = layout.witnesses.get(home.id);
  if (cached !== undefined) return cached;
  const witness = findAutoplayServiceWitness(state, home);
  layout.witnesses.set(home.id, witness);
  return witness;
}

/** Existing impossible homes do not freeze recovery; new losses and unsupported new homes are rejected. */
export function preservesAutoplayServiceSpace(state: GameState, action: AutoplayAction, knownProjection?: GameState): boolean {
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
  const changesAllocation = serviceSpaceBuildings(state).filter(building => building.kind === 'house').reduce((sum, home) => { const size = buildingFootprint(home); return sum + size.width * size.height; }, 0) > HOUSEHOLD_SERVICE_CONFIG.market.capacity
    || (action.kind === 'place_building' && ['house', 'market', 'church'].includes(action.building));
  let allowed = true;
  for (const home of serviceSpaceBuildings(state).filter(building => building.kind === 'house')) {
    const witness = witnessFor(layout, state, home);
    if (witness === null) continue;
    if (knownProjection === undefined && !changesAllocation && ![...changed].some(tile =>
      witness.pads.has(tile) || (action.kind === 'place_building' && witness.roads.has(tile)))) continue;
    projected ??= projectServiceAction(state, action);
    if (witnessFor(layoutFor(projected), projected, home) === null) { allowed = false; break; }
  }
  if (allowed && action.kind === 'place_building' && action.building === 'house') {
    projected ??= projectServiceAction(state, action);
    const home = projected.buildings.find(building => building.id === 'autoplay-service-space-new');
    allowed = home !== undefined && witnessFor(layoutFor(projected), projected, home) !== null;
  }
  if (allowed && (action.kind === 'place_building' || action.kind === 'place_road' || knownProjection !== undefined)) {
    projected ??= projectServiceAction(state, action);
    const nextLayout = layoutFor(projected);
    if ((action.kind === 'place_building' && action.building === 'house') || (layout.budget ??= hasBudgetedServicePlan(state))) {
      allowed = nextLayout.budget ??= hasBudgetedServicePlan(projected);
    }
  }
  if (key !== null) layout.decisions.set(key, allowed);
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
