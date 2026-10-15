// GROW-BLOCK-2a's seed 9 food diagnosis (the user's ruling 2026-10-12): from a lord-mode save, the lord's bot plays on and
// every 1,000 ticks this records why bread misses houses while wheat is ample — to tell the two candidates apart:
//  (1) a house beyond every granary's distribution range halts the whole food decision (`food_route_blocked`), so no
//      mill or granary is added;
//  (2) the mills and the hauling fall short of the town (wheat stocked, too little milled or carried).
// Each sample: the food decision and which of its gates stopped it (understaffed food facilities, facilities with no
// route to a granary, houses beyond the range, stranded supply), the measured food window, the food facilities with
// their staff and stock, the houses without bread with their distance to the nearest granary, the carters and
// distributors (busy or idle, what they carry), and the labour summary.
//   tsx scripts/foodDiagnosisProbe.ts <save .save.json[.gz] | new:<seed>> [years] [sampleTicks] > out.json
// `new:<seed>`: the lord slice from its first tick (the default map's early food, the user's question 2026-10-14). Each
// sample also has the food step's gates before the decision (a chain pending, an observation open, a repeat blocked,
// staffing), the mills' wheat and bread one by one, the stock stuck where no store takes it, and the houses without bread.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BALANCE } from "../src/content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { availableStock } from "../src/economy/storage";
import { foodEfficiencyMetrics } from "../src/engine/autoplayFoodEfficiency";
import { measuredFoodDecision } from "../src/engine/autoplayFoodMeasuredDecision";
import { strandedFoodSupply } from "../src/engine/autoplayFoodRoutes";
import { feasibleDistributorDistance } from "../src/engine/distributorAccess";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { buildingHasRequiredRoadAccess } from "../src/engine/roadAccess";
import { resolveBuildingRoute } from "../src/engine/routing";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { houseHasFood } from "../src/population/houseFood";
import { decodeSave } from "../src/save/saveCodec";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { newGameState } from "../src/state/newGame";
import { hasPendingFoodChain } from "../src/engine/autoplayFood";
import { blocksRepeatedFoodExpansion, hasActiveFoodObservation } from "../src/engine/autoplayFoodThroughput";
import { canStaffFoodExpansion } from "../src/engine/autoplayFoodBottleneck";
import { stuckStock } from "../src/engine/stuckStock";
import { gameReducer } from "../src/state/gameStore";

const FOOD_KINDS = ["farmstead", "mill", "granary"] as const;
const [path, years = "10", sampleTicks = "1000"] = process.argv.slice(2);
if (path === undefined) throw new Error("usage: foodDiagnosisProbe.ts <save .save.json[.gz] | new:<seed>> [years] [sampleTicks]");
const SAMPLE_TICKS = Number(sampleTicks);
let state: GameState = path.startsWith("new:")
  ? newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: Number(path.slice(4)) }) as GameState
  : (() => { const bytes = readFileSync(path); return decodeSave(new Uint8Array(path.endsWith(".gz") ? gunzipSync(bytes) : bytes)).envelope.state as GameState; })();

function nearestGranary(state: GameState, houseId: string): number | null {
  const distances = state.buildings.filter(building => building.kind === "granary")
    .map(granary => feasibleDistributorDistance(state, granary, houseId)).filter((distance): distance is number => distance !== null);
  return distances.length === 0 ? null : Math.min(...distances);
}

function sample(state: GameState) {
  const facilities = state.buildings.filter(building => (FOOD_KINDS as readonly string[]).includes(building.kind));
  const granaries = facilities.filter(building => building.kind === "granary");
  const occupied = state.houses.filter(house => house.residents > 0);
  const range = occupied.map(house => ({ id: house.buildingId, granary: nearestGranary(state, house.buildingId), bread: house.breadStock }));
  const stranded = strandedFoodSupply(state);
  const walkers = state.walkers.filter(walker => walker.kind === "carter" || walker.kind === "distributor");
  const count = (kind: string) => facilities.filter(building => building.kind === kind).length;
  return {
    year: stateCalendar(state).year, tick: state.tick, population: state.population, houses: occupied.length,
    decision: measuredFoodDecision(state),
    gates: {
      understaffed: facilities.filter(building => building.workers < BUILDING_CONFIG_BY_KIND[building.kind].workersRequired)
        .map(building => ({ id: building.id, kind: building.kind, workers: building.workers, required: BUILDING_CONFIG_BY_KIND[building.kind].workersRequired })),
      noRoute: facilities.filter(building => !buildingHasRequiredRoadAccess(state, building)
        || !granaries.some(granary => granary.id === building.id || resolveBuildingRoute(state, building, granary).path !== null))
        .map(building => ({ id: building.id, kind: building.kind })),
      beyondRange: range.filter(house => (house.granary ?? Infinity) > BALANCE.DISTRIBUTOR_RANGE),
      stranded: stranded === null ? null : { sources: stranded.sources.map(b => b.kind), targets: stranded.targets.map(b => b.kind) },
    },
    window: foodEfficiencyMetrics(state),
    facilities: { farmsteads: count("farmstead"), mills: count("mill"), granaries: count("granary"),
      staff: facilities.map(building => ({ kind: building.kind, workers: building.workers, required: BUILDING_CONFIG_BY_KIND[building.kind].workersRequired,
        wheat: availableStock(building, "wheat"), bread: availableStock(building, "bread") })) },
    withoutBread: range.filter(house => !houseHasFood({ breadStock: house.bread })),
    walkers: {
      carters: walkers.filter(walker => walker.kind === "carter").length,
      distributors: walkers.filter(walker => walker.kind === "distributor").length,
      carrying: walkers.reduce<Record<string, number>>((sum, walker) => {
        const key = `${walker.kind}:${walker.cargo?.resource ?? "empty"}`; sum[key] = (sum[key] ?? 0) + 1; return sum; }, {}),
    },
    labour: state.labour ?? null,
    stepGates: { pendingChain: hasPendingFoodChain(state), observation: hasActiveFoodObservation(state),
      millRepeatBlocked: blocksRepeatedFoodExpansion(state, "mill"), millStaff: canStaffFoodExpansion(state, "mill") },
    mills: facilities.filter(building => building.kind === "mill").map(building => ({ id: building.id, workers: building.workers,
      wheat: building.inventory.wheat ?? 0, bread: building.inventory.bread ?? 0 })),
    stuck: stuckStock(state).map(entry => ({ resource: entry.resource, amount: entry.amount, reason: entry.reason, kind: state.buildings.find(b => b.id === entry.buildingId)?.kind ?? null })),
    housesNoBread: state.houses.filter(house => house.residents > 0 && house.breadStock === 0).length,
  };
}

const start = stateCalendar(state).year;
const samples = [sample(state)];
while (stateCalendar(state).year < start + Number(years)) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
  if (state.tick % SAMPLE_TICKS === 0) samples.push(sample(state));
}
process.stdout.write(`${JSON.stringify({ save: path, start, years: Number(years), samples })}\n`);
