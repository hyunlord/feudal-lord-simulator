/**
 * LM-E4 delegation, attention and the yearly audit (spec docs/design/stewardship.md SW-1…SW-9): once the lord holds an
 * estate off the map (the marriage's inheritance), each such estate is overseen directly or by a steward. A steward
 * (a person: ability, loyalty, disposition, a connection) answers the estate's petitions, small disputes and dues by his
 * disposition, keeps its accounts — and may keep some of them back; the lord's exceptions bring some petitions to him;
 * at Michaelmas the accounts are audited (by letter or by a visit, which costs the lord's attention elsewhere).
 */
import type { HolderId } from "./estates.types";

/** SW-3: how a steward leans — the merchants' friend, the tenants' friend, or his own. */
export type StewardDisposition = "merchant" | "peasant" | "greedy";

/** SW-3: a steward of an estate (the person is an estate person, `estates.people`). */
export interface StewardRecord {
  readonly personId: string;
  readonly estateId: string;
  /** 0–100: how well he keeps the books (errors) and how well he hides what he keeps back. */
  readonly ability: number;
  /** 0–100: how much he keeps back (a greedy steward keeps more). */
  readonly loyalty: number;
  readonly disposition: StewardDisposition;
  /** A faction he is tied to (a punishment costs its relation), or null. */
  readonly connection: string | null;
  readonly since: number;
  /** Pennies kept back since the last audit (hidden), and lost by errors (unrecorded). */
  readonly kept: number;
  readonly errors: number;
  /** A candidate waits; one steward serves each estate; a dismissed one is not offered again; a dead one (FIX-13) neither. */
  readonly status: "candidate" | "serving" | "dismissed" | "dead";
}

/** SW-2: who decides an estate's affairs. */
export type OversightMode = "direct" | "steward";

/** SW-4: an estate's petition — who asks, what it costs or brings, and whether it touches a right or a marriage. */
export type EstatePetitionKind = "rent_relief" | "market_dues" | "repair" | "common_dispute" | "charter_request" | "marriage_licence";
/**
 * FIX-14 (SW-11): the home estate's petitions of 1300–1320, brought to the lord himself — a boundary, the suit of the
 * mill, a heriot, a merchet, the ale fines, a road or bridge, a stall, a wardship, the common's stint, a newcomer's
 * holding, the pannage, the chancel.
 */
export type HomePetitionKind = "boundary_dispute" | "mill_suit" | "heriot" | "merchet" | "ale_fines" | "road_bridge" | "stall_dispute" | "wardship"
  | "common_pasture" | "newcomer" | "pannage" | "chancel_repair";

export interface EstatePetition {
  readonly id: string;
  readonly estateId: string;
  readonly kind: EstatePetitionKind | HomePetitionKind;
  readonly group: "tenants" | "merchants";
  /** Pennies: relief or dues forgone, a repair's cost, a licence's fee. */
  readonly amount: number;
  readonly rights: boolean;
  readonly marriage: boolean;
  readonly tick: number;
  /** When it reaches the lord (an overloaded lord's direct estate: a season late). */
  readonly reachesLord?: number;
  readonly deadline: number;
  readonly status: "open" | "granted" | "refused" | "lapsed";
  /** Who answered it: the steward, or the lord (escalated by the exceptions, or a direct estate's). */
  readonly decidedBy?: "steward" | "lord";
  /** Why it came to the lord: the exceptions' rule it matched, or `direct`. */
  readonly escalated?: "amount" | "rights" | "marriage" | "direct";
  /** FIX-14 (SW-11): the other side a home petition sets the lord's men against (a neighbour house's faction). */
  readonly party?: string;
  /** FIX-14 (SW-12): the steward answered it as the lord answered the same kind before (no longer brought up). */
  readonly precedent?: true;
}

/** SW-5: the lord's exceptions — what a steward must bring to him (£5 or more, a right changed, a marriage). */
export interface ExceptionRules {
  readonly amountAtLeast: number | null;
  readonly rights: boolean;
  readonly marriage: boolean;
  /** FIX-14 (SW-12): bring up a kind the lord has answered before too (the steward follows no precedent). */
  readonly recurring?: boolean;
}

/** SW-7: one season of an off-map estate, as the lord sees it (and what he does not). */
export interface QuarterSummary {
  readonly estateId: string;
  readonly tick: number;
  readonly mode: OversightMode;
  /** Pennies the estate yielded, what the accounts showed (paid into the treasury), kept back, lost by errors. */
  readonly income: number;
  readonly reported: number;
  readonly kept: number;
  readonly error: number;
  readonly rentPermille: number;
  readonly duesPermille: number;
  readonly petitions: readonly { readonly id: string; readonly kind: EstatePetition["kind"]; readonly status: EstatePetition["status"]; readonly decidedBy?: "steward" | "lord" }[];
  readonly tenants: number;
  readonly merchants: number;
  /** SW-1: the lord's attention was over its limit this season (a direct estate's petitions waited, its books erred). */
  readonly overloaded: boolean;
}

/** SW-6: an estate's audit at Michaelmas. */
export interface AuditRecord {
  readonly id: string;
  readonly estateId: string;
  readonly tick: number;
  readonly stewardId: string;
  readonly mode: "accounts" | "visit";
  /** Pennies the audit found (kept back and errors), and what stayed hidden. */
  readonly revealedKept: number;
  readonly revealedErrors: number;
  readonly hidden: number;
  readonly status: "clean" | "pending" | "punished" | "replaced" | "tolerated";
  readonly deadline: number;
}

export interface EstateOversight {
  readonly estateId: string;
  readonly mode: OversightMode;
  /** The steward (or, in a direct estate, the receiver who keeps its accounts). */
  readonly stewardId: string;
  readonly auditMode: "accounts" | "visit";
  /** -100…100: the estate's tenants and merchants toward the lord. */
  readonly tenants: number;
  readonly merchants: number;
  /** Pennies that stayed hidden over all audits (the corruption never found). */
  readonly undetected: number;
  readonly since: number;
}

export interface StewardshipState {
  readonly oversight: readonly EstateOversight[];
  readonly stewards: readonly StewardRecord[];
  readonly petitions: readonly EstatePetition[];
  readonly summaries: readonly QuarterSummary[];
  readonly audits: readonly AuditRecord[];
  readonly rules: ExceptionRules;
  /** SW-1: the tick of the lord's last audit visit (his attention is less for a year after). */
  readonly visitTick?: number;
  readonly nextPetition: number;
  readonly nextAudit: number;
}

/** SW-8 API: an estate in the portfolio as the screens show it (delegation, attention, the last season, the last audit). */
export interface OversightView {
  readonly estateId: string;
  readonly holder: HolderId;
  readonly oversight: EstateOversight;
  readonly steward: StewardRecord | undefined;
  readonly lastSummary: QuarterSummary | undefined;
  readonly lastAudit: AuditRecord | undefined;
}
