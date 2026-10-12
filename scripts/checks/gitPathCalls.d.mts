export interface UnsafeGitPathCall { path: string; line: number; text: string; why: string }
export declare function unsafeGitPathCalls(files: Map<string, string>): UnsafeGitPathCall[];
export declare function scriptFiles(cwd?: string): Map<string, string>;
