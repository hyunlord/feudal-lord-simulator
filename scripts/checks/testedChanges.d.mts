export interface TestedRecord { file: string; tree: string; passed: boolean; picked?: string[]; tests?: number; pass?: number; where?: string; at?: string }
export interface TestedResult { required: string[]; ok: boolean; match?: TestedRecord; tree?: string; sameTree?: TestedRecord[] }
export function checkTestedChanges(options: { top: string; work: string; base: string; head: string }): TestedResult;
export function formatTestedChanges(result: TestedResult): string;
