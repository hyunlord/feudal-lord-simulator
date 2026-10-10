import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { constructionDeliveryNeed, isBuildingConstructionSite } from '../economy/construction';
import { storageCapacityBlock } from '../economy/storage';
import { placementSpendableResource } from '../world/placement';
import type { GameState } from './engine.types';

/**
 * BOT-1 timber demand (decision BT6): the advisor adds a timber facility when the construction still waiting for timber
 * cannot be met by the timber the town made in the last window over the horizon, not after the S8-F1 shortage window
 * with stock below 120. S8-F1 only fired when, at a decision tick, spendable timber already covered the new facility
 * (logging camp 15, sawmill 30); a palisade takes each log as it is sawn, so seed 2 kept one sawmill through 230,000
 * ticks of palisade work at 2–4 spendable timber. Deciding on demand lets the advisor spend the stock the town has
 * when the work is proclaimed (seed 2: 146 timber, 1,078 wall timber, 24 made per window).
 *
 * The facility itself still needs its timber (placement rule); one facility at a time; staffed; storage not full.
 */
export const TIMBER_DEMAND_WINDOW_TICKS = 2400;
/** Ticks the waiting construction may take at the current timber output before another facility is added. */
export const TIMBER_DEMAND_HORIZON_TICKS = 24_000;

type TimberKind = 'logging_camp' | 'sawmill';

export function waitingTimberNeed(state: GameState): number {
  return state.constructionSites.reduce((sum, site) => sum + (constructionDeliveryNeed(site).timber ?? 0), 0);
}

/** Timber made per window by the town now (the tick's rolling 2,400-tick record). */
function timberMadePerWindow(state: GameState): number | null {
  const record = state.timberProductionWindow;
  if (record === undefined || state.tick < TIMBER_DEMAND_WINDOW_TICKS) return null;
  return record.produced;
}

/** Logs per tick the camps cut against logs per tick the sawmills saw: the short side gets the next facility. */
function bottleneck(buildings: readonly Building[]): TimberKind {
  const camp = BUILDING_CONFIG_BY_KIND.logging_camp.production;
  const mill = BUILDING_CONFIG_BY_KIND.sawmill.production;
  const camps = buildings.filter(building => building.kind === 'logging_camp').length;
  const sawmills = buildings.filter(building => building.kind === 'sawmill').length;
  const cut = camp === null ? 0 : camps / camp.ticksPerOutput;
  const sawn = mill === null ? 0 : sawmills * mill.inputPerOutput / mill.ticksPerOutput;
  return cut < sawn ? 'logging_camp' : 'sawmill';
}

/**
 * GROW-BLOCK-2a ⑥ (sandbox and lord mode, P-C3): a camp only while the sawmills keep up — none while the stores hold a
 * sawmill's window of logs (then a sawmill), and at most two camps a sawmill. The wall probe (engine-GROW2a-wall-98667ca)
 * found every seed's logs piling to 120–600 in the stores while its camps grew to 4–8; seeds 5 and 10 finished their
 * palisades in 6.6 years with one camp a sawmill, those with six to eight no sooner — the stumps were the cost.
 */
/** At most this many camps a sawmill (a camp cuts a log in 50 ticks, a sawmill takes 2 in 35: 2.85 by their rates). */
export const CAMPS_PER_SAWMILL_MAX = 2;

/** One sawmill's logs for a window (2 logs a timber every 35 ticks: 137). */
export function logBacklog(): number {
  const mill = BUILDING_CONFIG_BY_KIND.sawmill.production;
  return mill === null ? 0 : Math.round(mill.inputPerOutput * TIMBER_DEMAND_WINDOW_TICKS / mill.ticksPerOutput);
}

export function heldLogs(state: GameState): number {
  return state.buildings.reduce((sum, building) => sum + (building.inventory.logs ?? 0), 0);
}

export function campAllowed(state: GameState): boolean {
  const count = (kind: TimberKind) => state.buildings.filter(building => building.kind === kind).length
    + state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === kind).length;
  return count('logging_camp') < CAMPS_PER_SAWMILL_MAX * Math.max(1, count('sawmill')) && heldLogs(state) < logBacklog();
}

export function timberDemandExpansionKind(state: GameState): TimberKind | null {
  if (state.constructionSites.some(site => isBuildingConstructionSite(site) && (site.kind === 'logging_camp' || site.kind === 'sawmill'))) return null;
  const made = timberMadePerWindow(state);
  if (made === null) return null;
  const need = waitingTimberNeed(state);
  if (need <= made * (TIMBER_DEMAND_HORIZON_TICKS / TIMBER_DEMAND_WINDOW_TICKS)) return null;
  const short = bottleneck(state.buildings);
  const kind: TimberKind = short === 'logging_camp' && !campAllowed(state) ? 'sawmill' : short;
  const config = BUILDING_CONFIG_BY_KIND[kind];
  if (state.buildings.some(building => building.kind === kind && building.workers < config.workersRequired)
    || state.idleWorkers < config.workersRequired
    || storageCapacityBlock(state.buildings, kind === 'sawmill' ? 'timber' : 'logs') !== null
    || placementSpendableResource(state, 'timber') < (config.buildCost.timber ?? 0)) return null;
  return kind;
}

/**
 * F0-C1 (AR-10, guardrail run 2 seed 5): logs fill every storehouse while the sawmills are the short side (three camps
 * cut a little faster than one sawmill saws), so the storehouses stay full, the quarry has nowhere to send its stone
 * and is never placed, and the town waits for a church for good. Another sawmill first — staffed, with its timber.
 */
export function logOverflowKind(state: GameState): 'sawmill' | null {
  if (storageCapacityBlock(state.buildings, 'logs') === null || bottleneck(state.buildings) !== 'sawmill') return null;
  if (state.constructionSites.some(site => isBuildingConstructionSite(site) && (site.kind === 'logging_camp' || site.kind === 'sawmill'))) return null;
  const config = BUILDING_CONFIG_BY_KIND.sawmill;
  if (state.buildings.some(building => building.kind === 'sawmill' && building.workers < config.workersRequired)
    || state.idleWorkers < config.workersRequired
    || placementSpendableResource(state, 'timber') < (config.buildCost.timber ?? 0)) return null;
  return 'sawmill';
}
