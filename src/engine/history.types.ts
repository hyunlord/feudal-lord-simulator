/**
 * F0-C2 history ledger v0 (spec docs/design/history-ledger.md HL-1…HL-9, design docs/design/CHRONICLE_DESIGN.md §1):
 * the append-only record of the town's story, saved (v15). A record keeps a template id and its parameters; the
 * sentence (`historySummary`) and the date (`historyDate`) are rebuilt from them, so the save stays small.
 */
import type { SourceRef } from "../contracts";

export const HISTORY_KINDS = ["decision", "event", "person", "faction", "era", "milestone", "ledger"] as const;
export type HistoryKind = (typeof HISTORY_KINDS)[number];

/** HL-4: 0 everyday · 1 milestone or big decision · 2 event · 3 era. */
export type HistorySeverity = 0 | 1 | 2 | 3;

/** Who a record is about: the town, a household (F0; a person from PERSON-0), a faction or a lineage (later). */
export interface ActorRef {
  readonly type: "town" | "household" | "person" | "faction" | "lineage";
  readonly id: string;
}

/** HL-3: a decision with its alternatives, what was expected and (filled later) what happened, on the same keys. */
export interface HistoryDecision {
  readonly chosen: string;
  readonly alternatives: readonly string[];
  readonly predicted: Readonly<Record<string, number>>;
  readonly actual?: Readonly<Record<string, number>>;
  /** The tick the ledger fills `actual` (one or two seasons after the decision). */
  readonly actualDueTick?: number;
}

export type HistoryParams = Readonly<Record<string, number | string>>;

export interface HistoryRecord {
  /** `h-000001`, in order. */
  readonly id: string;
  readonly tick: number;
  readonly kind: HistoryKind;
  /** The sentence template (`historyCopy.ko.ts`); the summary is rebuilt from it and `params`. */
  readonly template: string;
  readonly params?: HistoryParams;
  readonly subject: ActorRef;
  readonly actors?: readonly ActorRef[];
  readonly place?: { readonly tx: number; readonly ty: number; readonly buildingId?: string };
  readonly cause?: SourceRef;
  readonly decision?: HistoryDecision;
  readonly severity: HistorySeverity;
  readonly illustration?: string;
  readonly snapshotId?: string;
}

/** HL-5: a map thumbnail (`size`² palette indices, run-length encoded, base64). */
export interface HistorySnapshot {
  readonly id: string;
  readonly tick: number;
  readonly size: 128 | 256;
  readonly data: string;
}

export interface HistoryState {
  readonly records: readonly HistoryRecord[];
  readonly snapshots: readonly HistorySnapshot[];
  readonly nextOrdinal: number;
  /** HL-2: the season's everyday decisions, counted by decision kind; written as one record per kind at its end. */
  readonly seasonDecisions: Readonly<Record<string, number>>;
  /** HL-2 ③: milestones already reached (ids). */
  readonly milestones: readonly string[];
  /** HL-3: decision records whose `actual` is still to be filled, with the tick it falls due. */
  readonly pendingActuals: readonly { readonly id: string; readonly due: number }[];
}

/** HL-7 query filter. */
export interface HistoryQuery {
  readonly kinds?: readonly HistoryKind[];
  /** Least severity. */
  readonly severity?: HistorySeverity;
  /** Records whose subject or actors include one of these. */
  readonly actors?: readonly ActorRef[];
  /** Ticks, inclusive. */
  readonly range?: { readonly from?: number; readonly to?: number };
}
