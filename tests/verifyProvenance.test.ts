import assert from "node:assert/strict";
import { it } from "node:test";
import { buildReport } from "../scripts/provenanceLedger";
import { listAllPublicFiles } from "../scripts/provenanceLedgerFs";

it("parses docs/provenance/assets.csv and reports zero missing rows", () => {
  const report = buildReport(listAllPublicFiles());
  assert.equal(report.missingRows.length, 0, JSON.stringify(report.missingRows));
});

it("reports zero hash mismatches against the current tree", () => {
  const report = buildReport(listAllPublicFiles());
  assert.equal(report.hashMismatches.length, 0, JSON.stringify(report.hashMismatches));
});

it("reports zero rows pointing at non-existent files", () => {
  const report = buildReport(listAllPublicFiles());
  assert.equal(report.missingFiles.length, 0, JSON.stringify(report.missingFiles));
});

it("enumerates every runtime asset the CSV expects to cover", () => {
  const report = buildReport(listAllPublicFiles());
  assert.equal(report.totalCsvRows, report.totalRuntimeAssets);
});

it("keeps retired rows off the runtime: each lives outside public/ and is no runtime asset any more", () => {
  const report = buildReport(listAllPublicFiles());
  assert.deepEqual(report.retiredStillRuntime.map(row => row.runtimePath), []);
  assert.ok(report.retiredRows.length >= 13, "C1f retired the wheat farm art");
});
