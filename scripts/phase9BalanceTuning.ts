import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BALANCE } from "../src/content/balanceConfig";
import { createPhase9EconomyHarnessScenario } from "./economyHarnessPhase9Scenario";
import { trackPhase9Run } from "./economyHarnessPhase9Trace";

export const PHASE9_BALANCE_TARGET_TICK = 30_000;
export const PHASE9_BALANCE_MAX_CHANGES = 3;
export const PHASE9_BALANCE_EVIDENCE_DIR = "/tmp/feudal-phase9/task-15";

export interface Phase9TuningChange {
  readonly iteration: number;
  readonly path: string;
  readonly constant: string;
  readonly before: number;
  readonly after: number;
  readonly reason: string;
}

export function guardPhase9TuningChanges(changes: readonly Phase9TuningChange[]): void {
  if (changes.length > PHASE9_BALANCE_MAX_CHANGES || changes.some((change) => change.iteration > PHASE9_BALANCE_MAX_CHANGES)) {
    throw new Error("Phase 9 balance tuning stops after three changes");
  }
  for (const change of changes) {
    const allowedPath = change.path === "src/engine/era.ts" || change.path === "src/content/buildingConfig.ts";
    const allowedConstant = change.constant.startsWith("STONE_TOWN_") || change.constant.startsWith("PHASE9_");
    if (!allowedPath || !allowedConstant) {
      throw new Error(`pre-Phase-9 tuning is not allowed: ${change.path} ${change.constant}`);
    }
  }
}

export function buildPhase9BalanceLedger(changes: readonly Phase9TuningChange[] = []) {
  guardPhase9TuningChanges(changes);
  const trace = trackPhase9Run(createPhase9EconomyHarnessScenario({ seed: 9 }));
  const proclamationTick = trace.proclamationTick;
  return {
    targetTick: PHASE9_BALANCE_TARGET_TICK,
    targetMinutesAt1x: 25,
    ticksPerSecond: BALANCE.TICKS_PER_SECOND,
    iterations: [{
      iteration: 0,
      changes: [],
      initialTick: trace.initialTick,
      coinPositiveTick: trace.coinReachedTick,
      coin200Tick: trace.coin200ReachedTick,
      spendableStone400Tick: trace.spendableStone400ReachedTick,
      proclamationTick,
      proclamationMinutesAt1x: proclamationTick === null
        ? null
        : Math.round((proclamationTick / BALANCE.TICKS_PER_SECOND / 60) * 100) / 100,
      stoneWallElapsedTicks: trace.stoneWallCompletionElapsedTicks,
      maxStoneChainStallWithAccess: trace.maxStoneChainStallWithAccess,
    }],
    appliedChanges: changes,
    finalMissTicks: proclamationTick === null ? null : proclamationTick - PHASE9_BALANCE_TARGET_TICK,
    decision: "No product balance constant was changed: the measured fixture reaches Stone Town too early, while the unseeded stress run collapses before 30000; preserve shipped thresholds and disclose the miss.",
  } as const;
}

export function writePhase9BalanceEvidence(outputDir: string = PHASE9_BALANCE_EVIDENCE_DIR): void {
  const ledger = buildPhase9BalanceLedger();
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "tuning-ledger.json"), `${JSON.stringify(ledger, null, 2)}\n`);
  writeFileSync(
    join(outputDir, "tuning-ledger.csv"),
    [
      "metric,value",
      `targetTick,${ledger.targetTick}`,
      `proclamationTick,${ledger.iterations[0].proclamationTick ?? "MISS"}`,
      `finalMissTicks,${ledger.finalMissTicks ?? "MISS"}`,
      `coin200Tick,${ledger.iterations[0].coin200Tick ?? "MISS"}`,
      `spendableStone400Tick,${ledger.iterations[0].spendableStone400Tick ?? "MISS"}`,
      `stoneWallElapsedTicks,${ledger.iterations[0].stoneWallElapsedTicks ?? "MISS"}`,
    ].join("\n") + "\n",
  );
}

if (process.argv[1]?.endsWith("phase9BalanceTuning.ts") === true) {
  writePhase9BalanceEvidence();
}
