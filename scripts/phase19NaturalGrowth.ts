import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SETTLEMENT_CONFIG } from "../src/content/settlementConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";
import { fullServicePopulation, growthGuards, growthSnapshot, invalidGrowthResources, parseGrowthOptions, prosperityEligible } from "./phase19GrowthMetrics";
import { createGrowthObservations, timingSummary } from "./phase19GrowthObservations";

function provenance() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root }).toString();
  const files = git("ls-files", "-z", "src", "scripts").split("\0").filter(Boolean).sort();
  const hash = createHash("sha256");
  for (const file of files) hash.update(file).update("\0").update(readFileSync(resolve(root, file)));
  return { commit: git("rev-parse", "HEAD").trim(), sourceSha256: hash.digest("hex"), sourceFiles: files.length,
    dirty: git("status", "--porcelain", "--", "src", "scripts").trim() !== "" };
}

export function runPhase19NaturalGrowth(options: {
  readonly targetLots: number;
  readonly maxTicks: number;
  readonly onState?: (label: string, state: GameState) => void;
  readonly onProgress?: (snapshot: ReturnType<typeof growthSnapshot>) => void;
}) {
  const { targetLots, maxTicks } = parseGrowthOptions([String(options.targetLots), String(options.maxTicks)]);
  const source = provenance();
  const started = performance.now();
  const driver = createAutoplayTraceDriver({ id: `natural-growth-${targetLots}`, source: "seed1-default-state-cap-only", policy: { maxHousingLots: targetLots } });
  const observations = createGrowthObservations();
  let state = structuredClone(DEFAULT_GAME_STATE);
  const initial = growthSnapshot(state);
  const progress: ReturnType<typeof growthSnapshot>[] = [initial];
  const milestones: { readonly label: string; readonly snapshot: ReturnType<typeof growthSnapshot>; readonly guards: readonly string[] }[] = [];
  const guardHistogram: Record<string, number> = {};
  const tickRing: number[] = [];
  const advisorRing: number[] = [];
  const failures: string[] = [];
  let guardSamples = 0;
  let victoryTick: number | null = null;
  let eligibleStreak = 0;
  let victoryEligibleTicks = 0;
  let targetReachedTick: number | null = null;
  let structuralCeilingTick: number | null = null;
  let stableSince: number | null = null;
  let stableBreadZeroTicks = 0;
  let stableMinimumBread = Infinity;
  let stabilityInterruptions = 0;
  let maximumLots = initial.lots;
  const record = (label: string) => {
    milestones.push({ label, snapshot: growthSnapshot(state), guards: growthGuards(state, targetLots) });
    options.onState?.(label, state);
  };
  record("initial");
  observations.observe(state);
  for (let step = 0; step < maxTicks; step += 1) {
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
    if (structuralCeilingTick === null && current.lots < targetLots && state.era === "stone_town" &&
      !state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === "house")) {
      structuralCeilingTick = state.tick; record("structural-growth-ceiling");
    }
    eligibleStreak = prosperityEligible(state) ? eligibleStreak + 1 : 0;
    if (victoryTick === null && state.settlement?.outcome === "victory") {
      victoryTick = state.tick; victoryEligibleTicks = eligibleStreak; record("victory");
      if (eligibleStreak < SETTLEMENT_CONFIG.prosperityHoldTicks) failures.push("Premature victory");
    }
    if (victoryTick !== null && fullServicePopulation(state)) {
      stableSince ??= state.tick;
      stableMinimumBread = Math.min(stableMinimumBread, current.minimumHouseBread);
      if (current.occupiedBreadZeroHouses > 0) stableBreadZeroTicks += 1;
      if (state.tick - stableSince >= 24_000) { record("actual-scale-stable"); break; }
    } else {
      if (stableSince !== null) stabilityInterruptions += 1;
      stableSince = null; stableBreadZeroTicks = 0; stableMinimumBread = Infinity;
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
      constructionCommandTick: recommendation?.tick ?? null, completedTick: completion?.tick ?? null,
      firstServingTick: serving?.tick ?? null, providerId: completion?.id ?? null,
      interpretation: "temporal response candidate, not proof that this episode uniquely caused the recommendation" };
  });
  const final = growthSnapshot(state);
  const sustainedTicks = stableSince === null ? 0 : state.tick - stableSince;
  const capacityEpisodeObserved = observation.episodes.length > 0;
  const acceptanceMet = failures.length === 0 && targetReachedTick !== null && capacityEpisodeObserved && sustainedTicks >= 24_000;
  return {
    status: acceptanceMet ? "passed" : "acceptance-unmet", source, seed: DEFAULT_GAME_STATE.seed,
    policy: { maxHousingLots: targetLots }, maxTicks, targetReachedTick, maximumLots,
    structuralCeilingTick, stopReason: failures.length > 0 ? "invalid-run" : sustainedTicks >= 24_000 ? "actual-scale-stable" : "tick-budget",
    growthBlocker: structuralCeilingTick === null ? null : "stone_town advisor has no housing or water expansion branch; cap-only configuration cannot resume housing",
    sourceContract: "DEFAULT_GAME_STATE clone; unchanged economics, save schema and post-era advisor routing; real reducer and advanceTick",
    capacityEpisodeObserved, victoryTick, victoryEligibleTicks, stableSince, sustainedTicks,
    stableBreadZeroTicks, stableMinimumBread: Number.isFinite(stableMinimumBread) ? stableMinimumBread : null,
    stabilityInterruptions, initial, final, milestones, progress,
    guardHistogram, guardSamples, guardSampling: "all simultaneously true housing guards sampled before advisor at 120-tick cadence; not a mutually exclusive attribution",
    ...observation, providerResponses, actions: driver.appliedActions,
    timing: { classification: "diagnostic-only; concurrent host load possible; not a performance gate", ringCapacity: 240,
      finalTickWindow: timingSummary(tickRing), finalAdvisorWindow: timingSummary(advisorRing) },
    failures, elapsedSeconds: (performance.now() - started) / 1000,
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseGrowthOptions(process.argv.slice(2));
  const out = process.argv[4];
  if (out !== undefined) mkdirSync(out, { recursive: true });
  const report = runPhase19NaturalGrowth({ ...options,
    onState: (label, state) => { if (out !== undefined) writeFileSync(resolve(out, `${label}-state.json`), JSON.stringify(state)); },
    onProgress: snapshot => process.stderr.write(`${JSON.stringify(snapshot)}\n`),
  });
  const json = JSON.stringify(report, null, 2);
  if (out !== undefined) writeFileSync(resolve(out, "summary.json"), json);
  process.stdout.write(`${json}\n`);
  if (report.failures.length > 0) process.exitCode = 1;
}
