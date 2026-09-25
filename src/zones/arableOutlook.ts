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
  const years = new Map<string, { strips: number; cells: number; wheat: number }>();
  for (const layout of layouts) {
    for (const strip of layout.strips) {
      const assigned = tending.get(strip.id);
      if (assigned?.status !== "tended" || assigned.farmsteadId === null) continue;
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
