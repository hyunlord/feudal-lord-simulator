export interface TestedRecord { file?: string; tree: string; head?: string; inputs?: unknown; passed: boolean; picked?: string[]; tests?: number; pass?: number; where?: string; at?: string }
export interface Covered { record: TestedRecord; how: "same" | "reused"; changed: number }
export interface Overlap { record: TestedRecord; files: string[] }
export interface Failed { record: TestedRecord; how: "same" | "reused" | "uncompared" }
export interface Unmeasured { record: TestedRecord; why: string }
export interface Coverage { covered: Map<string, Covered>; overlaps: Map<string, Overlap>; failed: Map<string, Failed>; unmeasured: Map<string, Unmeasured>; uncovered: string[] }
export interface TestedResult extends Partial<Coverage> { required: string[]; ok: boolean; tree?: string }
export function testedRecords(top: string): TestedRecord[];
export function testCoverage(options: { top: string; work: string; required: string[]; headTree: string; records?: TestedRecord[] }): Coverage;
export function checkTestedChanges(options: { top: string; work: string; base: string; head: string }): TestedResult;
export function coverageLines(covered: Map<string, Covered>): string[];
export function overlapLines(uncovered: string[], overlaps: Map<string, Overlap>, limit?: number, failed?: Map<string, Failed>, unmeasured?: Map<string, Unmeasured>): string[];
export function measuredPicks(options: { work: string; base: string; head: string; records: TestedRecord[] }): Map<string, string[]>;
export function formatTestedChanges(result: TestedResult): string;
export interface ReuseEvidence { how: "same" | "reused"; from: { tree: string; commit: string | null; run: string | null; at: string | null }; changedSince: number; why: string; tests: string[] }
export function reuseEvidence(covered: Map<string, Covered>): ReuseEvidence[];
export function newestFirst(a: { at?: string }, b: { at?: string }): number;
