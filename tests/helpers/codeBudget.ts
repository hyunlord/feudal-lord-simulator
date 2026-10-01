import { appendFileSync } from "node:fs";

/**
 * A code path's time against its budget (CHRON-1 opening, H8 query, INSTALL-26 frame cache). These were wall-clock
 * assertions in the regression tests and failed on a loaded DGX (docs/verification/wall-clock-tests.md), so a test now checks only
 * what the code returns and hands its time here. The DGX trend (scripts/perf/trendRun.ts) runs those tests with
 * FLS_CODE_BUDGETS=<file> per commit and shows the times beside each budget (docs/verification/perf-trend).
 */
export function recordCodeBudget(id: string, label: string, ms: number, budgetMs: number): void {
  const file = process.env.FLS_CODE_BUDGETS;
  if (file === undefined || file === "") return;
  appendFileSync(file, `${JSON.stringify({ id, label, ms, budgetMs })}\n`);
}
