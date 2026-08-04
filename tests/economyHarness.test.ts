import assert from "node:assert/strict";
import test from "node:test";

import {
  createEconomyHarnessScenario,
  formatEconomyHarnessReport,
  runEconomyHarness,
} from "../scripts/economyHarness";

test("economy harness fixed scenario is deterministic and passes every metric", () => {
  // Given: the fixed Phase 3 economy scenario and two same-seed runs.
  const scenario = createEconomyHarnessScenario({ seed: 3 });

  // When: the harness runs through the real advanceTick pipeline.
  const report = runEconomyHarness({ scenario, ticks: 4000, warmupTicks: 800 });

  // Then: the same-seed hashes match and every acceptance metric passes.
  assert.equal(report.determinism.hashA, report.determinism.hashB);
  assert.deepEqual(
    report.metrics.map((metric) => metric.status),
    ["PASS", "PASS", "PASS", "PASS", "PASS"],
  );
});

test("economy harness prints the required five-row metric table", () => {
  // Given: a completed deterministic harness report.
  const report = runEconomyHarness({
    scenario: createEconomyHarnessScenario({ seed: 3 }),
    ticks: 4000,
    warmupTicks: 800,
  });

  // When: the report is formatted for CLI output.
  const output = formatEconomyHarnessReport(report);

  // Then: the shape names the exact five Phase 3 harness rows.
  assert.match(output, /^Metric\s+Value\s+Status/m);
  assert.match(output, /^Determinism hash\s+\S+ == \S+\s+PASS/m);
  assert.match(output, /^Food stability\s+.+\s+PASS/m);
  assert.match(output, /^Cargo thrashing\s+.+\s+PASS/m);
  assert.match(output, /^Labour deadlock\s+.+\s+PASS/m);
  assert.match(output, /^Housing oscillation\s+.+\s+PASS/m);
});
