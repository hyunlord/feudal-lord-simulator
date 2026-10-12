// Types of scripts/checks/lintExceptions.mjs for TypeScript importers.
export interface LintException { path: string; line: number; text: string; why: boolean }
export declare const BASELINE_FILE: URL;
export declare function findExceptions(head: string, cwd?: string): LintException[];
export declare function readBaseline(): unknown[];
export declare function checkLintExceptions(options: { head: string; cwd?: string; baseline?: unknown[] }): { hits: LintException[]; unexplained: LintException[]; stale: unknown[] };
export declare function formatLintResult(result: { hits: LintException[]; unexplained: LintException[]; stale: unknown[] }): string;
