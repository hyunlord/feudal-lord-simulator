export type TestInputs = { files: string[]; dirs: string[]; lists?: string[]; missing: string[]; untraceable: string[]; declared?: string[]; children?: string[] };
export type PackedInputs = { schema: 1; paths: string[]; tests: Record<string, { f: number[]; d: number[]; l?: number[]; m: number[]; u: string[] }> };
export declare const EVERY_TEST: readonly string[];
export declare function collectTestInputs(options: { root: string; traceDir: string; coverageDir?: string | null; declared?: readonly string[] }): Map<string, TestInputs>;
export declare function packInputs(byTest: Map<string, TestInputs>): PackedInputs;
export declare function unpackInputs(packed: PackedInputs | null | undefined, test: string): TestInputs | null;
export declare function treeChanges(cwd: string, from: string, to: string): { status: string; path: string }[];
export declare function inputOverlap(inputs: TestInputs, changes: readonly { status: string; path: string }[], options?: { namesChanged?: ((dir: string) => boolean) | null; shadows?: boolean }): string[];
