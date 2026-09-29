/**
 * Money rules (spec docs/design/money-rules.md, M-1…M-8). Money moves only through `postLedgerEntries`.
 *
 * Tolls and mill grinding are counted as they happen (`accrue*`); everything is charged at the period
 * close (tick divisible by `LEDGER_PERIOD_TICKS`) in a fixed order: income (rent, stall fees, mill tolls,
 * tolls), then this period's upkeep, then arrears oldest first. Upkeep the treasury cannot pay goes to
 * the arrears account and idles the facility (`upkeepUnpaid`) for that period; a facility that pays the next
 * period's upkeep runs again while its old debt waits (FIX-4 E3).
 */
import { plagueRentPermille, plagueUpkeepPermille } from "./plague";
import { reorganisationRentPermille, reorganisationTollPermille } from "./reorganisation";
import { stallFeePermille, stallFeeRightSource } from "./politics";
import { marketExpansionPermille, murageTollPermille, warTaxPermille } from "./war";
import type { SourceRef } from "../contracts";
import { MONEY_BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { LEDGER_PERIOD_TICKS, postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { LedgerPosting } from "../ledger/ledger.types";
import { deriveParcels } from "../zones/parcels";
import { zonesOf } from "../zones/zoneEdits";
import { houseIsStarving } from "../population/houseFood";
import { rightHeld } from "./lordshipState";
import type { House } from "../population/population.types";
import type { GameState } from "./engine.types";
import { householdServices } from "./householdServices";
import { EMPTY_MONEY, type MoneyState, type UpkeepArrear } from "./money.types";
import { scenarioOf } from "./scenarioState";
import { builtGatePointIds, tollPointSource } from "./tollCrossings";

type UpkeepKind = keyof typeof MONEY_BALANCE.upkeep;
const BUILDING_UPKEEP_KINDS: readonly string[] = ["well", "market", "church", "mill", "storehouse"] satisfies UpkeepKind[];
/**
 * FIX-4 E2 (HR-2): upkeep charge rank — the food chain first (a mill, and a barn or granary should they owe upkeep),
 * then services (well, market, church), then everything else. Was building id order, so a new well (1d) paid before
 * the mill and the mill stopped (UX-0b audit).
 */
const UPKEEP_RANK: Readonly<Record<string, number>> = { mill: 0, farmstead: 0, granary: 0, well: 1, market: 1, church: 1 };
const OTHER_UPKEEP_RANK = 2;

/** Within a rank the oldest building first: the opening village's buildings, then construction order. */
function buildingAge(building: Building): number {
  const ordinal = /^construction-site-(\d+)$/.exec(building.id)?.[1];
  return ordinal === undefined ? -1 : Number(ordinal);
}

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

/**
 * FIX-4 E10 (HR-10): a starving household pays no rent and one getting ready to leave (FP-3 stage 1) pays half, so the
 * lord's rent does not press a hungry town a second time. Half rounds down.
 */
export function rentRelief(house: House, tick: number, rent: number): number {
  if (houseIsStarving(house, tick)) return 0;
  return house.leavingSinceTick !== undefined ? Math.floor(rent / 2) : rent;
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
  let rent = 0;
  // F4-A (RG-8): after the collectors were chased the tenants withhold a period's rent (the court rolls burnt).
  const withheld = reorganisationRentPermille(state) === 0;
  for (const house of state.houses) {
    // EV-4: a burnt house pays no rent until it is rebuilt.
    if (house.residents <= 0 || house.burntTick !== undefined || withheld) continue;
    const plot = plots.get(house.buildingId);
    // F3-A (PL-8): once labour services are commuted the tenants pay money rent at its higher rate.
    const amount = Math.round(rentRelief(house, state.tick, homeRent(house, plot?.width ?? null)) * plagueRentPermille(state) / 1000);
    if (amount <= 0) continue;
    const sourceRefs: [SourceRef, ...SourceRef[]] = [buildingSource(house.buildingId, `level:${house.level}`)];
    if (plot !== undefined) sourceRefs.push({ type: "zone", id: plot.zoneId, detail: `frontage:${plot.width}` });
    postings.push({ account: "cash", category: "rent", amount, sourceRefs });
    rent += amount;
  }
  // F2-A (WR-4): the war tax adds its surcharge to the period's rent.
  const warTax = Math.round(rent * warTaxPermille(state) / 1000);
  if (warTax > 0) postings.push({ account: "cash", category: "war_tax", amount: warTax, sourceRefs: [{ type: "actor", id: "crown" }, { type: "claim", id: "war_tax", detail: `rent:${rent}` }] });
  // FAIL-3 (FL-1): a right lost to the overlord or the merchants pays its holder, not the treasury.
  const markets = rightHeld(state, "market"), tolls = rightHeld(state, "tolls"), mill = rightHeld(state, "mill");
  for (const market of [...state.buildings].filter(building => markets && building.kind === "market").sort((a, b) => a.id.localeCompare(b.id))) {
    const stalls = marketStalls(state, market);
    // FC-3/FC-4: a market charter lowers the dues (the right is a source of the posting).
    const right = stallFeeRightSource(state);
    // F2-A (WR-8): the market chosen over the wall raises the dues a quarter.
    const fee = Math.round(stalls * MONEY_BALANCE.stallFeePerStall * stallFeePermille(state) / 1000 * marketExpansionPermille(state) / 1000);
    if (stalls > 0 && fee > 0) postings.push({ account: "cash", category: "stall_fee", amount: fee,
      sourceRefs: [buildingSource(market.id, `stalls:${stalls}`), ...(right === null ? [] : [right])] });
  }
  const millWheat: Record<string, number> = {};
  for (const [millId, wheat] of Object.entries(money.millWheat).sort(([a], [b]) => a.localeCompare(b))) {
    const units = Math.floor(wheat / MONEY_BALANCE.millTollWheat);
    const remainder = wheat - units * MONEY_BALANCE.millTollWheat;
    if (remainder > 0 && state.buildings.some(building => building.id === millId)) millWheat[millId] = remainder;
    if (units > 0 && mill) postings.push({ account: "cash", category: "mill_toll", amount: units * MONEY_BALANCE.millTollPerUnit,
      sourceRefs: [buildingSource(millId, `wheat:${units * MONEY_BALANCE.millTollWheat}`)] });
  }
  for (const [pointId, count] of Object.entries(money.crossings).sort(([a], [b]) => a.localeCompare(b))) {
    // F4-A (RG-9): once the town holds the bridge tolls, half the tolls are the town's.
    const toll = Math.round(count * MONEY_BALANCE.tollPerCrossing * reorganisationTollPermille(state) / 1000);
    if (count > 0 && tolls && toll > 0) postings.push({ account: "cash", category: "toll", amount: toll,
      sourceRefs: [tollPointSource(pointId), { type: "trade", id: "carter_crossings", detail: `crossings:${count}` }] });
    // F2-A (WR-8): murage, the Crown's toll for the stone wall, while it is building.
    const murage = Math.round(count * MONEY_BALANCE.tollPerCrossing * (murageTollPermille(state) - 1000) / 1000);
    if (count > 0 && tolls && murage > 0) postings.push({ account: "cash", category: "murage", amount: murage,
      sourceRefs: [tollPointSource(pointId), { type: "right", id: "murage", detail: `crossings:${count}` }] });
  }
  return { postings, millWheat };
}

/** FIX-9: a period's rent at the usual rate (before money rent's rate and any withholding) — the forecasts' base. */
export function periodRent(state: GameState): number {
  const plots = homePlots(state);
  return state.houses.reduce((sum, house) => house.residents <= 0 || house.burntTick !== undefined ? sum
    : sum + rentRelief(house, state.tick, homeRent(house, plots.get(house.buildingId)?.width ?? null)), 0);
}

/** Facilities that owe upkeep this period, in charge order (E2): buildings by rank, then age, then gates by id. */
export function upkeepCharges(state: GameState): readonly { readonly facility: SourceRef; readonly amount: number }[] {
  const rank = (building: Building) => UPKEEP_RANK[building.kind] ?? OTHER_UPKEEP_RANK;
  const buildings = state.buildings
    .filter(building => BUILDING_UPKEEP_KINDS.includes(building.kind) && building.operationPaused !== true)
    .sort((a, b) => rank(a) - rank(b) || buildingAge(a) - buildingAge(b) || a.id.localeCompare(b.id))
    // F3-A (PL-8): while the tenants' week-work keeps the lord's works (labour services kept), the upkeep is lighter.
    .map(building => ({ facility: buildingSource(building.id), amount: Math.round(MONEY_BALANCE.upkeep[building.kind as UpkeepKind] * plagueUpkeepPermille(state) / 1000) }));
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

  // M-6: this period's upkeep first (E2 rank order, then gates), so an old debt cannot idle a facility
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
    const category = arrear.category ?? "upkeep";
    const sourceRefs: [SourceRef, ...SourceRef[]] = [arrear.facility, { type: "claim", id: `${category}:${arrear.tick}`, detail: "arrears_paid" }];
    postings.push({ account: "cash", category, amount: -arrear.amount, sourceRefs });
    postings.push({ account: "arrears", category, amount: -arrear.amount, sourceRefs });
    paid += 1;
  }
  arrears.unshift(...money.arrears.slice(paid));

  // FIX-4 E3 (M-6): only this period's unpaid charge idles a building; an old debt stays on the arrears account (and
  // in the finance cell) but does not stop a facility that paid this period. Was every building with any debt left.
  const unpaid = new Set(arrears.filter(arrear => arrear.tick === state.tick && arrear.facility.type === "building").map(arrear => arrear.facility.id));
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
