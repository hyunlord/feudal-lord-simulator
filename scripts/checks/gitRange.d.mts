// Types of scripts/checks/gitRange.mjs for TypeScript importers.
export declare const TRUNK: string;
export declare function git(args: string[], cwd?: string): string;
export declare function resolveRange(argv?: string[], cwd?: string): { base: string; head: string };
export declare function changedFiles(base: string, head: string, cwd?: string): { status: string; path: string }[];
export declare function addedLines(base: string, head: string, paths: string[], cwd?: string): { path: string; text: string }[];
export declare function lineChanges(base: string, head: string, paths: string[], cwd?: string): Map<string, { removed: string[]; added: string[] }>;
export declare const isMain: (url: string) => boolean;
