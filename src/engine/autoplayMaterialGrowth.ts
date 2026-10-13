import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { CHARTER_TIMBER_KINDS } from '../domain/wallReserve';
import { constructionDeliveryNeed, isBuildingConstructionSite } from '../economy/construction';
import { storageCapacityBlock } from '../economy/storage';
import { placementSpendableResource } from '../world/placement';
import type { GameState } from './engine.types';
import { evaluateEraRequirements } from './era';

/**
 * Option A (the user's rulings 2026-10-11/12, engine B's general rule (가)): when the next era's conditions or the town's
 * next growth step wait on a material, the town grows that material's production — under the same judgement as the
 * timber (⑥) — and stops once nothing waits. What waits is read from the data, never a list of special cases:
 *  a. the next era's unmet material conditions (the charter's 250 timber, the stone town's 400 stone);
 *  b. the next charter building's materials while it is neither standing nor placed (the church: 100 timber, 60 stone);
 *  c. the build costs of the supply chain's missing links for those materials (the quarry's 50 timber, the masonry's 45);
 * and, as before (BT6), the timber and stone the open construction sites still wait for.
 * Lord mode's (the sandbox keeps BT6's construction-only need and has no stone growth): the guardrail stays as it is.
 */
type Material = 'timber' | 'stone';

const KINDS = Object.keys(BUILDING_CONFIG_BY_KIND) as BuildingKind[];
const producersOf = (resource: string): readonly BuildingKind[] => KINDS.filter(kind => BUILDING_CONFIG_BY_KIND[kind].production?.output === resource);
const builtOrPlaced = (state: GameState, kind: BuildingKind): number => state.buildings.filter(building => building.kind === kind).length
  + state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === kind).length;

/** b: the next charter building (market, then church), while it neither stands nor is placed — after the charter only. */
function waitingCharterBuilding(state: GameState): BuildingKind | null {
  if (state.era === 'hamlet') return null;
  const next = CHARTER_TIMBER_KINDS.find(kind => !state.buildings.some(building => building.kind === kind));
  return next === undefined || builtOrPlaced(state, next) > 0 ? null : next;
}

/** a: what the next era's conditions still lack of each material (spendable timber, spendable stone). */
function eraShortfall(state: GameState): ReadonlyMap<string, number> {
  const shortfall = new Map<string, number>();
  for (const requirement of evaluateEraRequirements(state)) {
    if (requirement.met || (requirement.key !== 'timber' && requirement.key !== 'stone')) continue;
    shortfall.set(requirement.key, (shortfall.get(requirement.key) ?? 0) + requirement.target - requirement.current);
  }
  return shortfall;
}

/** c: the chain links with nothing standing or placed for the materials wanted, walked through their inputs. */
function missingLinks(state: GameState, materials: Iterable<string>): ReadonlySet<BuildingKind> {
  const missing = new Set<BuildingKind>();
  const visit = (resource: string, depth: number) => {
    const producers = producersOf(resource);
    if (producers.length === 0 || depth > 3) return;
    const standing = producers.filter(kind => builtOrPlaced(state, kind) > 0);
    if (standing.length === 0) missing.add(producers[0]!);
    for (const kind of standing.length === 0 ? [producers[0]!] : standing) {
      const input = BUILDING_CONFIG_BY_KIND[kind].production?.input ?? null;
      if (input !== null) visit(input, depth + 1);
    }
  };
  for (const material of materials) visit(material, 0);
  return missing;
}

/** Option A: the `resource` the town waits for — the open sites' need (BT6), plus a, b and c above. */
export function materialGrowthNeed(state: GameState, resource: Material): number {
  const sites = state.constructionSites.reduce((sum, site) => sum + (constructionDeliveryNeed(site)[resource] ?? 0), 0);
  const era = eraShortfall(state);
  const charter = waitingCharterBuilding(state);
  const charterCost = charter === null ? {} : BUILDING_CONFIG_BY_KIND[charter].buildCost as Partial<Record<string, number>>;
  const wanted = new Set<string>([...era.keys(), ...Object.keys(charterCost).filter(material => (charterCost[material] ?? 0) > 0)]);
  const chain = [...missingLinks(state, wanted)].reduce((sum, kind) => sum + ((BUILDING_CONFIG_BY_KIND[kind].buildCost as Partial<Record<string, number>>)[resource] ?? 0), 0);
  return sites + (era.get(resource) ?? 0) + (charterCost[resource] ?? 0) + chain;
}

/**
 * Option A, the stone side by ⑥'s rule: the quarry while the masonries keep up — a masonry instead while the stores hold a
 * masonry's window of raw stone, and at most two quarries a masonry (a quarry cuts one in 60 ticks, a masonry takes two
 * in 45: 2.7 by their rates, as the camps' two a sawmill). The stone the town makes is read from its staffed quarries and
 * masonries (the buildings' rates) — the state keeps no stone record as it keeps `timberProductionWindow`, and one would
 * change the save — over BT6's window and horizon. One facility at a time; staffed; storage not full; its timber held.
 */
export const QUARRIES_PER_MASONRY_MAX = 2;
const STONE_WINDOW_TICKS = 2400;
const STONE_HORIZON_TICKS = 24_000;

function stoneMadePerWindow(state: GameState): number {
  const quarry = BUILDING_CONFIG_BY_KIND.quarry.production;
  const masonry = BUILDING_CONFIG_BY_KIND.masonry.production;
  if (quarry === null || masonry === null) return 0;
  const staffed = (kind: BuildingKind) => state.buildings.filter(building => building.kind === kind
    && building.workers >= BUILDING_CONFIG_BY_KIND[kind].workersRequired).length;
  const raw = staffed('quarry') * STONE_WINDOW_TICKS / quarry.ticksPerOutput;
  return Math.min(staffed('masonry') * STONE_WINDOW_TICKS / masonry.ticksPerOutput, raw / masonry.inputPerOutput);
}

/** One masonry's raw stone for a window (2 a stone every 45 ticks: 107). */
function rawStoneBacklog(): number {
  const masonry = BUILDING_CONFIG_BY_KIND.masonry.production;
  return masonry === null ? 0 : Math.round(masonry.inputPerOutput * STONE_WINDOW_TICKS / masonry.ticksPerOutput);
}

export function stoneDemandExpansionKind(state: GameState): 'quarry' | 'masonry' | null {
  if (state.agency === undefined) return null;
  if (state.constructionSites.some(site => isBuildingConstructionSite(site) && (site.kind === 'quarry' || site.kind === 'masonry'))) return null;
  const need = materialGrowthNeed(state, 'stone');
  if (need <= 0 || need <= stoneMadePerWindow(state) * (STONE_HORIZON_TICKS / STONE_WINDOW_TICKS)) return null;
  const quarries = builtOrPlaced(state, 'quarry');
  const masonries = builtOrPlaced(state, 'masonry');
  const rawHeld = state.buildings.reduce((sum, building) => sum + (building.inventory.stone_raw ?? 0), 0);
  const kind = quarries === 0 ? 'quarry' : masonries === 0 ? 'masonry'
    : rawHeld >= rawStoneBacklog() || quarries >= QUARRIES_PER_MASONRY_MAX * masonries ? 'masonry' : 'quarry';
  const config = BUILDING_CONFIG_BY_KIND[kind];
  const output = kind === 'quarry' ? 'stone_raw' : 'stone';
  if (state.buildings.some(building => building.kind === kind && building.workers < config.workersRequired)
    || state.idleWorkers < config.workersRequired
    || storageCapacityBlock(state.buildings, output) !== null
    || placementSpendableResource(state, 'timber') < (config.buildCost.timber ?? 0)) return null;
  return kind;
}
