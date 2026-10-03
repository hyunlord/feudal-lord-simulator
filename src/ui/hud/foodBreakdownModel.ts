import { operationSuspended } from "../../content/buildingConfig";
import type { GameState } from "../../engine/engine.types";
import { foodShortage, foodShortHouseIds } from "../../engine/foodShortage";
import type { TileCoordinate } from "../../world/grid";
import { houseDiagnosisModel } from "../houseDiagnosisModel";
import { FOOD_BREAKDOWN_COPY as COPY } from "./foodBreakdownCopy.ko";
import { foodDays } from "./statusPillModel";
import { stuckRows } from "./stuckStockView";

// LM-R1 (playtest 2026-10-02 #5): "식량 277일" stood beside a barn of 782 bound wheat and hunger deaths. Pressing the food
// cell splits the number: the stores' total, the milling (a mill to grind the stored wheat), the carrying (the engine's
// bound wheat and what is on the carts), the households' access (houses without bread, those no granary road reaches)
// and the households going hungry (FIX-16 `foodShortage`), with the most urgent of them to go to.

export type FoodRowKey = keyof typeof COPY.terms;
export type FoodTarget = Readonly<{ buildingId: string; tile: TileCoordinate }>;
export type FoodRow = Readonly<{ key: FoodRowKey; term: string; value: string; urgent: boolean; target: FoodTarget | null }>;
export type FoodBreakdown = Readonly<{ rows: readonly FoodRow[]; urgent: FoodRow | null; starving: number }>;

const STORE_KINDS: ReadonlySet<string> = new Set(["storehouse", "granary"]);
/** The most urgent first: hunger, then food that cannot move, then food that cannot be ground, then access. */
const URGENCY: readonly FoodRowKey[] = ["starving", "carrying", "milling", "access"];

function targetOf(state: GameState, buildingId: string | undefined): FoodTarget | null {
  const building = buildingId === undefined ? undefined : state.buildings.find(candidate => candidate.id === buildingId);
  return building === undefined ? null : { buildingId: building.id, tile: { tx: building.tx, ty: building.ty } };
}

export function foodBreakdown(state: GameState): FoodBreakdown {
  const stored = (resource: "bread" | "wheat") => state.buildings.reduce((sum, building) =>
    sum + (STORE_KINDS.has(building.kind) ? Math.max(0, building.inventory[resource] ?? 0) : 0), 0);
  const wheat = stored("wheat");
  const shortage = foodShortage(state);
  const mills = state.buildings.filter(building => building.kind === "mill");
  const grinding = mills.filter(mill => !operationSuspended(mill));
  const milling: FoodRow = mills.length === 0
    ? { key: "milling", term: COPY.terms.milling, value: COPY.noMill(wheat), urgent: wheat > 0, target: null }
    : grinding.length === 0
      ? { key: "milling", term: COPY.terms.milling, value: COPY.millStopped(wheat), urgent: wheat > 0, target: targetOf(state, mills[0]?.id) }
      : { key: "milling", term: COPY.terms.milling, value: COPY.milling(grinding.length), urgent: false, target: targetOf(state, grinding[0]?.id) };
  const carts = (resource: "bread" | "wheat") => state.walkers.reduce((sum, walker) => sum + (walker.cargo?.resource === resource ? walker.cargo.amount : 0), 0);
  const barn = stuckRows(state).find(row => row.good === "wheat");
  const carrying: FoodRow = shortage.boundWheat > 0
    ? { key: "carrying", term: COPY.terms.carrying, value: COPY.bound(shortage.boundWheat, shortage.releaseDays), urgent: true, target: targetOf(state, barn?.buildingId) }
    : { key: "carrying", term: COPY.terms.carrying, value: carts("bread") + carts("wheat") > 0 ? COPY.onCarts(carts("bread"), carts("wheat")) : COPY.nothingCarried, urgent: false, target: null };
  const lived = state.houses.filter(house => house.residents > 0 && house.abandonedTick === undefined);
  const empty = lived.filter(house => house.breadStock <= 0);
  const granaries = state.buildings.some(building => building.kind === "granary");
  const cut = granaries ? empty.filter(house => houseDiagnosisModel(state, house.buildingId)?.bread.kind === "road_disconnected") : [];
  const access: FoodRow = { key: "access", term: COPY.terms.access, value: granaries ? COPY.access(empty.length, cut.length) : COPY.noGranary(empty.length),
    urgent: cut.length > 0 || (!granaries && empty.length > 0), target: targetOf(state, (cut[0] ?? empty[0])?.buildingId) };
  const hungry = [...foodShortHouseIds(state)].sort();
  const starving: FoodRow = { key: "starving", term: COPY.terms.starving, value: COPY.starving(shortage.starvingHouseholds), urgent: shortage.starvingHouseholds > 0,
    target: targetOf(state, hungry[0]) };
  const total: FoodRow = { key: "total", term: COPY.terms.total, value: COPY.total(stored("bread"), wheat, foodDays(state)), urgent: false, target: null };
  const rows = [total, milling, carrying, access, starving];
  const urgent = rows.filter(row => row.urgent && row.target !== null).sort((a, b) => URGENCY.indexOf(a.key) - URGENCY.indexOf(b.key))[0] ?? null;
  return { rows, urgent, starving: shortage.starvingHouseholds };
}
