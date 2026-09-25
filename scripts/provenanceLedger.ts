/**
 * Reusable module + CLI for the AI-generated asset provenance ledger
 * (docs/provenance/ASSET_PROVENANCE.md, work order section 5).
 *
 * Responsibilities:
 *   - enumerate runtime generated assets (delegates to provenanceLedgerAssets.ts)
 *   - parse docs/provenance/assets.csv
 *   - report: rows missing for runtime assets, hash mismatches, rows pointing
 *     at non-existent files, and completeness statistics.
 *
 * CLI usage: `npx tsx scripts/provenanceLedger.ts` prints the report as JSON.
 * See scripts/verifyProvenance.ts for the human-readable, always-exit-0 wrapper.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, enumerateRuntimeAssets, listUnreferencedPublicFiles, type RuntimeAssetRef } from "./provenanceLedgerAssets";
import { CSV_COLUMNS, type CsvRow, parseCsvRows, rowKey } from "./provenanceLedgerCsv";

export { REPO_ROOT, enumerateRuntimeAssets, listUnreferencedPublicFiles };
export { CSV_COLUMNS, parseCsvRows, rowKey };
export type { CsvRow, RuntimeAssetRef };

export const ASSETS_CSV_PATH = "docs/provenance/assets.csv";

const REQUIRED_NON_EMPTY_COLUMNS = [
  "assetId",
  "version",
  "runtimePath",
  "runtimeSha256",
  "sourcePath",
  "sourceSha256",
  "tool",
  "generatedAt",
  "prompt",
  "referenceInputs",
  "manualEdits",
  "artBible",
  "historicalProfile",
  "owner",
  "usedIn",
  "status",
] as const;

/** Splits a runtime asset filename into (assetId, version), matching a trailing `-vN` suffix if present. */
export function deriveAssetIdVersion(runtimePath: string): { assetId: string; version: string } {
  const base = path.basename(runtimePath).replace(/\.[^.]+$/, "");
  const m = /^(.*)-v(\d+)$/.exec(base);
  if (m) {
    const assetId = m[1];
    const versionNumber = m[2];
    if (assetId !== undefined && versionNumber !== undefined) return { assetId, version: `v${versionNumber}` };
  }
  return { assetId: base, version: "v1" };
}

export function sha256File(relativePath: string): string {
  const data = readFileSync(path.join(REPO_ROOT, relativePath));
  return createHash("sha256").update(data).digest("hex");
}

export function readAssetsCsvRows(): CsvRow[] {
  const csvPath = path.join(REPO_ROOT, ASSETS_CSV_PATH);
  if (!existsSync(csvPath)) throw new Error(`${ASSETS_CSV_PATH} does not exist`);
  return parseCsvRows(readFileSync(csvPath, "utf8"));
}

export interface MismatchEntry {
  assetId: string;
  version: string;
  field: "runtimeSha256" | "sourceSha256";
  csvValue: string;
  actualValue: string;
}

export interface MissingFileEntry {
  assetId: string;
  version: string;
  field: "runtimePath" | "sourcePath";
  path: string;
}

export interface ProvenanceReport {
  totalRuntimeAssets: number;
  totalCsvRows: number;
  missingRows: RuntimeAssetRef[]; // runtime assets with no corresponding CSV row
  orphanRows: CsvRow[]; // CSV rows whose runtimePath is not a currently-enumerated runtime asset
  /**
   * Rows with status `retired` (docs/provenance/ASSET_PROVENANCE.md): no longer shipped, the file kept in assets-inbox/.
   * They are not coverage rows: `totalCsvRows` counts the others. Each must point outside public/ at an existing file
   * with its hash, and must not be a runtime asset any more (listed in `retiredStillRuntime` otherwise).
   */
  retiredRows: CsvRow[];
  retiredStillRuntime: CsvRow[];
  hashMismatches: MismatchEntry[];
  missingFiles: MissingFileEntry[];
  unreferencedPublicFiles: string[];
  stats: {
    totalRuntimeAssets: number;
    completeRows: number;
    rowsWithUnknown: number;
    missingRows: number;
  };
}

function isUnknownOrEmpty(value: string): boolean {
  const v = value.trim();
  return v.length === 0 || v.toLowerCase() === "unknown";
}

export function buildReport(allPublicFiles: readonly string[]): ProvenanceReport {
  const runtimeAssets = enumerateRuntimeAssets();
  const allRows = readAssetsCsvRows();
  const retiredRows = allRows.filter(row => row.status === "retired");
  const rows = allRows.filter(row => row.status !== "retired");
  const rowsByRuntimePath = new Map<string, CsvRow>();
  for (const row of rows) rowsByRuntimePath.set(row.runtimePath, row);

  const runtimePaths = new Set(runtimeAssets.map(r => r.runtimePath));
  const missingRows = runtimeAssets.filter(r => !rowsByRuntimePath.has(r.runtimePath));
  const orphanRows = rows.filter(r => !runtimePaths.has(r.runtimePath));

  const hashMismatches: MismatchEntry[] = [];
  const missingFiles: MissingFileEntry[] = [];
  let completeRows = 0;
  let rowsWithUnknown = 0;

  const retiredStillRuntime = retiredRows.filter(row => runtimePaths.has(row.runtimePath) || row.runtimePath.startsWith("public/"));
  for (const row of [...rows, ...retiredRows]) {
    const retired = row.status === "retired";
    if (!retired && !runtimePaths.has(row.runtimePath)) continue; // orphan rows are reported separately

    const runtimeAbs = path.join(REPO_ROOT, row.runtimePath);
    if (!existsSync(runtimeAbs)) {
      missingFiles.push({ assetId: row.assetId, version: row.version, field: "runtimePath", path: row.runtimePath });
    } else if (row.runtimeSha256 && !isUnknownOrEmpty(row.runtimeSha256)) {
      const actual = sha256File(row.runtimePath);
      if (actual !== row.runtimeSha256) {
        hashMismatches.push({ assetId: row.assetId, version: row.version, field: "runtimeSha256", csvValue: row.runtimeSha256, actualValue: actual });
      }
    }

    if (row.sourcePath && !isUnknownOrEmpty(row.sourcePath)) {
      const sourceAbs = path.join(REPO_ROOT, row.sourcePath);
      if (!existsSync(sourceAbs)) {
        missingFiles.push({ assetId: row.assetId, version: row.version, field: "sourcePath", path: row.sourcePath });
      } else if (row.sourceSha256 && !isUnknownOrEmpty(row.sourceSha256)) {
        const actual = sha256File(row.sourcePath);
        if (actual !== row.sourceSha256) {
          hashMismatches.push({ assetId: row.assetId, version: row.version, field: "sourceSha256", csvValue: row.sourceSha256, actualValue: actual });
        }
      }
    }

    if (retired) continue;
    const hasUnknown = REQUIRED_NON_EMPTY_COLUMNS.some(col => isUnknownOrEmpty(row[col]));
    if (hasUnknown) rowsWithUnknown++;
    else completeRows++;
  }

  return {
    totalRuntimeAssets: runtimeAssets.length,
    totalCsvRows: rows.length,
    missingRows,
    orphanRows,
    retiredRows,
    retiredStillRuntime,
    hashMismatches,
    missingFiles,
    unreferencedPublicFiles: listUnreferencedPublicFiles(allPublicFiles),
    stats: {
      totalRuntimeAssets: runtimeAssets.length,
      completeRows,
      rowsWithUnknown,
      missingRows: missingRows.length,
    },
  };
}

function isMain(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === `file://${path.resolve(entry)}`;
}

if (isMain()) {
  const { listAllPublicFiles } = await import("./provenanceLedgerFs");
  const report = buildReport(listAllPublicFiles());
  console.log(JSON.stringify(report, null, 2));
}
