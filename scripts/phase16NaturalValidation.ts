import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SETTLEMENT_CONFIG } from "../src/content/settlementConfig";
import { HOUSING_CONFIG } from "../src/content/housingConfig";
import { houseLotArea } from "../src/geometry/buildingFootprint";
import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import { settlementMetrics } from "../src/engine/settlementMetrics";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";

type Milestone = "first-four-l4" | "victory" | "stable-complete";
function snapshot(state: GameState) {
  const services = [...householdServices(state).houses.values()];
  return {
    tick: state.tick, era: state.era, population: state.population,
    houses: state.houses.length, l4Houses: state.houses.filter(house => house.level === 4).length,
    occupiedL4Lots: settlementMetrics(state).occupiedL4Lots,
    constructionSites: state.constructionSites.length,
    minimumHouseBread: state.houses.length === 0 ? null : Math.min(...state.houses.map(house => house.breadStock)),
    coverage: {
      water: services.filter(service => service.water.kind === "served").length,
      market: services.filter(service => service.market.kind === "served").length,
      church: services.filter(service => service.church.kind === "served").length,
    },
  };
}
function eligibleForProsperity(state: GameState): boolean {
  const metrics = settlementMetrics(state);
  return metrics.occupiedHouses > 0 && metrics.suppliedPercent >= SETTLEMENT_CONFIG.servicePercent &&
    metrics.population >= SETTLEMENT_CONFIG.prosperityPopulation && state.era === "stone_town" &&
    metrics.completedStoneWall && metrics.occupiedL4Lots >= SETTLEMENT_CONFIG.prosperityOccupiedL4Lots;
}
function invalidResource(state: GameState): boolean {
  return state.buildings.some(building => [building.inventory, building.reserved, building.stockReserved]
    .some(ledger => Object.values(ledger).some(amount => !Number.isFinite(amount) || amount < 0))) ||
    state.houses.some(house => !Number.isFinite(house.breadStock) || house.breadStock < 0);
}
function sourceProvenance() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const files = execFileSync("git", ["ls-files", "-z", "src", "scripts"], { cwd: root }).toString().split("\0").filter(Boolean).sort();
  const hash = createHash("sha256");
  for (const file of files) hash.update(file).update("\0").update(readFileSync(resolve(root, file)));
  return {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim(),
    sourceSha256: hash.digest("hex"), sourceFiles: files.length,
    dirty: execFileSync("git", ["status", "--porcelain", "--", "src", "scripts"], { cwd: root }).toString().trim() !== "",
  };
}

/** Normal reducer/advisor/engine execution only. Hooks may observe but must not mutate state. */
export function runPhase16NaturalValidation(options: {
  readonly maxTicks?: number;
  readonly onMilestone?: (kind: Milestone, state: GameState) => void;
  readonly onProgress?: (progress: ReturnType<typeof snapshot>) => void;
} = {}) {
  const started = performance.now();
  const maxTicks = options.maxTicks ?? 600_000;
  if (!Number.isInteger(maxTicks) || maxTicks < 1) throw new RangeError("maxTicks must be a positive integer");
  const provenance = sourceProvenance();
  const driver = createAutoplayTraceDriver();
  let state = structuredClone(DEFAULT_GAME_STATE);
  let firstFourL4Tick: number | null = null;
  let victoryTick: number | null = null;
  let eligibleStreak = 0;
  let victoryEligibleTicks = 0;
  let stableSince: number | null = null;
  let stableMinimumBread = Infinity;
  let stableEmptyFoodTicks = 0;
  let stabilityInterruptions = 0;
  const milestones: { readonly kind: Milestone; readonly state: ReturnType<typeof snapshot> }[] = [];
  const failures: string[] = [];
  const record = (kind: Milestone) => {
    milestones.push({ kind, state: snapshot(state) });
    options.onMilestone?.(kind, state);
  };
  for (let step = 0; step < maxTicks; step += 1) {
    const priorActions = driver.appliedActions.length;
    const next = driver.apply(state);
    if (driver.appliedActions.length > priorActions && next === state) {
      failures.push(`Advisor action rejected at tick ${state.tick}`);
      break;
    }
    const priorTick = state.tick;
    state = advanceTick(next);
    if (invalidResource(state)) { failures.push(`Invalid resource ledger at tick ${state.tick}`); break; }
    if (state.tick !== priorTick + 1 || state.settlement?.outcome === "abandoned") {
      failures.push(`Simulation stopped or abandoned at tick ${state.tick}`); break;
    }
    const current = snapshot(state);
    eligibleStreak = eligibleForProsperity(state) ? eligibleStreak + 1 : 0;
    if (firstFourL4Tick === null && current.occupiedL4Lots >= SETTLEMENT_CONFIG.prosperityOccupiedL4Lots) {
      firstFourL4Tick = state.tick;
      record("first-four-l4");
    }
    if (victoryTick === null && state.settlement?.outcome === "victory") {
      victoryTick = state.tick;
      victoryEligibleTicks = eligibleStreak;
      if (eligibleStreak < SETTLEMENT_CONFIG.prosperityHoldTicks) {
        failures.push(`Premature victory after only ${eligibleStreak} eligible ticks`); break;
      }
      record("victory");
    }
    const buildings = new Map(state.buildings.map(building => [building.id, building]));
    const full = victoryTick !== null && state.houses.length > 0 && state.constructionSites.length === 0 &&
      Object.values(current.coverage).every(count => count === state.houses.length) &&
      state.houses.every(house => house.level === 4 && house.residents === HOUSING_CONFIG[4].capacity * houseLotArea(buildings.get(house.buildingId)));
    if (!full) {
      if (stableSince !== null) stabilityInterruptions += 1;
      stableSince = null; stableMinimumBread = Infinity; stableEmptyFoodTicks = 0;
    } else {
      stableSince ??= state.tick;
      stableMinimumBread = Math.min(stableMinimumBread, current.minimumHouseBread ?? 0);
      if (current.minimumHouseBread === 0) stableEmptyFoodTicks += 1;
      if (state.tick - stableSince >= 24_000) { record("stable-complete"); break; }
    }
    if (state.tick % 12_000 === 0) options.onProgress?.(current);
  }
  const sustainedTicks = stableSince === null ? 0 : state.tick - stableSince;
  if (victoryTick === null) failures.push("No victory within the tick budget");
  if (sustainedTicks < 24_000) failures.push("No uninterrupted 24000-tick full-population L4/service window after victory");
  return {
    status: failures.length === 0 ? "passed" : "failed",
    provenance, seed: DEFAULT_GAME_STATE.seed, initialTick: DEFAULT_GAME_STATE.tick,
    source: "Unmodified DEFAULT_GAME_STATE; real advisor cadence, gameReducer and advanceTick; no resource, building or population injection",
    maxTicks, firstFourL4Tick, victoryTick, victoryEligibleTicks, stableSince, sustainedTicks,
    stableMinimumBread: Number.isFinite(stableMinimumBread) ? stableMinimumBread : null,
    stableEmptyFoodTicks, stabilityInterruptions, actions: driver.provenance().actionCount,
    milestones, final: snapshot(state), failures, elapsedSeconds: (performance.now() - started) / 1000,
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = runPhase16NaturalValidation({
    maxTicks: Number(process.argv[2] ?? 600_000),
    onProgress: progress => process.stderr.write(`${JSON.stringify(progress)}\n`),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "passed") process.exitCode = 1;
}
