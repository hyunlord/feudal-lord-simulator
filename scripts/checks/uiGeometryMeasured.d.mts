// Types of scripts/checks/uiGeometryMeasured.mjs (RR26 measured, a′, in shadow).
import type { GeometryException, RowRun } from "./uiGeometry.mjs";
export type Declared = { readonly states?: Readonly<Record<string, string>>; readonly lock?: string | null; readonly viteDeps?: { readonly lockfileHash: string | null; readonly optimized: string } | null;
  readonly chromium?: string | null; readonly playwright?: string | null; readonly node?: string; readonly nodeModules?: { readonly key: string; readonly inode: string } | null;
  readonly system?: Readonly<Record<string, string | null>> };
export type MeasuredInputs = { readonly status: "ok"; readonly inputs: { files: string[]; dirs: string[]; lists?: string[]; missing: string[]; untraceable: string[] }; readonly declared: Declared | null }
  | { readonly status: "none" | "broken" | "untraceable"; readonly why: string; readonly declared?: Declared | null };
export declare function measuredInputs(result: unknown, head: string, cwd?: string): MeasuredInputs;
export declare function staleChanges(from: string, to: string, cwd?: string, cache?: Map<string, unknown>, measured?: MeasuredInputs | { status: string; why: string } | null): {
  readonly changed: number; readonly unsafe: readonly string[]; readonly reaching: number | null; readonly how: string };
export declare function declaredReasons(options: { readonly shared: { readonly run?: string }; readonly sharedDeclared: Declared; readonly sharedRows: readonly [string, { readonly scene?: string } | null][];
  readonly runs: readonly { readonly run: string; readonly ok?: boolean }[]; readonly head: string; readonly cwd?: string }): string[];
export declare function checkRowRunMeasured(options: { readonly run: string; readonly head: string; readonly baseline: readonly string[];
  readonly exceptions: readonly GeometryException[]; readonly cwd?: string; readonly cache?: Map<string, unknown> }): RowRun & { readonly how?: string | null };
export declare function checkUiGeometryMeasured(options: { readonly base?: string | null; readonly head: string; readonly cwd?: string; readonly mode?: "warn" | "enforce";
  readonly env?: Readonly<Record<string, string | undefined>> }): {
  readonly skipped: boolean; readonly mode: "warn" | "enforce"; readonly ok: boolean; readonly pass: boolean; readonly reasons: readonly string[];
  readonly summary?: unknown; readonly comparison?: unknown; readonly unchanged?: boolean;
  readonly rangeChanges?: { readonly changed: number; readonly unsafe: readonly string[]; readonly reaching: number | null; readonly how?: string } | null;
  readonly override?: { readonly reason?: string; readonly refused?: string } | null; readonly rowRuns?: readonly (RowRun & { readonly how?: string | null })[] | null;
  readonly measured?: { readonly status: string; readonly why: string | null } | null;
};
export declare function formatMeasuredResult(result: object): string;
export type Fingerprint = { readonly node: string; readonly chromium: string | null; readonly playwright: string | null; readonly system: Readonly<Record<string, string | null>>;
  readonly states: Readonly<Record<string, string | null>>; readonly nodeModules: { readonly key: string; readonly inode: string | null } | null };
export type MeasuredRange = { readonly status: "ok"; readonly changed: number; readonly files: readonly string[]; readonly shared: SharedAtBase; readonly why?: undefined }
  | { readonly status: "none" | "broken" | "untraceable" | "stale"; readonly why: string; readonly shared: SharedAtBase | null; readonly changed?: undefined; readonly files?: undefined };
export type SharedAtBase = { readonly run: string | null; readonly commit: string | null; readonly declared: Declared | null };
export declare function measuredRange(options: { readonly base: string | null; readonly head: string; readonly cwd?: string }): MeasuredRange;
export declare function environmentReasons(declared: Declared | null | undefined, fingerprint: Fingerprint): string[];
export declare const SHADOW_WORDS: Readonly<Record<"needed" | "not needed" | "fallback" | "undecidable", string>>;
export type ShadowJudgement = { readonly rr26: "needed" | "not needed"; readonly aprime: "needed" | "not needed" | "fallback" | "undecidable"; readonly why: string;
  readonly direction: "saved" | "aprime-only" | null; readonly environment: readonly string[] | null; readonly files: readonly string[] | null; readonly changed: number | null };
export declare function shadowJudgement(options: { readonly gate: { readonly skipped?: boolean; readonly unchanged?: boolean }; readonly range: MeasuredRange; readonly fingerprint: Fingerprint | null }): ShadowJudgement;
export declare function formatShadow(judgement: ShadowJudgement): string;
export declare function remoteShadow(options: { readonly record: object; readonly nodeModulesKey: string | null; readonly env?: Readonly<Record<string, string | undefined>>; readonly cwd?: string }):
  { readonly fingerprint?: Fingerprint; readonly name?: string; readonly error?: string };
export declare function shadowStep(options: { readonly base: string | null; readonly head: string; readonly gate: { readonly skipped?: boolean; readonly unchanged?: boolean; readonly rangeChanges?: { readonly changed: number; readonly unsafe: readonly string[] } | null };
  readonly cwd?: string; readonly env?: Readonly<Record<string, string | undefined>>; readonly now?: Date; readonly remote?: typeof remoteShadow }):
  { readonly judgement: ShadowJudgement | null; readonly record: any; readonly text: string };
