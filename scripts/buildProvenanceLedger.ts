/**
 * Generator for docs/provenance/assets.csv.
 *
 * `npx tsx scripts/buildProvenanceLedger.ts --write` regenerates the ledger:
 *   - runtimePath / runtimeSha256 / sourcePath / sourceSha256 are always
 *     recomputed from the filesystem and committed evidence files (never
 *     hand-edited; that's the point of the "generated" columns).
 *   - Every other column is preserved verbatim from the existing CSV row
 *     when one exists for the same (assetId, version), so hand-entered
 *     fields (owner, usedIn, manualEdits, notes, ...) survive regeneration.
 *   - New rows (a runtime asset with no existing CSV row) are seeded from
 *     the best evidence scripts/provenanceLedgerEvidence.ts can find, with
 *     "unknown"/"none" defaults everywhere else, per
 *     docs/provenance/ASSET_PROVENANCE.md rule 3 (never invent values).
 *
 * Without --write, prints a diff-style summary of what would change (dry run).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, enumerateRuntimeAssets } from "./provenanceLedgerAssets";
import { resolveEvidence, UNKNOWN, NONE } from "./provenanceLedgerEvidence";
import { ASSETS_CSV_PATH, deriveAssetIdVersion, sha256File } from "./provenanceLedger";
import { CSV_COLUMNS, type CsvRow, parseCsvRows, rowKey, stringifyCsv } from "./provenanceLedgerCsv";

function loadExistingRows(): Map<string, CsvRow> {
  const csvPath = path.join(REPO_ROOT, ASSETS_CSV_PATH);
  if (!existsSync(csvPath)) return new Map();
  const rows = parseCsvRows(readFileSync(csvPath, "utf8"));
  return new Map(rows.map(r => [rowKey(r), r]));
}

function writePromptFile(assetId: string, version: string, prompt: string): string {
  const relDir = "docs/provenance/prompts";
  mkdirSync(path.join(REPO_ROOT, relDir), { recursive: true });
  const relPath = `${relDir}/${assetId}-${version}.txt`;
  writeFileSync(path.join(REPO_ROOT, relPath), `${prompt}\n`, "utf8");
  return relPath;
}

function buildNewRow(runtimePath: string): CsvRow {
  const { assetId, version } = deriveAssetIdVersion(runtimePath);
  const evidence = resolveEvidence(runtimePath);
  const promptColumn = evidence.promptInline !== UNKNOWN ? writePromptFile(assetId, version, evidence.promptInline) : UNKNOWN;
  const row = {} as CsvRow;
  for (const col of CSV_COLUMNS) row[col] = "";
  row.assetId = assetId;
  row.version = version;
  row.runtimePath = runtimePath;
  row.runtimeSha256 = sha256File(runtimePath);
  row.sourcePath = evidence.sourcePath;
  row.sourceSha256 = evidence.sourceSha256;
  row.tool = evidence.tool;
  row.model = evidence.model;
  row.generatedAt = evidence.generatedAt;
  row.prompt = promptColumn;
  row.referenceInputs = evidence.referenceInputs;
  row.seed = evidence.seed;
  row.candidates = evidence.candidates;
  row.manualEdits = evidence.manualEdits;
  row.artBible = evidence.artBible;
  row.historicalProfile = evidence.historicalProfile;
  row.owner = UNKNOWN;
  row.usedIn = UNKNOWN;
  row.status = "runtime";
  row.notes = evidence.notes;
  return row;
}

export function regenerateRows(): { rows: CsvRow[]; created: number; refreshed: number } {
  const existing = loadExistingRows();
  const runtimeAssets = enumerateRuntimeAssets();
  const rows: CsvRow[] = [];
  let created = 0;
  let refreshed = 0;

  for (const asset of runtimeAssets) {
    const { assetId, version } = deriveAssetIdVersion(asset.runtimePath);
    const key = rowKey({ assetId, version });
    const priorRow = existing.get(key);
    if (priorRow) {
      const evidence = resolveEvidence(asset.runtimePath);
      rows.push({
        ...priorRow,
        runtimePath: asset.runtimePath,
        runtimeSha256: sha256File(asset.runtimePath),
        sourcePath: evidence.sourcePath !== UNKNOWN ? evidence.sourcePath : priorRow.sourcePath,
        sourceSha256: evidence.sourcePath !== UNKNOWN ? evidence.sourceSha256 : priorRow.sourceSha256,
      });
      refreshed++;
    } else {
      rows.push(buildNewRow(asset.runtimePath));
      created++;
    }
  }

  rows.sort((a, b) => (a.assetId + a.version).localeCompare(b.assetId + b.version));
  return { rows, created, refreshed };
}

function main(): void {
  const write = process.argv.includes("--write");
  const { rows, created, refreshed } = regenerateRows();
  const csv = stringifyCsv(rows);
  const csvPath = path.join(REPO_ROOT, ASSETS_CSV_PATH);

  if (write) {
    mkdirSync(path.dirname(csvPath), { recursive: true });
    writeFileSync(csvPath, csv, "utf8");
    console.log(`Wrote ${ASSETS_CSV_PATH}: ${rows.length} rows (${created} new, ${refreshed} refreshed).`);
  } else {
    console.log(`Dry run: ${rows.length} rows would be written (${created} new, ${refreshed} refreshed). Pass --write to save ${ASSETS_CSV_PATH}.`);
  }
}

function isMain(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === `file://${path.resolve(entry)}`;
}

if (isMain()) main();

export { NONE };
