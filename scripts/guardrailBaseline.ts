// A guardrail run's five seeds as a baseline file (`seeds/baseline-<commit>.json`, the fields of baseline-bdcfe2c):
// from the guardrail's output folder (the remote run's `guardrail/`), its summaries and the labour gate summary.
//   tsx scripts/guardrailBaseline.ts <guardrail folder> <source commit> <previous baseline> "<description>" > seeds/baseline-<commit>.json
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { labourGateSummary } from "./labourGateSummary";

const [folder, sourceCommit, previousBaseline, description] = process.argv.slice(2);
if (folder === undefined || sourceCommit === undefined || previousBaseline === undefined || description === undefined) {
  throw new Error("usage: guardrailBaseline.ts <guardrail folder> <source commit> <previous baseline> <description>");
}
const seeds: Record<string, unknown> = {};
for (const seed of [1, 2, 3, 4, 5]) {
  const directory = resolve(folder, `seed-${seed}`);
  const bytes = readFileSync(resolve(directory, "summary.json"));
  const summary = JSON.parse(bytes.toString("utf8"));
  const labour = labourGateSummary(directory);
  const metrics = summary.efficiency.metrics;
  const counts: Record<string, number> = summary.final.buildingCounts;
  const services = summary.final.services;
  seeds[String(seed)] = {
    summarySha256: createHash("sha256").update(bytes).digest("hex"),
    finalStateSha256: summary.finalStateSha256,
    tick: summary.final.tick,
    victoryTick: summary.victoryTick,
    stableTicks: summary.strict.sustainedTicks,
    lots: summary.final.lots,
    l4Houses: summary.final.l4Houses,
    stopReason: summary.stopReason,
    farmsteadCount: metrics.farmsteads,
    arableCells: metrics.arableCells,
    millCount: metrics.mills,
    granaryCount: metrics.granaries,
    marketCount: metrics.markets,
    churchCount: metrics.churches,
    sawmillCount: counts.sawmill ?? 0,
    loggingCampCount: counts.logging_camp ?? 0,
    warnings: metrics.warnings,
    buildings: metrics.buildings,
    warningRatio: metrics.warnings / metrics.buildings,
    idleWorkerRatio: summary.guardrail.recorded.idleWorkerRatio,
    chronicZeroWheatMillRatio: summary.guardrail.recorded.zeroWheatMillRatio,
    stableBreadRatio: labour.stableBreadRatio,
    stableRawStarvationRatio: labour.stableRawStarvationRatio,
    stableIdleRatioMean: labour.stableIdleRatioMean,
    stableMealFulfilment: labour.stableMealFulfilment,
    stableWindows: labour.stableWindows,
    serviceOutside: { water: services.water.outside, market: services.market.outside, church: services.church.outside },
  };
}
const previous = JSON.parse(readFileSync(resolve("seeds", `${previousBaseline}.json`), "utf8"));
process.stdout.write(`${JSON.stringify({ description, sourceCommit, previousBaseline, arableCellsPerLotCap: previous.arableCellsPerLotCap, seeds }, null, 2)}\n`);
