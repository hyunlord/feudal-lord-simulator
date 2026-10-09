// Types of scripts/checks/uiGeometry.mjs (a plain module: check:merge imports it with node, tests with types).
export type GeometryException = { readonly row: string; readonly check: string; readonly match: string; readonly reason: string; readonly detail?: string };
export declare const UI_GEOMETRY_SUMMARY: string;
export declare const UI_GEOMETRY_BASELINE: string;
export declare const UI_GEOMETRY_EXCEPTIONS: string;
export declare const UI_INPUT_ROOTS: readonly { readonly root: string; readonly only: RegExp | null }[];
export declare const UI_GEOMETRY_GATE: "warn" | "enforce";
export declare const UI_ENTRY: string;
export declare const CLOSURE_ENTRIES: readonly string[];
export declare const UI_INPUT_FILES: readonly string[];
export declare function withoutComments(text: string): string;
export declare const UI_GEOMETRY_RUNS: string;
export declare function treeFiles(rev: string, cwd?: string): Map<string, string>;
export declare function uiImportClosure(rev: string, cwd?: string, files?: Map<string, string>): Set<string>;
export declare function geometryInputs(rev: string, cwd?: string): string[];
export declare function isSafePath(path: string, importedTests?: ReadonlySet<string> | null): boolean;
export declare function importedTests(rev: string, cwd?: string, files?: Map<string, string>): Set<string>;
export declare function unsafeChanges(from: string, to: string, cwd?: string, cache?: Map<string, unknown>): {
  readonly changed: number; readonly unsafe: readonly string[]; readonly reaching: number | null };
export type MeasuredInputs = { readonly status: "ok"; readonly inputs: { files: string[]; dirs: string[]; lists?: string[]; missing: string[]; untraceable: string[] }; readonly declared: Declared | null }
  | { readonly status: "none" | "broken" | "untraceable"; readonly why: string; readonly declared?: Declared | null };
export type Declared = { readonly states?: Readonly<Record<string, string>>; readonly lock?: string | null; readonly viteDeps?: { readonly hash: string | null; readonly browserHash: string | null } | null;
  readonly chromium?: string | null; readonly playwright?: string | null; readonly system?: Readonly<Record<string, string | null>> };
export declare function measuredInputs(result: unknown, head: string, cwd?: string): MeasuredInputs;
export declare function staleChanges(from: string, to: string, cwd?: string, cache?: Map<string, unknown>, measured?: MeasuredInputs | null): {
  readonly changed: number; readonly unsafe: readonly string[]; readonly reaching: number | null; readonly how: string };
export declare function declaredReasons(options: { readonly shared: { readonly run?: string }; readonly sharedDeclared: Declared; readonly sharedRows: readonly [string, { readonly scene?: string } | null][];
  readonly runs: readonly { readonly run: string; readonly ok?: boolean }[]; readonly head: string; readonly cwd?: string }): string[];
export type RetryNotes = { readonly run: string | null; readonly timeouts: number; readonly failedThrice: number; readonly cellsRetried: number; readonly treesRetried: number;
  readonly conditions: number | null; readonly rows: readonly string[]; readonly again: readonly string[]; readonly previousRun: string | null };
export declare function retryNotes(summary: unknown, head: string, cwd?: string): RetryNotes | null;
export declare function uiInputsDirty(cwd?: string, rev?: string): string[];
export declare function defaultSummaryPath(options: { readonly explicit: string | undefined; readonly full: boolean }): string;
export declare function rowRunsInRange(base: string | null, head: string, cwd?: string): string[];
export declare function reportFailures(report: unknown): { keys: string[]; measured: Map<string, Set<string>> };
export type RowRun = { readonly run: string; readonly ok: boolean; readonly reasons: readonly string[]; readonly commit?: string; readonly rows?: readonly string[];
  readonly cells?: number; readonly failures?: number; readonly moved?: number | null; readonly superseded?: boolean; readonly how?: string | null };
export declare function checkRowRun(options: { readonly run: string; readonly head: string; readonly baseline: readonly string[];
  readonly exceptions: readonly GeometryException[]; readonly cwd?: string; readonly cache?: Map<string, unknown> }): RowRun;
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
  readonly summary?: unknown; readonly comparison?: unknown; readonly unchanged?: boolean;
  readonly rangeChanges?: { readonly changed: number; readonly unsafe: readonly string[]; readonly reaching: number | null; readonly how?: string } | null; readonly override?: { readonly reason?: string; readonly refused?: string } | null;
  readonly rowRuns?: readonly RowRun[] | null; readonly measured?: { readonly status: string; readonly why: string | null } | null; readonly retries?: RetryNotes | null;
};
export declare function formatUiGeometryResult(result: object): string;
