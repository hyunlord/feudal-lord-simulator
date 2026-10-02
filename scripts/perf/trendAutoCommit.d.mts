// Types of scripts/perf/trendAutoCommit.mjs for tests.
export declare const TREND_DIR: string;
export declare function refreshPlan(options: { branch: string | null; squash: boolean; trunkInHead: boolean; lag: number | null; dirty: boolean; limit?: number }): { refresh: boolean; reason: string };
