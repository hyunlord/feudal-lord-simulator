import type { execFileSync } from 'node:child_process';

export interface GitPathsOptions { cwd?: string; maxBuffer?: number; exec?: typeof execFileSync }
export declare function gitText(args: string[], options?: GitPathsOptions): string;
export declare function gitPathsOut(args: string[], options?: GitPathsOptions): string;
export declare function gitPaths(args: string[], options?: GitPathsOptions): string[];
