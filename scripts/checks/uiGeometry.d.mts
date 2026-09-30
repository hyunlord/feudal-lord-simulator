// Types of scripts/checks/uiGeometry.mjs (a plain module: check:merge imports it with node, tests with types).
export type GeometryException = { readonly row: string; readonly check: string; readonly match: string; readonly reason: string; readonly detail?: string };
export declare const UI_GEOMETRY_SUMMARY: string;
export declare const UI_GEOMETRY_BASELINE: string;
export declare const UI_GEOMETRY_EXCEPTIONS: string;
export declare const UI_INPUT_ROOTS: readonly { readonly root: string; readonly only: RegExp | null }[];
export declare const UI_GEOMETRY_SCRIPTS: readonly string[];
export declare const UI_GEOMETRY_GATE: "warn" | "enforce";
export declare function geometryInputs(rev: string, cwd?: string): string[];
export declare function geometryInputHash(inputs: readonly string[]): string;
export declare function logWarnOverride(result: object, options?: { readonly top?: string; readonly head?: string }): string | null;
export declare function gateMode(env?: Readonly<Record<string, string | undefined>>): "warn" | "enforce";
export declare function splitKey(key: string): { readonly row: string; readonly condition: string; readonly check: string; readonly path: string };
export declare function compareBaseline(options: { readonly keys: readonly string[]; readonly baseline?: readonly string[]; readonly exceptions?: readonly GeometryException[] }): {
  readonly failures: number; readonly excepted: number; readonly baseline: number; readonly exceptions: number; readonly counted: readonly string[];
  readonly added: readonly string[]; readonly fixed: readonly string[]; readonly staleExceptions: readonly GeometryException[];
};
export declare function overridesInRange(base: string | null, head: string, cwd?: string): { readonly commit: string; readonly reason: string }[];
export declare function formatOverrideCount(base: string | null, head: string, cwd?: string): string;
export declare function checkUiGeometry(options: { readonly base?: string | null; readonly head: string; readonly cwd?: string; readonly mode?: "warn" | "enforce";
  readonly env?: Readonly<Record<string, string | undefined>> }): {
  readonly skipped: boolean; readonly mode: "warn" | "enforce"; readonly ok: boolean; readonly pass: boolean; readonly reasons: readonly string[];
  readonly summary?: unknown; readonly hash?: string; readonly override?: { readonly reason?: string; readonly refused?: string } | null;
};
export declare function formatUiGeometryResult(result: object): string;
