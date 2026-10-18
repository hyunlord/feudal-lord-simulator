/**
 * CONVERTER-FEED (the user's ruling 2026-10-18): STONE-FEED's diagnosis widened to every converter (a building with a
 * production input) — diagnosis only, nothing changed. The lord slice played by the lord bot (as `growBlockProbe.ts`);
 * every 250 ticks from `fromYear` each staffed converter short of the input for its next output is put in one class:
 *  - a cart of its is out: the main cart delivering (to a building, to a construction site) or fetching, or only intake
 *    carts out (the `INPUT_PULL` converters' second carts);
 *  - no cart out, and the fetch the delivery step would make (`fetchCandidate`) — none because the converter has no room,
 *    because no building holds the input (`no_input`), all of it reserved, no route to it; or one there (not left yet).
 * Beside it: whether a store (not a producer) held the input, and, for the season ends, the share of lived-in houses with
 * no bread (STATUS: seed 1's 1304, 34–44 %).
 * Usage: npx tsx scripts/converterFeedProbe.ts <seed> <years> [fromYear] > out.json
 */
import { fetchCandidate } from "../src/agents/deliveryBuildingCandidates";
import type { CarterWalker } from "../src/agents/walker.types";
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { INPUT_PULL } from "../src/content/recoveryConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { buildingHasRequiredRoadAccess } from "../src/engine/roadAccess";
import { stateCalendar } from "../src/engine/scenarioState";
import { createDeliveryInventoryPort, createSimulationRoutePorts } from "../src/engine/simulationPorts";
import { advanceTick } from "../src/engine/tick";
import { houseHasFood } from "../src/population/houseFood";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const seed = Number(process.argv[2] ?? 1);
const years = Number(process.argv[3] ?? 7);
const SAMPLE = 250;
const inventory = createDeliveryInventoryPort();
const PULLED = new Set<BuildingKind>(INPUT_PULL.chains.map(chain => chain.converter));
const CONVERTERS = (Object.keys(BUILDING_CONFIG_BY_KIND) as BuildingKind[]).filter(kind => BUILDING_CONFIG_BY_KIND[kind].production?.input);

const add = (counts: Record<string, number>, key: string) => { counts[key] = (counts[key] ?? 0) + 1; };
const amount = (building: Building, resource: string) => (building.inventory as Record<string, number | undefined>)[resource] ?? 0;
const kindOf = (state: GameState, id: string) => state.buildings.find(b => b.id === id)?.kind ?? "?";

function classify(state: GameState, home: Building, input: string, routes: ReturnType<typeof createSimulationRoutePorts>["delivery"]): string {
  const carts = state.walkers.filter((walker): walker is CarterWalker => walker.kind === "carter" && walker.homeBuildingId === home.id && walker.cancellation === null);
  const main = carts.find(cart => cart.cart === undefined);
  if (main !== undefined) {
    if (main.mission === "fetch") return "cart_out:fetch";
    return main.destination.kind === "construction_site" ? "cart_out:deliver->site" : `cart_out:deliver->${kindOf(state, main.destination.buildingId)}`;
  }
  if (carts.some(cart => cart.cart === "intake")) return "cart_out:intake_only";
  if (!buildingHasRequiredRoadAccess(state, home)) return "no_road_access";
  if (inventory.availableSpace(home) === 0) return "home_full";
  const holders = state.buildings.filter(b => b.id !== home.id && amount(b, input) > 0);
  if (holders.length === 0) return "no_input";
  if (!holders.some(b => inventory.availableStock(b, input as never) > 0)) return "reserved";
  if (!holders.some(b => (routes.betweenBuildings(home.id, b.id)?.length ?? 0) > 0)) return "no_route";
  return fetchCandidate(home, input as never, state.buildings, inventory, routes) === null ? "fetch_none" : "not_left";
}

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const fromYear = Number(process.argv[4] ?? start);
const perKind: Record<string, { pulled: boolean; built: number; samples: number; idle: number; idleWhileStored: number; why: Record<string, number> }> = {};
const bread: { year: number; season: number; lived: number; noBread: number; mills: number }[] = [];
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
  const year = stateCalendar(state).year;
  if (year < fromYear) continue;
  if (state.tick % 1_000 === 0) {
    const lived = state.houses.filter(house => house.residents > 0);
    bread.push({ year, season: (state.tick / 1_000) % 4, lived: lived.length, noBread: lived.filter(house => !houseHasFood(house)).length,
      mills: state.buildings.filter(b => b.kind === "mill").length });
  }
  if (state.tick % SAMPLE !== 0) continue;
  const routes = createSimulationRoutePorts(state).delivery;
  for (const kind of CONVERTERS) {
    const production = BUILDING_CONFIG_BY_KIND[kind].production!;
    const input = production.input!;
    const homes = state.buildings.filter(b => b.kind === kind);
    const entry = perKind[kind] ??= { pulled: PULLED.has(kind), built: 0, samples: 0, idle: 0, idleWhileStored: 0, why: {} };
    entry.built = Math.max(entry.built, homes.length);
    const stored = state.buildings.some(b => b.kind !== kind && BUILDING_CONFIG_BY_KIND[b.kind].production?.output !== input && amount(b, input) >= production.inputPerOutput);
    for (const home of homes) {
      if (home.workers < BUILDING_CONFIG_BY_KIND[kind].workersRequired) continue;
      entry.samples += 1;
      if (amount(home, input) >= production.inputPerOutput) continue;
      entry.idle += 1;
      if (stored) entry.idleWhileStored += 1;
      add(entry.why, `${stored ? "stored" : "not_stored"}|${classify(state, home, input, routes)}`);
    }
  }
}
for (const entry of Object.values(perKind)) entry.why = Object.fromEntries(Object.entries(entry.why).sort((a, b) => b[1] - a[1]));
console.log(JSON.stringify({ seed, years, fromYear, sampleTicks: SAMPLE, era: state.era, converters: perKind, bread }, null, 1));
