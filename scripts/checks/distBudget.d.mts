// Types of scripts/checks/distBudget.mjs for tsx scripts and tests (the merge checks are plain modules).
export type BudgetConfig = {
  megabyte: number;
  totalBudgetMB: number | null;
  categories: readonly { id: string; name: string; budgetMB: number | null }[];
  rules: readonly { category: string; label: string; patterns: readonly string[] }[];
};
export type DistFile = { path: string; bytes: number };
export type BudgetRow = { label: string; bytes: number; files: number };
export type BudgetCategory = { id: string; name: string; bytes: number; files: number; budgetBytes: number | null; pass: boolean; rules: BudgetRow[] };
export type BudgetResult = {
  megabyte: number;
  categories: BudgetCategory[];
  total: { bytes: number; files: number; budgetBytes: number | null; pass: boolean };
  unmatched: DistFile[];
  over: string[];
  pass: boolean;
};
export declare const CONFIG_PATH: string;
export declare const OTHER: string;
export declare function loadBudgetConfig(path?: string): BudgetConfig;
export declare function globToRegExp(pattern: string): RegExp;
export declare function categorize(path: string, config: BudgetConfig): { category: string; label: string } | null;
export declare function listDistFiles(dir: string): DistFile[];
export declare function evaluateBudget(files: readonly DistFile[], config: BudgetConfig): BudgetResult;
export declare function formatBudgetTable(result: BudgetResult): string;
export declare function formatBudgetMarkdown(result: BudgetResult, options: { sha: string; buildMs: number }): string;
export declare function buildDist(options: { cwd: string; outDir: string }): number;
export declare function measureBuild(options: { cwd: string; config?: BudgetConfig }): { buildMs: number; result: BudgetResult };
