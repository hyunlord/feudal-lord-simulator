// Types of scripts/checks/evidenceSize.mjs for tsx scripts and tests (the merge checks are plain modules).
export type EvidenceFile = { path: string; bytes: number };
export type EvidenceFolder = { folder: string; bytes: number; allowed: number; files: EvidenceFile[] };
export declare const EVIDENCE_ROOT: string;
export declare const EVIDENCE_LIMIT_BYTES: number;
export declare const EVIDENCE_BASELINE_FILE: string;
export declare function evidenceFolder(path: string): string | null;
export declare function isExempt(path: string): boolean;
export declare function folderFiles(rev: string, folder: string, cwd?: string): EvidenceFile[];
export declare function loadEvidenceBaseline(path?: string): Record<string, number>;
export declare function checkEvidenceSize(options: { base: string; head: string; cwd?: string; baseline?: Record<string, number>; limit?: number }): { folders: EvidenceFolder[]; over: EvidenceFolder[] };
export declare function formatEvidenceResult(result: { folders: EvidenceFolder[]; over: EvidenceFolder[] }): string;
