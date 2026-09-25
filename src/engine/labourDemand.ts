import { operationSuspended, type Building } from "../content/buildingConfig";
import { LABOUR_BALANCE, SEASON_BALANCE } from "../content/balanceConfig";
import type { GameState } from "./engine.types";
import { arableLayouts, inYearTick, stripTending } from "../zones/arableFields";
import { pushableMill } from "../agents/millPush";
import { householdSlotDemand } from "../population/householdSlots";
import type { House } from "../population/population.types";

/** LB-4: where the adults went on one tick (`GameState.labour`, save v11). */
export interface LabourSummary {
  readonly adults: number;
  readonly facility: number;
  readonly construction: number;
  readonly fieldHands: number;
  readonly hauling: number;
  readonly household: number;
  readonly idle: number;
}

export type SeasonName = (typeof SEASON_BALANCE.bands)[number]["name"];

function inBand(inYear: number, from: number, until: number): boolean {
  return from <= until ? inYear >= from && inYear < until : inYear >= from || inYear < until;
}

/** LB-5: the season band of a tick (sowing ×2 · early summer ×1 · harvest ×2 · early winter ×0.5). */
export function laborSeason(tick: number): (typeof SEASON_BALANCE.bands)[number] {
  const inYear = inYearTick(tick);
  return SEASON_BALANCE.bands.find(band => inBand(inYear, band.from, band.until)) ?? SEASON_BALANCE.bands[1];
}

/** LB-5: adults a farmstead's tended cells need this season (its own workers count first). */
export function farmsteadFieldNeed(tendedCells: number, tick: number): number {
  const cells = Math.max(0, Math.floor(tendedCells));
  return Math.ceil(cells * SEASON_BALANCE.fieldHandsPerCellPermille * laborSeason(tick).permille / 1_000_000);
}

/**
 * Cache (rule 10). (a) Key: the tending map identity, which `stripTending` memoises on layouts, tiles and farmstead
 * positions. (b) Cell counts depend only on the layouts and the tending, both inside that key. (c) One pass over
 * the strips per miss; measured in the C3 report together with the tending cache.
 */
let tendedMemo: { tending: unknown; value: ReadonlyMap<string, number> } | null = null;

/** LB-5: strip cells each farmstead tends (only `tended` strips: a farmstead with a road). */
export function tendedCellsByFarmstead(state: GameState): ReadonlyMap<string, number> {
  if (!(state.zones ?? []).some(zone => zone.kind === "arable")) return new Map();
  const layouts = arableLayouts(state);
  const tending = stripTending(state, layouts);
  if (tendedMemo !== null && tendedMemo.tending === tending) return tendedMemo.value;
  const value = new Map<string, number>();
  for (const layout of layouts) {
    for (const strip of layout.strips) {
      const assigned = tending.get(strip.id);
      if (assigned?.status !== "tended" || assigned.farmsteadId === null) continue;
      value.set(assigned.farmsteadId, (value.get(assigned.farmsteadId) ?? 0) + strip.cells.length);
    }
  }
  tendedMemo = { tending, value };
  return value;
}

export interface LabourDemandInput {
  readonly state: GameState;
  /** Buildings after the facility allocation (their `workers` set). */
  readonly buildings: readonly Building[];
  readonly houses: readonly House[];
  /** Adults the facility and construction allocation left (`idleWorkers`). */
  readonly remaining: number;
  readonly constructionWorkers: number;
  readonly adults: number;
  readonly tick: number;
  readonly eligible: (building: Building) => boolean;
}

/**
 * LB-4 tiers 7–9 on what the R1-fix allocation left: granary haulers (LB-7), farmstead field hands (LB-5, by
 * building id) and household slots (LB-8). Writes `fieldHands`/`haulers` on the buildings (absent when 0).
 */
export function allocateLabourDemands(input: LabourDemandInput): { readonly buildings: readonly Building[]; readonly summary: LabourSummary } {
  let remaining = Math.max(0, Math.floor(input.remaining));
  const tended = tendedCellsByFarmstead({ ...input.state, buildings: input.buildings as Building[] });
  const hands = new Map<string, number>();
  const haulers = new Map<string, number>();
  const ordered = [...input.buildings].sort((a, b) => a.id.localeCompare(b.id));
  const operating = (building: Building) => !operationSuspended(building) && input.eligible(building);
  const mills = ordered.filter(building => building.kind === "mill");
  for (const building of ordered) {
    if (building.kind !== "granary" || !operating(building) || !mills.some(mill => pushableMill(building, mill))) continue;
    const assigned = Math.min(remaining, LABOUR_BALANCE.haulersPerGranary);
    if (assigned > 0) haulers.set(building.id, assigned);
    remaining -= assigned;
  }
  for (const building of ordered) {
    if (building.kind !== "farmstead" || !operating(building)) continue;
    const need = farmsteadFieldNeed(tended.get(building.id) ?? 0, input.tick);
    const assigned = Math.min(remaining, Math.max(0, need - building.workers));
    if (assigned > 0) hands.set(building.id, assigned);
    remaining -= assigned;
  }
  const householdDemand = input.houses.reduce((total, house) => total + householdSlotDemand(house), 0);
  const household = Math.min(remaining, householdDemand);
  remaining -= household;
  const buildings = input.buildings.map(building => {
    const fieldHands = hands.get(building.id) ?? 0;
    const hauling = haulers.get(building.id) ?? 0;
    if ((building.fieldHands ?? 0) === fieldHands && (building.haulers ?? 0) === hauling) return building;
    const { fieldHands: _hands, haulers: _haulers, ...rest } = building;
    return { ...rest, ...(fieldHands > 0 ? { fieldHands } : {}), ...(hauling > 0 ? { haulers: hauling } : {}) };
  });
  const sum = (values: ReadonlyMap<string, number>) => [...values.values()].reduce((total, value) => total + value, 0);
  const facility = input.buildings.reduce((total, building) => total + building.workers, 0);
  return {
    buildings,
    summary: {
      adults: input.adults,
      facility,
      construction: input.constructionWorkers,
      fieldHands: sum(hands),
      hauling: sum(haulers),
      household,
      idle: remaining,
    },
  };
}

/** LB-9: idle adults ÷ population in permille (the A″ ratio); `null` with nobody living in town. */
export function idleLabourPermille(state: Pick<GameState, "labour" | "population">): number | null {
  if (state.labour === undefined || state.population <= 0) return null;
  return Math.round(state.labour.idle * 1000 / state.population);
}
