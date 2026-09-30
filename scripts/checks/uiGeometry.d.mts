// Types of scripts/checks/uiGeometry.mjs (a plain module: check:merge imports it with node, tests with types).
export declare const UI_GEOMETRY_SUMMARY: string;
export declare const UI_GEOMETRY_INPUTS: Readonly<Record<string, string>>;
export declare const UI_GEOMETRY_GATE: "warn" | "enforce";
export declare function geometryInputs(rev: string, cwd?: string): Record<string, string | null>;
export declare function geometryInputHash(inputs: Readonly<Record<string, string | null>>): string;
export declare function gateMode(env?: Readonly<Record<string, string | undefined>>): "warn" | "enforce";
export declare function checkUiGeometry(options: { readonly head: string; readonly cwd?: string; readonly mode?: "warn" | "enforce" }): {
  readonly skipped: boolean; readonly mode: "warn" | "enforce"; readonly ok: boolean; readonly pass: boolean; readonly reasons: readonly string[];
  readonly summary?: unknown; readonly hash?: string;
};
export declare function formatUiGeometryResult(result: object): string;
