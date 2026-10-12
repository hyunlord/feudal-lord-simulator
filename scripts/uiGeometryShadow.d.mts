// Types of scripts/uiGeometryShadow.mjs (SHADOW.md from the shadow records; tests import it with types).
import type { ShadowJudgement } from "./checks/uiGeometryMeasured.mjs";
export declare const SHADOW_FILE: string;
export declare const SHADOW_MODULE: string;
export type Comparison = { readonly rows: number; readonly total: number; readonly failures: readonly string[]; readonly unopened: readonly string[] };
export type Carried = { readonly kind: "full" | "rows" | "none"; readonly runs: readonly string[]; readonly durationS: number | null; readonly reference: string | null; readonly comparison: Comparison | null };
export type Recheck = { readonly status: "pending" } | { readonly status: "unreadable"; readonly run: string } | ({ readonly status: "checked"; readonly run: string } & Comparison);
export type ShadowPush = { readonly head: string; readonly base: string | null; readonly record: any; readonly judgement: ShadowJudgement; readonly carried: Carried | null; recheck: Recheck | null };
export type ShadowHistory = { readonly since: string; readonly trunk: string | null; readonly pushes: readonly ShadowPush[]; readonly unrecorded: readonly (readonly string[])[];
  readonly fullAudits: readonly { readonly commit: string; readonly run: string; readonly report: string }[] };
export declare function loadRecords(dir: string): any[];
export declare function fetchDgxRecords(env?: Readonly<Record<string, string | undefined>>): any[];
export declare function compareWithFull(reference: unknown, reports: readonly unknown[]): Comparison;
export declare function auditCarried(options: { readonly base: string; readonly head: string; readonly cwd?: string }): Carried;
export declare function judgementOf(record: any): ShadowJudgement;
export declare function shadowStart(trunk: string, cwd?: string): string | null;
export declare function shadowHistory(options: { readonly records: readonly any[]; readonly trunk: string; readonly since: string; readonly cwd?: string }): ShadowHistory;
export declare function formatShadowMarkdown(history: ShadowHistory): string;
