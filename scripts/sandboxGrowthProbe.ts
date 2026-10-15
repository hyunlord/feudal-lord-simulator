// F1 guardrail seed 4 diagnosis (the user's ruling 2026-10-15): the sandbox bot the guardrail runs (`runPhase19NaturalGrowth`,
// 24 lots), sampled every `sampleTicks` — why no house reaches level 4: the houses by level and what those below lack (water,
// bread, market, church, the wall), the food decision with the food facilities, the arable cells, the wheat and the bread,
// what holds the food observation window, and the labour.
//   tsx scripts/sandboxGrowthProbe.ts <seed> [maxTicks] [sampleTicks] > out.json   (DGX: a tick run)
import type { GameState } from "../src/engine/engine.types";
import { availableStock } from "../src/economy/storage";
import { measuredFoodDecision } from "../src/engine/autoplayFoodMeasuredDecision";
import { foodEfficiencyMetrics } from "../src/engine/autoplayFoodEfficiency";
import { arableBelowCap, arableSupplyShort } from "../src/engine/autoplayArable";
import { hasActiveFoodObservation } from "../src/engine/autoplayFoodThroughput";
import { zonesOf } from "../src/zones/zoneEdits";
import { evaluateEraRequirements } from "../src/engine/era";
import { isBuildingConstructionSite } from "../src/economy/construction";
import { palisadeCoreProposalForState } from "../src/engine/palisadeFootprints";
import { runAutoplaySearch, runAutoplaySearchPhase } from "../src/engine/autoplaySearchBudget";
import { autoplayEraAction, wallInteriorCells } from "../src/engine/autoplayEra";
import { confirmPalisadeProclamation } from "../src/engine/palisade";
import { computeReachablePalisadeProposalForState } from "../src/engine/palisadeRouteAccess";
import { preservesAutoplayServiceSpace } from "../src/engine/autoplayServiceSpace";
import { wallRoom } from "../src/engine/autoplayWallRoom";
import { housingLotCount } from "../src/population/housing";
import { LABOUR_BALANCE } from "../src/content/balanceConfig";
import type { AdvisorDiagnosticReceipt } from "./economyHarnessAutoplay";
import { houseRequirementRows } from "./autoplayStallProbe";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg = "4", maxArg = "120000", sampleArg = "4000"] = process.argv.slice(2);
const SAMPLE = Number(sampleArg);

// Whether the bot could still draw the palisade around the town's core (`palisadeCoreProposalForState`; once it cannot,
// `preservesAutoplayWallSpace` stops keeping the wall's room), the failure's reason and the buildings it names.
function wallStatus(state: GameState) {
  const proposal = palisadeCoreProposalForState(state);
  if (proposal.ok) return { ok: true as const };
  const kinds = (proposal.affectedFootprintIds ?? []).map(id => state.buildings.find(building => building.id === id)?.kind
    ?? state.constructionSites.filter(isBuildingConstructionSite).find(site => site.id === id)?.kind ?? id);
  return { ok: false as const, reason: proposal.reason, affected: kinds };
}
const occupants = (state: GameState) => [...state.buildings.map(building => `${building.id}:${building.kind}@${building.tx},${building.ty}`),
  ...state.constructionSites.filter(isBuildingConstructionSite).map(site => `${site.id}:${site.kind}@${site.tx},${site.ty}`)];
let lastFeasible: { tick: number; occupants: Set<string> } | null = null;
let wallBreak: { tick: number; lastFeasibleTick: number | null; status: ReturnType<typeof wallStatus>; added: string[] } | null = null;

// The bot's decisions in the window up to each sample (from the run's own advisor receipts): the action kinds with their
// result, the steps that raised them, and how the search ended.
let decisions: Record<string, number> = {};
const decisionKey = (receipt: AdvisorDiagnosticReceipt) =>
  `${receipt.advisorAction.kind}${"building" in receipt.advisorAction ? `:${String(receipt.advisorAction.building)}` : ""}/${receipt.result}${receipt.search?.reason === "search_budget_hit" ? "/budget" : ""}`;

// Every condition met in the hamlet, but no wall drawn: what the era step returns alone (with the bot's era-phase work,
// 768) and, outside any budget, each wall its search offers — refused by the rules, by service space, or for lack of
// room for the lots still wanted — as `autoplayEraAction` inspects them (autoplayEra.ts, the sandbox branch).
function eraInspection(state: GameState) {
  const alone = runAutoplaySearch(() => runAutoplaySearchPhase(() => autoplayEraAction(state, () => ({ kind: "none" }), 24), 768));
  const remaining = 24 - housingLotCount(state);
  const seen: { rules: number; service: number; lots: number; ok: number } = { rules: 0, service: 0, lots: 0, ok: 0 };
  const inspected = new Set<string>();
  const proposal = computeReachablePalisadeProposalForState(state, path => {
    const key = JSON.stringify(path);
    if (inspected.has(key)) return false;
    inspected.add(key);
    const projected = confirmPalisadeProclamation(state, path);
    if (projected === state) { seen.rules += 1; return false; }
    if (!preservesAutoplayServiceSpace(state, { kind: "proclaim_era" }, projected)) { seen.service += 1; return false; }
    if (remaining > 0 && !(wallInteriorCells(projected) >= 24 * LABOUR_BALANCE.wallCellsPerLot && wallRoom(state, path, remaining).roomy)) { seen.lots += 1; return false; }
    seen.ok += 1; return true;
  }, 64);
  return { alone: alone.kind, remaining, inspected: inspected.size, seen, proposal: proposal.ok ? "ok" : proposal.reason };
}

function sample(state: GameState) {
  const rows = houseRequirementRows(state);
  const levels: Record<string, number> = {};
  const lacks: Record<string, number> = {};
  for (const house of rows) {
    levels[house.level] = (levels[house.level] ?? 0) + 1;
    if (house.level >= 4) continue;
    for (const key of [!house.water ? "water" : null, !house.bread ? "bread" : null, house.market !== "served" ? `market:${house.market}` : null,
      house.church !== "served" ? `church:${house.church}` : null, house.protection === "outside" ? "outside_wall" : null]) {
      if (key !== null) lacks[key] = (lacks[key] ?? 0) + 1;
    }
  }
  const count = (kind: string) => state.buildings.filter(building => building.kind === kind).length;
  const window = foodEfficiencyMetrics(state);
  const observation = state.autoplayFoodObservation;
  return {
    tick: state.tick, population: state.population, era: state.era, levels, lacks,
    // What the next era waits for, the open building sites with their stall, the stock of the building materials.
    unmet: evaluateEraRequirements(state).filter(requirement => !requirement.met).map(requirement => `${requirement.key}:${requirement.current}/${requirement.target}`),
    sites: state.constructionSites.filter(isBuildingConstructionSite).map(site => `${site.kind}:${site.stall ?? "none"}`),
    stock: Object.fromEntries((["timber", "logs", "stone", "stone_raw"] as const).map(resource => [resource, state.buildings.reduce((sum, building) => sum + availableStock(building, resource), 0)])),
    palisade: state.palisade === null ? null : { segments: state.palisade.segments?.length ?? null },
    wall: wallStatus(state),
    decisions: (() => { const window = decisions; decisions = {}; return window; })(),
    eraStep: state.era === "hamlet" && evaluateEraRequirements(state).every(requirement => requirement.met) ? eraInspection(state) : null,
    food: {
      decision: count("mill") > 0 && count("granary") > 0 && count("farmstead") > 0 ? measuredFoodDecision(state) : null,
      grainShort: arableSupplyShort(state), belowCap: arableBelowCap(state),
      farmsteads: count("farmstead"), wheatFarms: count("wheat_farm"), mills: count("mill"), granaries: count("granary"),
      sites: state.constructionSites.map(site => site.kind).filter(kind => ["farmstead", "mill", "granary", "wheat_farm"].includes(kind)),
      arableCells: zonesOf(state).filter(zone => zone.kind === "arable").reduce((sum, zone) => sum + zone.membership.length, 0),
      wheat: state.buildings.reduce((sum, building) => sum + availableStock(building, "wheat"), 0),
      bread: state.buildings.reduce((sum, building) => sum + availableStock(building, "bread"), 0),
      houseBread: state.houses.reduce((sum, house) => sum + house.breadStock, 0),
      housesNoBread: state.houses.filter(house => house.residents > 0 && house.breadStock === 0).length,
      window: window.fullWindow ? { requested: window.requestedBread, consumed: window.consumedBread, produced: window.breadProduced,
        starved: window.rawStarvedTicks, eligible: window.eligibleMillTicks } : null,
      observation: observation === undefined ? null : { kind: observation.kind, open: hasActiveFoodObservation(state),
        stage: observation.observeUntilTick === undefined ? "site" : "window" },
    },
    labour: state.labour ?? null,
  };
}

const samples: ReturnType<typeof sample>[] = [];
const report = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg), seed: Number(seedArg),
  onDiagnostic: receipt => { const key = decisionKey(receipt); decisions[key] = (decisions[key] ?? 0) + 1; },
  onTick: state => {
    if (state.tick % SAMPLE === 0) samples.push(sample(state));
    if (wallBreak === null && state.era === "hamlet" && state.tick % 250 === 0) {
      const status = wallStatus(state);
      if (status.ok) lastFeasible = { tick: state.tick, occupants: new Set(occupants(state)) };
      else wallBreak = { tick: state.tick, lastFeasibleTick: lastFeasible?.tick ?? null, status,
        added: occupants(state).filter(entry => !(lastFeasible?.occupants.has(entry) ?? false)) };
    }
  } });
process.stdout.write(`${JSON.stringify({ seed: Number(seedArg), maxTicks: Number(maxArg), finalTick: report.final?.tick ?? null, wallBreak, samples })}\n`);
