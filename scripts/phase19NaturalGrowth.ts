import type { AdvisorDiagnosticReceipt } from './economyHarnessAutoplay';
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SETTLEMENT_CONFIG } from "../src/content/settlementConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { createGrowthStability } from "./phase19GrowthRunControl";
import { createGrowthOpening } from "./phase21OpeningTranslation";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";
import { fullServicePopulation, growthGuards, growthSnapshot, invalidGrowthResources, parseGrowthOptions, prosperityEligible } from "./phase19GrowthMetrics";
import { createGrowthObservations, timingSummary } from "./phase19GrowthObservations";
import { canPlaceBuildingBeforeRoad } from "../src/world/placement";

export function terrainResourcePreflight(state: GameState) {
  const quarryWorld = { ...state, era: "palisade" as const, treasuryTimber: 999 };
  const rockTiles = state.tiles.filter(tile => tile.terrain === "rock").length;
  const legalQuarryFootprints = state.tiles.filter(tile => canPlaceBuildingBeforeRoad(quarryWorld, "quarry", tile.tx, tile.ty).ok).length;
  const failures = rockTiles === 0 ? [
    `seed ${state.seed} has no rock terrain; stone-town victory cannot be claimed because quarry is the only raw stone source`,
  ] : [];
  return {
    rockTiles,
    legalQuarryFootprints,
    legalQuarryFootprintsInterpretation: "diagnostic-only current placement count; zero can be caused by occupied or blocked footprints and does not by itself prove stone is impossible",
    quarryEra: "palisade",
    stoneSource: "quarry requires adjacent rock; market does not import stone",
    failures,
  };
}

export function summarizeCapacityRecovery(observation: {
  readonly episodes: readonly unknown[];
  readonly unresolvedCapacityEpisodes: number;
}) {
  const capacityEpisodeObserved = observation.episodes.length > 0;
  return {
    capacityEpisodeObserved,
    capacityRecovered: capacityEpisodeObserved && observation.unresolvedCapacityEpisodes === 0,
  };
}

function provenance() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root }).toString();
  const files = git("ls-files", "--cached", "--others", "--exclude-standard", "-z", "src", "scripts").split("\0").filter(Boolean).sort();
  const hash = createHash("sha256");
  for (const file of files) hash.update(file).update("\0").update(readFileSync(resolve(root, file)));
  return { commit: git("rev-parse", "HEAD").trim(), sourceSha256: hash.digest("hex"), sourceFiles: files.length,
    dirty: git("status", "--porcelain", "--", "src", "scripts").trim() !== "" };
}

export function runPhase19NaturalGrowth(options: {
  readonly targetLots: number;
  readonly maxTicks: number;
  readonly seed?: number;
  readonly additionalAcceptance?: (state: GameState) => boolean;
  readonly onDiagnostic?: (receipt: AdvisorDiagnosticReceipt) => void;
  readonly onState?: (label: string, state: GameState) => void;
  readonly onTick?: (state: GameState, stableSince: number | null) => void;
  readonly onProgress?: (snapshot: ReturnType<typeof growthSnapshot>) => void;
}) {
  const { targetLots, maxTicks, seed } = parseGrowthOptions([String(options.targetLots), String(options.maxTicks), "", String(options.seed ?? 1)]);
  const source = provenance();
  const started = performance.now();
  const opening = createGrowthOpening(seed);
  const driver = createAutoplayTraceDriver({ id: `natural-growth-seed${seed}-${targetLots}`, source: `seed${seed}-translated-verification-fixture-offset-${opening.provenance.offset.tx},${opening.provenance.offset.ty}`, policy: { maxHousingLots: targetLots }, ...(options.onDiagnostic === undefined ? {} : { onDiagnostic: options.onDiagnostic }) });
  const observations = createGrowthObservations();
  let state = opening.state;
  const resourcePreflight = terrainResourcePreflight(state);
  const stability = createGrowthStability(targetLots);
  const initial = growthSnapshot(state);
  const progress: ReturnType<typeof growthSnapshot>[] = [initial];
  const milestones: { readonly label: string; readonly snapshot: ReturnType<typeof growthSnapshot>; readonly guards: readonly string[] }[] = [];
  const guardHistogram: Record<string, number> = {};
  const tickRing: number[] = [];
  const advisorRing: number[] = [];
  const failures: string[] = [...resourcePreflight.failures];
  let guardSamples = 0;
  let victoryTick: number | null = null;
  let eligibleStreak = 0;
  let victoryEligibleTicks = 0;
  let targetReachedTick: number | null = null;
  let stableBreadZeroTicks = 0;
  let stableMinimumBread = Infinity;
  let maximumLots = initial.lots;
  const record = (label: string) => {
    milestones.push({ label, snapshot: growthSnapshot(state), guards: growthGuards(state, targetLots) });
    options.onState?.(label, state);
  };
  record("initial");
  observations.observe(state);
  for (let step = 0; step < maxTicks && failures.length === 0; step += 1) {
    if (state.tick % 120 === 0) {
      guardSamples += 1;
      const guards = growthGuards(state, targetLots);
      for (const guard of guards.length === 0 ? ["no-housing-guard"] : guards) guardHistogram[guard] = (guardHistogram[guard] ?? 0) + 1;
    }
    const beforeActions = driver.appliedActions.length;
    const beforeAdvisor = performance.now();
    const next = driver.apply(state);
    advisorRing[step % 240] = performance.now() - beforeAdvisor;
    if (driver.appliedActions.length > beforeActions && next === state) { failures.push(`Rejected advisor action at ${state.tick}`); break; }
    const previousTick = state.tick;
    const beforeTick = performance.now();
    state = advanceTick(next);
    tickRing[step % 240] = performance.now() - beforeTick;
    if (state.tick !== previousTick + 1 || state.settlement?.outcome === "abandoned") { failures.push(`Stopped or abandoned at ${state.tick}`); break; }
    if (invalidGrowthResources(state)) { failures.push(`Invalid resources at ${state.tick}`); break; }
    observations.observe(state);
    const current = growthSnapshot(state);
    maximumLots = Math.max(maximumLots, current.lots);
    if (targetReachedTick === null && current.lots >= targetLots) { targetReachedTick = state.tick; record("target-reached"); }
    eligibleStreak = prosperityEligible(state) ? eligibleStreak + 1 : 0;
    if (victoryTick === null && state.settlement?.outcome === "victory") {
      victoryTick = state.tick; victoryEligibleTicks = eligibleStreak; record("victory");
      if (eligibleStreak < SETTLEMENT_CONFIG.prosperityHoldTicks) failures.push("Premature victory");
    }
    stability.observe({ tick: state.tick, lots: current.lots,
      victory: state.settlement?.outcome === "victory", fullService: fullServicePopulation(state) });
    const window = stability.report();
    options.onTick?.(state, window.stableSince);
    if (window.stableSince !== null) {
      stableMinimumBread = Math.min(stableMinimumBread, current.minimumHouseBread);
      if (current.occupiedBreadZeroHouses > 0) stableBreadZeroTicks += 1;
      if (window.complete && (options.additionalAcceptance?.(state) ?? true)) { record("target-scale-stable"); break; }
    } else {
      stableBreadZeroTicks = 0; stableMinimumBread = Infinity;
    }
    if (state.tick % 12_000 === 0) { progress.push(current); options.onProgress?.(current); }
    if (failures.length > 0) break;
  }
  record("final");
  const observation = observations.report();
  const providerResponses = observation.episodes.map(episode => {
    const kind = episode.service === "water" ? "well" : episode.service;
    const recommendation = driver.appliedActions.find(action => action.tick >= episode.startedTick &&
      action.advisorAction.kind === "place_building" && action.advisorAction.building === kind);
    const action = recommendation?.advisorAction;
    const completion = action?.kind === "place_building" ? observation.providerEvents.find(event =>
      event.kind === "completed" && event.service === episode.service && event.tick >= (recommendation?.tick ?? Infinity) &&
      event.tx === action.tx && event.ty === action.ty) : undefined;
    const serving = completion === undefined ? undefined : observation.providerEvents.find(event =>
      event.kind === "first-serving" && event.id === completion.id && event.tick >= completion.tick);
    return { service: episode.service, capacityEpisodeTick: episode.startedTick,
      affectedHouseIds: episode.affectedHouseIds, recoveredTick: episode.recoveredTick,
      recoveredProviderIds: episode.recoveredProviderIds,
      responseServedAffectedHomes: serving !== undefined && episode.recoveredTick !== null &&
        episode.recoveredProviderIds.includes(serving.id),
      constructionCommandTick: recommendation?.tick ?? null, completedTick: completion?.tick ?? null,
      firstServingTick: serving?.tick ?? null, providerId: completion?.id ?? null,
      interpretation: "temporal response candidate, not proof that this episode uniquely caused the recommendation" };
  });
  const final = growthSnapshot(state);
  const { stableSince, sustainedTicks, interruptions: stabilityInterruptions, complete } = stability.report();
  const capacitySummary = summarizeCapacityRecovery(observation);
  const acceptance = { targetReached: targetReachedTick !== null, victory: victoryTick !== null,
    fullServiceStable: complete, validRun: failures.length === 0,
    ...(options.additionalAcceptance === undefined ? {} : { additionalAcceptance: options.additionalAcceptance(state) }) };
  const acceptanceMet = Object.values(acceptance).every(Boolean);
  return {
    status: acceptanceMet ? "passed" : "acceptance-unmet", source, seed, opening: opening.provenance, acceptance,
    policy: { maxHousingLots: targetLots }, maxTicks, targetReachedTick, maximumLots,
    stopReason: failures.length > 0 ? "invalid-run" : complete && (options.additionalAcceptance?.(state) ?? true) ? "target-scale-stable" : "tick-budget",
    growthBlocker: null,
    sourceContract: "Verification-only rigid opening translation on unchanged buildWorldGrid(seed), nearest legal Manhattan/dy/dx offset; not a product seed feature. Seed1 preserves DEFAULT_GAME_STATE; actual reducer and advanceTick; economics and save schema unchanged",
    resourcePreflight,
    ...capacitySummary, victoryTick, victoryEligibleTicks, stableSince, sustainedTicks,
    stableBreadZeroTicks, stableMinimumBread: Number.isFinite(stableMinimumBread) ? stableMinimumBread : null,
    stabilityInterruptions, initial, final, milestones, progress,
    guardHistogram, guardSamples, guardSampling: "all simultaneously true housing guards sampled before advisor at 120-tick cadence; not a mutually exclusive attribution",
    ...observation, providerResponses, actions: driver.appliedActions,
    timing: { classification: "diagnostic-only; concurrent host load possible; not a performance gate", ringCapacity: 240,
      finalTickWindow: timingSummary(tickRing), finalAdvisorWindow: timingSummary(advisorRing) },
    failures, elapsedSeconds: (performance.now() - started) / 1000,
  };
}

// CLI: phase19NaturalGrowth.ts [targetLots=16] [maxTicks=600000] [outputDirectory] [seed=1]
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseGrowthOptions(process.argv.slice(2));
  const out = process.argv[4];
  if (out !== undefined && existsSync(out) && readdirSync(out).length > 0) {
    throw new Error("Use an empty output directory; existing growth evidence must not be overwritten");
  }
  if (out !== undefined) mkdirSync(out, { recursive: true });
  const report = runPhase19NaturalGrowth({ ...options,
    onState: (label, state) => { if (out !== undefined) writeFileSync(resolve(out, `${label}-state.json`), JSON.stringify(state)); },
    onProgress: snapshot => process.stderr.write(`${JSON.stringify(snapshot)}\n`),
  });
  const json = JSON.stringify(report, null, 2);
  if (out !== undefined) writeFileSync(resolve(out, "summary.json"), json);
  process.stdout.write(`${json}\n`);
  if (report.status !== "passed") process.exitCode = 1;
}
