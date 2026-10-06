// RECOVER-1 (B2) diagnosis: why the mills are short of wheat while the barns pile it up. The lord's slice by the
// lord-mode bot to a year, then for a span of ticks: each mill's ticks without enough wheat for a loaf (starved), its
// ticks with its bread hold full (blocked), the trips of its wheat carts (spawned → gone, path length), the carters'
// trade households and the stuck stock they may move.
//   tsx scripts/millSupplyProbe.ts <seed> <fromYear> <ticks> <out.json>
import { writeFileSync } from "node:fs";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { stuckStock } from "../src/engine/stuckStock";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const [seed, fromYear, span, out] = process.argv.slice(2);
let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: Number(seed) }) as GameState;
const step = () => {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
};
while (stateCalendar(state).year < Number(fromYear)) step();
const mill = BUILDING_CONFIG_BY_KIND.mill.production!;
const mills = new Map<string, { starved: number; blocked: number; trips: number[]; paths: number[]; wheatSum: number }>();
const open = new Map<string, { home: string; spawned: number; path: number; mission: string; cart: string }>();
const tripsByKind: Record<string, number[]> = {};
const startBread = state.buildings.reduce((sum, building) => sum + (building.inventory.bread ?? 0), 0);
for (let tick = 0; tick < Number(span); tick += 1) {
  step();
  for (const building of state.buildings.filter(entry => entry.kind === "mill")) {
    const row = mills.get(building.id) ?? { starved: 0, blocked: 0, trips: [], paths: [], wheatSum: 0 };
    const wheat = building.inventory.wheat ?? 0;
    if (wheat < mill.inputPerOutput) row.starved += 1;
    if ((building.inventory.bread ?? 0) >= (mill.outputHoldLimit ?? Infinity)) row.blocked += 1;
    row.wheatSum += wheat;
    mills.set(building.id, row);
  }
  const seen = new Set<string>();
  for (const walker of state.walkers) {
    if (walker.kind !== "carter") continue;
    seen.add(walker.id);
    if (!open.has(walker.id)) {
      const home = state.buildings.find(building => building.id === walker.homeBuildingId);
      open.set(walker.id, { home: walker.homeBuildingId, spawned: walker.spawnedTick, path: walker.path.length, mission: `${home?.kind ?? "?"}:${walker.mission}:${walker.cargo?.resource ?? walker.reservation?.resource ?? "?"}`, cart: walker.cart ?? "main" });
    }
  }
  for (const [id, trip] of open) {
    if (seen.has(id)) continue;
    open.delete(id);
    const row = mills.get(trip.home);
    if (row !== undefined && trip.mission.startsWith("mill:")) { row.trips.push(state.tick - trip.spawned); row.paths.push(trip.path); }
    (tripsByKind[`${trip.mission}:${trip.cart}`] ??= []).push(state.tick - trip.spawned);
  }
}
const mean = (list: readonly number[]) => list.length === 0 ? 0 : Math.round(list.reduce((sum, value) => sum + value, 0) / list.length);
const stuck = stuckStock(state);
const barns = state.buildings.filter(building => building.kind === "farmstead");
writeFileSync(out!, JSON.stringify({
  seed: Number(seed), fromYear: Number(fromYear), span: Number(span), year: stateCalendar(state).year,
  carters: (state.trades?.households ?? []).filter(household => household.tradeId === "carter").length,
  tradeCounts: Object.entries((state.trades?.households ?? []).reduce((map: Record<string, number>, household) => { map[household.tradeId] = (map[household.tradeId] ?? 0) + 1; return map; }, {})),
  haulage: state.trades?.haulage ?? null,
  stuck: stuck.map(entry => ({ kind: state.buildings.find(building => building.id === entry.buildingId)?.kind, resource: entry.resource, amount: entry.amount, reason: entry.reason })),
  barns: barns.map(barn => ({ id: barn.id, wheat: barn.inventory.wheat ?? 0, reserved: barn.stockReserved?.wheat ?? 0, workers: barn.workers })),
  granaries: state.buildings.filter(building => building.kind === "granary" || building.kind === "storehouse").map(building => ({ kind: building.kind, id: building.id,
    capacity: BUILDING_CONFIG_BY_KIND[building.kind].storageCapacity, inventory: building.inventory, reserved: building.reserved, stockReserved: building.stockReserved, haulers: building.haulers ?? 0 })),
  distributors: Object.entries(state.walkers.filter(walker => walker.kind === "distributor").reduce((map: Record<string, number>, walker) => { map[walker.homeBuildingId] = (map[walker.homeBuildingId] ?? 0) + 1; return map; }, {})),
  housesBread: state.houses.filter(house => house.residents > 0).map(house => house.breadStock),
  granaryWheat: state.buildings.filter(building => building.kind === "granary").reduce((sum, building) => sum + (building.inventory.wheat ?? 0), 0),
  breadChange: state.buildings.reduce((sum, building) => sum + (building.inventory.bread ?? 0), 0) - startBread,
  mills: [...mills].map(([id, row]) => ({ id, starvedShare: Math.round(row.starved * 1000 / Number(span)), blockedShare: Math.round(row.blocked * 1000 / Number(span)),
    meanWheat: Math.round(row.wheatSum / Number(span)), trips: row.trips.length, meanTrip: mean(row.trips), meanPath: mean(row.paths) })),
  tripsByKind: Object.fromEntries(Object.entries(tripsByKind).map(([key, list]) => [key, { n: list.length, mean: mean(list) }])),
}, null, 1));
