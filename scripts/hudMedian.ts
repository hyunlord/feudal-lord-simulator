// HUD-MEDIAN (user decision 2026-10-02): the HUD area gate is judged by the median of three runs of
// scripts/measureHudCoverage.ts on one build, not by any single run (a running scene's numbers move from run to run).
// Reads <dir>/run1.json … run3.json (scripts/uiaudit1HudThrice.sh writes them), groups the rows by resolution, state
// and view, and per row takes the median percent against the row's budget. Writes <dir>/median.json, prints one line
// per row (run1 run2 run3 → median / budget ok|OVER) and exits 1 when a median is over its budget or a row lacks a run.
//   npx tsx scripts/hudMedian.ts docs/verification/uiaudit1/hud [--runs 3]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export type HudRow = { readonly resolution: string; readonly state: string; readonly view?: string; readonly percent: number; readonly budget: number };
export type MedianRow = { readonly resolution: string; readonly state: string; readonly view?: string; readonly percents: readonly number[];
  readonly median: number | null; readonly budget: number; readonly pass: boolean };

/** The middle value (the mean of the two middle ones for an even count); null for none. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) * 50) / 100;
}

/**
 * Per (resolution, state, view), in the first run's order: each run's percent, the median, the budget and the verdict.
 * A row passes when all `expected` runs measured it and the median is within its budget.
 */
export function medianRows(runs: readonly (readonly HudRow[])[], expected = runs.length): readonly MedianRow[] {
  const key = (row: HudRow) => `${row.resolution}|${row.state}|${row.view ?? ""}`;
  const groups = new Map<string, { first: HudRow; percents: number[] }>();
  for (const rows of runs) for (const row of rows) {
    const group = groups.get(key(row)) ?? { first: row, percents: [] };
    group.percents.push(row.percent);
    groups.set(key(row), group);
  }
  return [...groups.values()].map(({ first, percents }) => {
    const value = median(percents);
    return { resolution: first.resolution, state: first.state, ...(first.view === undefined ? {} : { view: first.view }), percents, median: value,
      budget: first.budget, pass: percents.length >= expected && value !== null && value <= first.budget };
  });
}

export function formatMedianRow(row: MedianRow): string {
  const name = `${row.state}${row.view === undefined ? "" : `:${row.view}`}`;
  const runs = row.percents.map(value => String(value).padStart(5)).join(" ");
  return `${row.resolution.padEnd(16)} ${name.padEnd(30)} ${runs} → ${String(row.median ?? "-").padStart(5)} % / ${row.budget} % ${row.pass ? "ok" : "OVER"}`;
}

function main(): void {
  const [dir] = process.argv.slice(2);
  if (dir === undefined || dir.startsWith("--")) throw new Error("usage: hudMedian.ts <dir with run1.json … runN.json> [--runs 3]");
  const index = process.argv.indexOf("--runs");
  const count = index > 0 ? Number(process.argv[index + 1]) : 3;
  const files = Array.from({ length: count }, (_, at) => join(dir, `run${at + 1}.json`));
  const missing = files.filter(file => !existsSync(file));
  const runs = files.filter(file => existsSync(file)).map(file => (JSON.parse(readFileSync(file, "utf8")) as { rows: HudRow[] }).rows);
  const rows = medianRows(runs, count);
  const pass = missing.length === 0 && rows.every(row => row.pass);
  writeFileSync(join(dir, "median.json"), `${JSON.stringify({ rule: "HUD-MEDIAN", runs: files, missing, pass, rows }, null, 1)}\n`);
  for (const row of rows) console.log(formatMedianRow(row));
  if (missing.length > 0) console.log(`missing: ${missing.join(", ")}`);
  console.log(`HUD-MEDIAN ${pass ? "pass" : "FAIL"} (${rows.filter(row => !row.pass).length} of ${rows.length} rows over budget or short of ${count} runs)`);
  if (!pass) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
