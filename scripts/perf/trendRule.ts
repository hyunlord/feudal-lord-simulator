// The trend's judgement (user decisions RR6, RR7), shared by the DGX runner (scripts/perf/trendRun.ts) and the page
// (scripts/perf/perfTrend.ts).
//  1. Suspicion: a commit's value (the median of its runs) outside the range its comparison commit showed across its
//     own runs (at least three), widened by that range's width on each side. The comparison commit is the nearest
//     earlier measured trunk commit. Trend runs are taken at different times under different DGX load, so no range
//     rule is steady on its own: on the first data the plain range (as SG4) marked 6 of 16 same-code comparisons,
//     the widened one none.
//  2. Confirmation: a suspicion runs perf:ab (A-B-A-B, the comparison commit against this one, the same scene) on the
//     DGX. Both sides take the same noise, so only the paired difference is left: "나빠짐" only when the difference's
//     95 % band for that many pairs (Student's t, ±3.18 SE at 4 pairs) is above zero (and "좋아짐" only when below).
//     Otherwise the suspicion ends as "같음". The first version used ±2 SE, the many-pairs approximation: at 4 pairs
//     a band of about 80 %, which confirmed 3 of 20 same-code A-B verdicts; with t, none.
// Every judged metric is worse when higher.
import { t95 } from "./pairedStats";

// The judged metrics (RR6): rates per second, not per tick — a busy DGX runs fewer ticks while the per-frame work goes
// on, so per-tick values rise with the load (big town canvases 194–306 per 1k ticks at one commit, 1.56–1.91 per s).
// Keys are hitchAudit summary.metrics keys; perf:ab's AB_METRICS uses the same keys.
export const JUDGED: readonly [string, string][] = [
  ["heapAllocMBps", "JS 할당 MB/s"], ["gcPerMin", "힙 하락(GC)/분"], ["canvasPerSec", "캔버스 생성/초"], ["heapAfterGcMB", "GC 뒤 남은 JS 힙 MB"],
];
/** The fewest runs a comparison commit needs for its range to judge by (as SG4). */
export const MIN_RUNS = 3;

export const median = (values: readonly number[]): number | null => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); const middle = sorted.length / 2;
  return sorted.length === 0 ? null : sorted.length % 2 === 1 ? sorted[Math.floor(middle)]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

export type Suspicion = "위" | "아래" | "";
/** "위": above the widened range of the comparison runs (a suspected worsening), "아래": below it, "": inside. */
export function suspect(value: number | null, comparisonRuns: readonly number[]): Suspicion {
  const runs = comparisonRuns.filter(Number.isFinite);
  if (value === null || runs.length < MIN_RUNS) return "";
  const low = Math.min(...runs); const high = Math.max(...runs); const width = high - low;
  return value > high + width ? "위" : value < low - width ? "아래" : "";
}

type AbRow = { key: string; verdict: string; diff?: number; band?: number; se?: number; n?: number; bandRule?: string };
/**
 * A perf:ab record's verdict for one metric ("나빠짐" | "좋아짐" | "소음 안"), or null when it has no such row. Judged
 * again with the 95 % t band: records written before RR7's correction kept a ±2 SE band (their se is band / 2).
 */
export function abVerdict(record: { table?: readonly AbRow[] } | null | undefined, key: string): string | null {
  const row = record?.table?.find(entry => entry.key === key); if (row === undefined) return null;
  if (row.diff === undefined || row.band === undefined || row.n === undefined) return row.verdict;
  const se = row.se ?? (row.bandRule === "t95" ? row.band / t95(row.n - 1) : row.band / 2); const band = t95(row.n - 1) * se;
  return row.diff - band > 0 ? "나빠짐" : row.diff + band < 0 ? "좋아짐" : "소음 안";
}

/** The file name of a confirmation: comparison commit, commit, scene. */
export const confirmationName = (a: string, b: string, scene: string) => `${a}-${b}-${scene}.json`;
