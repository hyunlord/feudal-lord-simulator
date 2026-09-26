/**
 * Money rules (spec docs/design/money-rules.md, M-1…M-8). Money moves only through `postLedgerEntries`.
 *
 * Tolls and mill grinding are counted as they happen (`accrue*`); everything is charged at the period
 * close (tick divisible by `LEDGER_PERIOD_TICKS`) in a fixed order: income (rent, stall fees, mill tolls,
 * tolls), then this period's upkeep, then arrears oldest first. Upkeep the treasury cannot pay goes to
 * the arrears account and idles the facility (`upkeepUnpaid`) until it is paid.
 */
import type { SourceRef } from "../contracts";
import { MONEY_BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { LEDGER_PERIOD_TICKS, postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { LedgerPosting } from "../ledger/ledger.types";
import { deriveParcels } from "../zones/parcels";
import { zonesOf } from "../zones/zoneEdits";
import type { House } from "../population/population.types";
import type { GameState } from "./engine.types";
import { householdServices } from "./householdServices";
import { EMPTY_MONEY, type MoneyState, type UpkeepArrear } from "./money.types";
import { scenarioOf } from "./scenarioState";
import { builtGatePointIds, tollPointSource } from "./tollCrossings";

type UpkeepKind = keyof typeof MONEY_BALANCE.upkeep;
const BUILDING_UPKEEP_KINDS: readonly string[] = ["well", "market", "church", "mill", "storehouse"] satisfies UpkeepKind[];

export function moneyOf(state: Pick<GameState, "money">): MoneyState {
  return state.money ?? EMPTY_MONEY;
}

function addCounts(record: Readonly<Record<string, number>>, counts: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  const next: Record<string, number> = { ...record };
  for (const [key, count] of counts) next[key] = (next[key] ?? 0) + count;
  return next;
}

/** M-4: adds carter crossings of toll points (from `carterCrossings`) to the period count. */
export function accrueTollCrossings(state: GameState, crossings: ReadonlyMap<string, number>): GameState {
  if (crossings.size === 0) return state;
  const money = moneyOf(state);
  return { ...state, money: { ...money, crossings: addCounts(money.crossings, crossings) } };
}

/** M-3: adds wheat ground by mills (mill id → wheat) when the scenario gives the lord the mill. */
export function accrueMilledWheat(state: GameState, milled: ReadonlyMap<string, number>): GameState {
  if (milled.size === 0 || !scenarioOf(state).economyRules.millMonopoly) return state;
  const money = moneyOf(state);
  return { ...state, money: { ...money, millWheat: addCounts(money.millWheat, milled) } };
}

/** Rent of one occupied home (M-2): level rate, scaled by plot frontage on a burgage plot. */
export function homeRent(house: Pick<House, "level">, frontageWidth: number | null): number {
  const rate = MONEY_BALANCE.rentByLevel[Math.max(0, Math.min(MONEY_BALANCE.rentByLevel.length - 1, house.level))] ?? 0;
  return frontageWidth === null ? rate : Math.round(rate * frontageWidth / MONEY_BALANCE.rentReferenceFrontage);
}

/** Homes standing on burgage plots: house id → plot (zone id and frontage width). Empty without zones. */
export function homePlots(state: GameState): ReadonlyMap<string, { readonly zoneId: string; readonly width: number }> {
  const plots = new Map<string, { zoneId: string; width: number }>();
  for (const zone of zonesOf(state)) {
    if (zone.kind !== "burgage") continue;
    for (const parcel of deriveParcels(zone, state)) {
      for (const id of parcel.buildingIds) plots.set(id, { zoneId: zone.id, width: parcel.width });
    }
  }
  return plots;
}

function marketOperating(building: Building): boolean {
  return building.kind === "market" && building.operationPaused !== true && building.upkeepUnpaid !== true
    && building.workers >= BUILDING_CONFIG_BY_KIND.market.workersRequired;
}

/** M-5: stalls an operating market sets out: one per `homesPerStall` homes it serves, capped. */
export function marketStalls(state: GameState, market: Building): number {
  if (!marketOperating(market)) return 0;
  let served = 0;
  for (const services of householdServices(state).houses.values()) {
    if (services.market.kind === "served" && services.market.providerId === market.id) served += 1;
  }
  return Math.min(MONEY_BALANCE.maxStallsPerMarket, Math.ceil(served / MONEY_BALANCE.homesPerStall));
}

function buildingSource(id: string, detail?: string): SourceRef {
  return detail === undefined ? { type: "building", id } : { type: "building", id, detail };
}

function periodIncome(state: GameState, money: MoneyState): { readonly postings: LedgerPosting[]; readonly millWheat: Record<string, number> } {
  const postings: LedgerPosting[] = [];
  const plots = homePlots(state);
  for (const house of state.houses) {
    // EV-4: a burnt house pays no rent until it is rebuilt.
    if (house.residents <= 0 || house.burntTick !== undefined) continue;
    const plot = plots.get(house.buildingId);
    const amount = homeRent(house, plot?.width ?? null);
    if (amount <= 0) continue;
    const sourceRefs: [SourceRef, ...SourceRef[]] = [buildingSource(house.buildingId, `level:${house.level}`)];
    if (plot !== undefined) sourceRefs.push({ type: "zone", id: plot.zoneId, detail: `frontage:${plot.width}` });
    postings.push({ account: "cash", category: "rent", amount, sourceRefs });
  }
  for (const market of [...state.buildings].filter(building => building.kind === "market").sort((a, b) => a.id.localeCompare(b.id))) {
    const stalls = marketStalls(state, market);
    if (stalls > 0) postings.push({ account: "cash", category: "stall_fee", amount: stalls * MONEY_BALANCE.stallFeePerStall,
      sourceRefs: [buildingSource(market.id, `stalls:${stalls}`)] });
  }
  const millWheat: Record<string, number> = {};
  for (const [millId, wheat] of Object.entries(money.millWheat).sort(([a], [b]) => a.localeCompare(b))) {
    const units = Math.floor(wheat / MONEY_BALANCE.millTollWheat);
    const remainder = wheat - units * MONEY_BALANCE.millTollWheat;
    if (remainder > 0 && state.buildings.some(building => building.id === millId)) millWheat[millId] = remainder;
    if (units > 0) postings.push({ account: "cash", category: "mill_toll", amount: units * MONEY_BALANCE.millTollPerUnit,
      sourceRefs: [buildingSource(millId, `wheat:${units * MONEY_BALANCE.millTollWheat}`)] });
  }
  for (const [pointId, count] of Object.entries(money.crossings).sort(([a], [b]) => a.localeCompare(b))) {
    if (count > 0) postings.push({ account: "cash", category: "toll", amount: count * MONEY_BALANCE.tollPerCrossing,
      sourceRefs: [tollPointSource(pointId), { type: "trade", id: "carter_crossings", detail: `crossings:${count}` }] });
  }
  return { postings, millWheat };
}

/** Facilities that owe upkeep this period, in charge order: buildings by id, then gates by id. */
export function upkeepCharges(state: GameState): readonly { readonly facility: SourceRef; readonly amount: number }[] {
  const buildings = state.buildings
    .filter(building => BUILDING_UPKEEP_KINDS.includes(building.kind) && building.operationPaused !== true)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(building => ({ facility: buildingSource(building.id), amount: MONEY_BALANCE.upkeep[building.kind as UpkeepKind] }));
  const gates = builtGatePointIds(state.palisade).map(pointId => ({ facility: tollPointSource(pointId), amount: MONEY_BALANCE.upkeep.gate }));
  return [...buildings, ...gates];
}

/**
 * The period close (M-2…M-6). Runs on ticks divisible by the ledger period; a no-op otherwise.
 * Returns the state unchanged when nothing is charged (a town with no homes and no facilities).
 */
export function settleMoneyPeriod(state: GameState): GameState {
  if (state.tick <= 0 || state.tick % LEDGER_PERIOD_TICKS !== 0) return state;
  const money = moneyOf(state);
  const income = periodIncome(state, money);
  const postings: LedgerPosting[] = [...income.postings];
  let cash = treasuryBalance(state) + income.postings.reduce((sum, posting) => sum + posting.amount, 0);

  // M-6: this period's upkeep first (buildings by id, then gates), so an old debt cannot idle a facility
  // the treasury can pay for now; then arrears oldest first, stopping at the first charge it cannot cover.
  const arrears: UpkeepArrear[] = [];
  for (const charge of upkeepCharges(state)) {
    if (cash >= charge.amount) {
      cash -= charge.amount;
      postings.push({ account: "cash", category: "upkeep", amount: -charge.amount, sourceRefs: [charge.facility] });
      continue;
    }
    arrears.push({ tick: state.tick, amount: charge.amount, facility: charge.facility });
    postings.push({ account: "arrears", category: "upkeep", amount: charge.amount,
      sourceRefs: [charge.facility, { type: "claim", id: `upkeep:${state.tick}`, detail: "unpaid" }] });
  }
  let paid = 0;
  for (const arrear of money.arrears) {
    if (cash < arrear.amount) break;
    cash -= arrear.amount;
    const sourceRefs: [SourceRef, ...SourceRef[]] = [arrear.facility, { type: "claim", id: `upkeep:${arrear.tick}`, detail: "arrears_paid" }];
    postings.push({ account: "cash", category: "upkeep", amount: -arrear.amount, sourceRefs });
    postings.push({ account: "arrears", category: "upkeep", amount: -arrear.amount, sourceRefs });
    paid += 1;
  }
  arrears.unshift(...money.arrears.slice(paid));

  const unpaid = new Set(arrears.filter(arrear => arrear.facility.type === "building").map(arrear => arrear.facility.id));
  const buildings = state.buildings.map(building => {
    const owes = unpaid.has(building.id);
    if (owes === (building.upkeepUnpaid === true)) return building;
    if (owes) return { ...building, upkeepUnpaid: true as const, workers: 0 };
    const { upkeepUnpaid: _cleared, ...rest } = building;
    return rest;
  });
  const nextMoney: MoneyState = { crossings: {}, millWheat: income.millWheat, arrears };
  const settled: GameState = { ...state, buildings, money: nextMoney };
  if (postings.length === 0) return settled;
  const posted = postLedgerEntries(settled, postings);
  return { ...settled, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}

/** M-7: the stone-wall project spends its cost when proclaimed. Callers check `canAffordProject` first. */
export function spendStoneWallProject(state: GameState): GameState {
  const posted = postLedgerEntries(state, [{ account: "cash", category: "project", amount: -MONEY_BALANCE.stoneWallProjectCost,
    sourceRefs: [{ type: "policy", id: "stone_wall_project", detail: "proclaimed" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}

export function canAffordStoneWallProject(state: Pick<GameState, "ledger" | "treasuryCoin">): boolean {
  return treasuryBalance(state) >= MONEY_BALANCE.stoneWallProjectCost;
}

/** Arrears owed in total and by facility id (buildings and gates), for causes and the finance cell. */
export function outstandingArrears(state: Pick<GameState, "money">): { readonly total: number; readonly byFacility: ReadonlyMap<string, number> } {
  const byFacility = new Map<string, number>();
  let total = 0;
  for (const arrear of moneyOf(state).arrears) {
    total += arrear.amount;
    byFacility.set(arrear.facility.id, (byFacility.get(arrear.facility.id) ?? 0) + arrear.amount);
  }
  return { total, byFacility };
}
