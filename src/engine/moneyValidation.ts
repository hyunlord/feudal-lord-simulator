import { SOURCE_REF_TYPES } from "../contracts";
import { accountBalance } from "../ledger/ledger";
import type { Ledger } from "../ledger/ledger.types";

const isCountRecord = (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value)
  && Object.values(value).every(count => typeof count === "number" && Number.isSafeInteger(count) && count >= 0);

/**
 * Save-load check of the money-rule state (M-9): count records of whole non-negative numbers, an arrears
 * queue in tick order whose sum is the `arrears` account balance, and `upkeepUnpaid` only on buildings
 * that are in the queue (and every building in the queue marked). Returns the first problem, or null.
 */
export function moneyStateProblem(state: Readonly<Record<string, unknown>>): string | null {
  const buildings = Array.isArray(state.buildings) ? state.buildings as Record<string, unknown>[] : [];
  const marked = new Set(buildings.filter(building => building.upkeepUnpaid !== undefined).map(building => building.id));
  if (buildings.some(building => building.upkeepUnpaid !== undefined && building.upkeepUnpaid !== true)) return "building upkeepUnpaid must be true when present";
  const money = state.money as Record<string, unknown> | undefined;
  if (money === undefined) return marked.size === 0 ? null : "unpaid building without an arrears queue";
  if (typeof money !== "object" || money === null || !isCountRecord(money.crossings) || !isCountRecord(money.millWheat) || !Array.isArray(money.arrears)) {
    return "money must hold crossings, millWheat and arrears";
  }
  let owed = 0;
  let previousTick = -Infinity;
  const queued = new Set<unknown>();
  for (const arrear of money.arrears as Record<string, unknown>[]) {
    if (typeof arrear !== "object" || arrear === null || typeof arrear.tick !== "number" || !Number.isSafeInteger(arrear.tick)
      || arrear.tick < previousTick || arrear.tick > Number(state.tick)) return "money arrears are out of order";
    if (typeof arrear.amount !== "number" || !Number.isSafeInteger(arrear.amount) || arrear.amount <= 0) return "money arrear amount must be positive pennies";
    const facility = arrear.facility as Record<string, unknown> | undefined;
    if (typeof facility !== "object" || facility === null || typeof facility.id !== "string"
      || typeof facility.type !== "string" || !(SOURCE_REF_TYPES as readonly string[]).includes(facility.type)) return "money arrear facility is malformed";
    if (facility.type === "building") queued.add(facility.id);
    previousTick = arrear.tick;
    owed += arrear.amount;
  }
  if ([...marked].some(id => !queued.has(id)) || [...queued].some(id => buildings.some(building => building.id === id) && !marked.has(id))) {
    return "unpaid buildings do not match the arrears queue";
  }
  const ledger = state.ledger as Ledger | undefined;
  const balance = ledger === undefined ? 0 : accountBalance(ledger, "arrears");
  return balance === owed ? null : "money arrears do not match the arrears account";
}
