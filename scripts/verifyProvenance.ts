/**
 * WARNING-mode CLI for docs/provenance/assets.csv.
 *
 * Prints missing/mismatch lists and completeness statistics. Always exits 0,
 * so it is safe to wire into CI as a non-blocking check, UNLESS
 * docs/provenance/assets.csv cannot be parsed at all (missing file, broken
 * CSV), in which case it exits 1.
 *
 * Run with: npx tsx scripts/verifyProvenance.ts
 */
import { ASSETS_CSV_PATH, buildReport, type ProvenanceReport } from "./provenanceLedger";
import { listAllPublicFiles } from "./provenanceLedgerFs";

function printReport(report: ProvenanceReport): void {
  console.log(`AI asset provenance ledger check (${ASSETS_CSV_PATH})`);
  console.log(`  runtime assets enumerated: ${report.totalRuntimeAssets}`);
  console.log(`  CSV rows:                  ${report.totalCsvRows}`);
  console.log("");

  if (report.missingRows.length === 0) {
    console.log("Missing rows: none");
  } else {
    console.log(`Missing rows (${report.missingRows.length}) — runtime assets with no CSV row:`);
    for (const asset of report.missingRows) console.log(`  - ${asset.runtimePath} (found via ${asset.foundVia})`);
  }
  console.log("");

  if (report.orphanRows.length === 0) {
    console.log("Orphan rows: none");
  } else {
    console.log(`Orphan rows (${report.orphanRows.length}) — CSV rows whose runtimePath is not currently a runtime asset:`);
    for (const row of report.orphanRows) console.log(`  - ${row.assetId} ${row.version} -> ${row.runtimePath}`);
  }
  console.log("");

  if (report.hashMismatches.length === 0) {
    console.log("Hash mismatches: none");
  } else {
    console.log(`Hash mismatches (${report.hashMismatches.length}):`);
    for (const m of report.hashMismatches) {
      console.log(`  - ${m.assetId} ${m.version} [${m.field}] csv=${m.csvValue} actual=${m.actualValue}`);
    }
  }
  console.log("");

  if (report.missingFiles.length === 0) {
    console.log("Rows pointing at non-existent files: none");
  } else {
    console.log(`Rows pointing at non-existent files (${report.missingFiles.length}):`);
    for (const f of report.missingFiles) console.log(`  - ${f.assetId} ${f.version} [${f.field}] ${f.path}`);
  }
  console.log("");

  console.log(`Public/ files not referenced by any runtime enumeration rule (${report.unreferencedPublicFiles.length}):`);
  for (const f of report.unreferencedPublicFiles) console.log(`  - ${f}`);
  console.log("");

  console.log("Statistics:");
  console.log(`  total runtime assets (N):     ${report.stats.totalRuntimeAssets}`);
  console.log(`  complete rows (K):            ${report.stats.completeRows}`);
  console.log(`  rows containing "unknown" (M): ${report.stats.rowsWithUnknown}`);
  console.log(`  missing rows (L):             ${report.stats.missingRows}`);
}

function main(): void {
  let report: ProvenanceReport;
  try {
    report = buildReport(listAllPublicFiles());
  } catch (error) {
    console.error(`Could not parse ${ASSETS_CSV_PATH}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
    return;
  }
  printReport(report);
  process.exit(0);
}

main();
