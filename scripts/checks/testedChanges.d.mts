export interface TestedRecord { file?: string; tree: string; passed: boolean; picked?: string[]; tests?: number; pass?: number; where?: string; at?: string }
export interface Covered { record: TestedRecord; how: "same" | "reused"; changed: number }
export interface Overlap { record: TestedRecord; files: string[] }
export interface Coverage { covered: Map<string, Covered>; overlaps: Map<string, Overlap>; uncovered: string[] }
export interface TestedResult extends Partial<Coverage> { required: string[]; ok: boolean; tree?: string }
export function testedRecords(top: string): TestedRecord[];
export function testCoverage(options: { top: string; work: string; required: string[]; headTree: string; records?: TestedRecord[] }): Coverage;
export function checkTestedChanges(options: { top: string; work: string; base: string; head: string }): TestedResult;
export function coverageLines(covered: Map<string, Covered>): string[];
export function overlapLines(uncovered: string[], overlaps: Map<string, Overlap>, limit?: number): string[];
export function formatTestedChanges(result: TestedResult): string;
