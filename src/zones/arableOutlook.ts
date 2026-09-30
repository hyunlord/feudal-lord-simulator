/**
 * Grain outlook (spec AF-10/AF-11): the harvest a field is set to give in a year, and whether the stored grain
 * lasts until the next harvest. Derived only; the same state gives the same answer.
 */
import { ARABLE_CONFIG } from "../content/arableConfig";
import { BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import type { GameState } from "../engine/engine.types";
import { arableLayouts, inYearTick, stripSeasonYield, stripTending, type ArableZoneLayout } from "./arableFields";
import type { HarvestRecord } from "./arable.types";

const WHEAT_PER_BREAD = BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 2;

export interface FarmsteadYear {
  readonly farmsteadId: string;
  readonly strips: number;
  readonly cells: number;
  /** A full season's wheat from the strips it tends, counting at most `predictedCellsPerFarmstead` cells. */
  readonly wheat: number;
}

/** AF-10: the season's expected wheat per farmstead (strip order; cells past its labour share do not count). */
export function farmsteadYears(state: GameState, layouts: readonly ArableZoneLayout[] = arableLayouts(state)): readonly FarmsteadYear[] {
  const tending = stripTending(state, layouts);
  // C4 (AL-2): a barley farmstead's strips feed no one (the town's wheat outlook leaves them out).
  const barley = new Set(state.buildings.filter(building => building.crop === "barley").map(building => building.id));
  const years = new Map<string, { strips: number; cells: number; wheat: number }>();
  for (const layout of layouts) {
    for (const strip of layout.strips) {
      const assigned = tending.get(strip.id);
      if (assigned?.status !== "tended" || assigned.farmsteadId === null || barley.has(assigned.farmsteadId)) continue;
      const year = years.get(assigned.farmsteadId) ?? { strips: 0, cells: 0, wheat: 0 };
      if (year.cells < ARABLE_CONFIG.predictedCellsPerFarmstead) year.wheat += stripSeasonYield(strip);
      year.strips += 1;
      year.cells += strip.cells.length;
      years.set(assigned.farmsteadId, year);
    }
  }
  return [...years.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([farmsteadId, year]) => ({ farmsteadId, ...year }));
}

/** AF-10: the whole town's expected wheat in a season. */
export function expectedAnnualWheat(state: GameState): number {
  return farmsteadYears(state).reduce((sum, year) => sum + year.wheat, 0);
}

/** GP-1: completed years the harvest record keeps. */
export const HARVEST_RECORD_YEARS = 3;

/**
 * GP-1: the harvest record after a tick that took `harvested` wheat into the barns. `before` is the tick's state before
 * the fields worked (its expected harvest is the year's `expected`, taken once, at the year's first harvest). A new
 * calendar year moves the counted year into `past` (only a year that had a harvest) and keeps the last three.
 */
export function nextHarvestRecord(before: GameState, harvested: number, lost = 0): HarvestRecord | undefined {
  const year = Math.floor(before.tick / BALANCE.TICKS_PER_YEAR);
  let record = before.harvestRecord;
  if (record !== undefined && record.year !== year) {
    const past = record.expected === undefined ? record.past
      : [...record.past, { expected: record.expected, wheat: record.wheat, lost: record.lost }].slice(-HARVEST_RECORD_YEARS);
    record = { year, wheat: 0, lost: 0, past };
  }
  if (harvested <= 0 && (lost <= 0 || record?.expected === undefined)) return record;
  const counted = record ?? { year, wheat: 0, lost: 0, past: [] };
  return { ...counted, expected: counted.expected ?? expectedAnnualWheat(before), wheat: counted.wheat + harvested, lost: counted.lost + lost };
}

/**
 * GP-2: the share of the expected harvest the last years' fields really grew, ‰ — taken in plus the ripe wheat lost at
 * winter (a full barn or too few hands is a harvesting limit, not the land's; more fields would not mend it). At most
 * 1,000; none recorded = 1,000.
 */
export function realisedHarvestPermille(state: Pick<GameState, "harvestRecord">): number {
  const past = state.harvestRecord?.past ?? [];
  const expected = past.reduce((sum, year) => sum + year.expected, 0);
  if (expected <= 0) return 1000;
  return Math.min(1000, Math.floor(past.reduce((sum, year) => sum + year.wheat + year.lost, 0) * 1000 / expected));
}

/** GP-2: the expected harvest scaled by what the last years realised — the bot's grain supply. */
export function realisedAnnualWheat(state: GameState): number {
  return Math.floor(expectedAnnualWheat(state) * realisedHarvestPermille(state) / 1000);
}

/** Wheat the homes eat (as bread through the mills) in `ticks` ticks at today's residents. */
export function homeWheatDemand(state: Pick<GameState, "houses">, ticks: number): number {
  const rations = state.houses.reduce((sum, house) => sum + houseFoodRation(house), 0);
  return Math.ceil(rations * ticks / HOUSE_FOOD_INTERVAL) * WHEAT_PER_BREAD;
}

export interface GrainReserveOutlook {
  /** Wheat in barns and granaries plus bread (as wheat) in granaries, mills and homes. */
  readonly storedWheat: number;
  /** Ticks until the next harvest can begin (in-year `growTicks`). */
  readonly ticksUntilHarvest: number;
  readonly neededWheat: number;
  /** AF-11 `reserve_short`: the store runs out before the next harvest. */
  readonly short: boolean;
}

export function grainReserveOutlook(state: GameState): GrainReserveOutlook {
  const t = inYearTick(state.tick);
  const ticksUntilHarvest = t < ARABLE_CONFIG.growTicks ? ARABLE_CONFIG.growTicks - t : BALANCE.TICKS_PER_YEAR - t + ARABLE_CONFIG.growTicks;
  const storedWheat = state.buildings.reduce((sum, building) => sum + (building.inventory.wheat ?? 0) + (building.inventory.bread ?? 0) * WHEAT_PER_BREAD, 0)
    + state.houses.reduce((sum, house) => sum + house.breadStock * WHEAT_PER_BREAD, 0);
  const neededWheat = homeWheatDemand(state, ticksUntilHarvest);
  return { storedWheat, ticksUntilHarvest, neededWheat, short: neededWheat > storedWheat };
}
