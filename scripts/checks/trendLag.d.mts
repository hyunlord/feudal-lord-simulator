// Types of scripts/checks/trendLag.mjs for tsx scripts and tests (the merge checks are plain modules).
export type TrendLag = { measured: string[]; newest: string | null; lag: number | null; unit: "trunk heads" | "commits" };
export declare const TREND_FILE: string;
export declare const TREND_LAG_LIMIT: number;
export declare function checkTrendLag(options: { head: string; cwd?: string; trunkHeads?: readonly string[] }): TrendLag;
export declare function reflogHeads(cwd?: string): string[];
export declare function formatTrendLag(result: TrendLag, limit?: number): string;
export declare function logTrendLag(result: TrendLag, head: string, cwd?: string, limit?: number): boolean;
