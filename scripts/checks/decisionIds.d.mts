// Types of scripts/checks/decisionIds.mjs for tsx scripts and tests (the merge checks are plain modules).
export declare const DECISIONS_FILE: string;
export declare function duplicateDecisionIds(text: string): Map<string, number[]>;
export declare function checkDecisionIds(options: { head: string; cwd?: string }): { duplicates: Map<string, number[]> };
export declare function formatDecisionIdResult(result: { duplicates: Map<string, number[]> }): string;
