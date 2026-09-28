/**
 * WR-2 in kind (FIX-7, C5 CL-9, decisions WR5, FX7-1 and CL5): the wool levy paid in kind takes the town's fleece —
 * from the storehouses (by id), then the pastoral farms' yards — at `fleeceValue` a fleece, and only what the fleece
 * does not cover in cash. Since C5 the fleece is a good the pastoral farms shear (`cloth.ts`); FIX-7 reckoned it from
 * the pasture instead, while it was not yet one.
 */
import { CLOTH_BALANCE, FLEECE_RESOURCE } from "../content/clothConfig";
import type { Building } from "../content/buildingConfig";
import type { GameState } from "./engine.types";

const FLEECE_HOLDERS = ["storehouse", "pastoral_farm"] as const;

/** The buildings holding fleece, in the order the levy takes it (the storehouses, then the farms; by id). */
function holders(state: Pick<GameState, "buildings">): readonly Building[] {
  return state.buildings.filter(building => (FLEECE_HOLDERS as readonly string[]).includes(building.kind) && (building.inventory.fleece ?? 0) > 0)
    .sort((a, b) => FLEECE_HOLDERS.indexOf(a.kind as (typeof FLEECE_HOLDERS)[number]) - FLEECE_HOLDERS.indexOf(b.kind as (typeof FLEECE_HOLDERS)[number])
      || a.id.localeCompare(b.id));
}

/** CL-9: the fleece the town holds (storehouses and pastoral farms). */
export function townFleece(state: Pick<GameState, "buildings">): number {
  return holders(state).reduce((sum, building) => sum + Math.max(0, Math.floor(building.inventory.fleece ?? 0)), 0);
}

export interface WoolInKindSplit {
  /** Fleeces handed over (never more than the town holds, nor more than the payment needs). */
  readonly fleeces: number;
  /** Their value, pennies (the in-kind ledger line). */
  readonly inKind: number;
  /** What the fleece leaves unpaid, pennies (the cash charge; unpaid cash goes to arrears as any war charge). */
  readonly cash: number;
}

/** WR-2 in kind: a season's payment of `amount` pennies — the town's fleece first, the rest in cash. */
export function woolInKindSplit(state: Pick<GameState, "buildings">, amount: number): WoolInKindSplit {
  if (amount <= 0) return { fleeces: 0, inKind: 0, cash: 0 };
  const fleeces = Math.min(townFleece(state), Math.ceil(amount / CLOTH_BALANCE.fleeceValue));
  const inKind = Math.min(amount, fleeces * CLOTH_BALANCE.fleeceValue);
  return { fleeces, inKind, cash: amount - inKind };
}

/** CL-9: `fleeces` taken from the holders in order (the Crown's collectors carry them off). */
export function takeFleece(state: GameState, fleeces: number): GameState {
  let left = fleeces;
  const taken = new Map<string, number>();
  for (const building of holders(state)) {
    if (left <= 0) break;
    const amount = Math.min(left, Math.floor(building.inventory.fleece ?? 0));
    if (amount > 0) { taken.set(building.id, amount); left -= amount; }
  }
  if (taken.size === 0) return state;
  return { ...state, buildings: state.buildings.map(building => {
    const amount = taken.get(building.id);
    return amount === undefined ? building : { ...building, inventory: { ...building.inventory, [FLEECE_RESOURCE]: (building.inventory.fleece ?? 0) - amount } };
  }) };
}
