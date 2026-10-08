/**
 * LM-E2 estates and rights (spec docs/design/estates.md ES-1…ES-10): an estate is a bundle of right pieces, and each
 * piece has a legal title holder and an actual possessor apart — title and possession move separately (Paston bought
 * Gresham and lost it by force in 1448; Ermington in 1432 went for life with its fishery kept back). Claims and suits
 * move titles; possession is enforced on its own.
 */
import type { Person } from "./persons.types";

/**
 * ES-1: who holds a title or a possession: `lord` is the town's ruling house; `house:<order>` a past house; the
 * outside factions by their id (`overlord`, `crown`, `neighbour_1` …); the town's `merchants` and `townsfolk`; a person
 * (`person:<id>`, a life tenant or an heir); a neighbour estate's own house (`estate:<id>`).
 */
export type HolderId = string;

/** ES-1: the kinds of estate. */
export type EstateKind = "manor" | "market_town" | "mill_estate" | "fishery";

/** ES-2: the pieces an estate is made of. `market`, `tolls` and `mill` are the lord's three FAIL-3 rights. */
export type RightPieceKind = "land_rent" | "manor_court" | "mill" | "market" | "tolls" | "fishery" | "advowson" | "hunting";

/** ES-3: how a possession was lost (FAIL-3's suspension and seizure; a neighbour's force; a judgment's loser holding on). */
export type PossessionLoss = "suspended" | "seized" | "forced" | "held_against_judgment";

export interface RightPiece {
  readonly id: string;
  readonly kind: RightPieceKind;
  /** A year's worth (pennies) when it is not read from the ledger (the home estate's paying pieces are). */
  readonly annualValue: number;
  readonly titleHolder: HolderId;
  readonly possessor: HolderId;
  /** The tick the possessor took it (the possession's age; 30 years of it raise a claim, ES-6). */
  readonly possessedSince: number;
  /** How the title holder lost it, when the possessor is another. */
  readonly loss?: PossessionLoss;
  /** ES-4: held for a life (a person), then the remainder takes title and possession. */
  readonly lifeTenant?: HolderId;
  readonly remainder?: HolderId;
  /** LM-E9 (ER-8, NE08): a ruling's scope on the piece — its share of the year's worth (permille), when and by which suit. */
  readonly scope?: { readonly sharePermille: number; readonly ruledTick: number; readonly suitId: string };
  /**
   * DTR-22 (S1, P-L3): the house a judgment took the title from — it keeps a remembered right and claims it back (its
   * heir at once on a succession) until a final concord or its own judgment ends it.
   */
  readonly former?: HolderId;
}

/** ES-1: what an estate owes each year (pennies). */
export interface EstateBurdens {
  readonly debt: number;
  readonly rentCharges: number;
  readonly repairs: number;
}

export interface Estate {
  readonly id: string;
  readonly name: string;
  readonly kind: EstateKind;
  /** ES-1: the manors in it and its yearly worth are apart (Paston's 1444 will divided by "25 marks a year", not by count). */
  readonly manors: number;
  readonly annualValue: number;
  readonly burdens: EstateBurdens;
  readonly pieces: readonly RightPiece[];
  /** The estate's own title and possession (its pieces may stand apart, ES-2). */
  readonly titleHolder: HolderId;
  readonly possessor: HolderId;
  readonly lifeTenant?: HolderId;
  readonly remainder?: HolderId;
  readonly patron?: HolderId;
  readonly steward?: HolderId;
  /** 0–100: how good the title is on paper, and how firm the hold on the ground. */
  readonly titleStrength: number;
  readonly possessionStrength: number;
  /** ES-8: an estate off the map (a neighbour's), with its house and family. */
  readonly offMap: boolean;
  readonly house?: { readonly name: string; readonly lordId: string; readonly familyIds: readonly string[]; readonly rank: "gentry" | "knight" | "baron" };
  /** DTR-22 (S1): the house a judgment took the whole estate's title from (as `RightPiece.former`). */
  readonly former?: HolderId;
}

/** ES-5: what a claim rests on. */
export type ClaimBasis = "inheritance" | "marriage" | "purchase_deed" | "grant" | "old_possession";

/** ES-7: a piece of evidence brought to a suit. */
export interface Evidence {
  readonly kind: "charter" | "deed" | "court_roll" | "witnesses" | "possession_years";
  readonly weight: number;
  readonly tick: number;
}

export interface Claim {
  readonly id: string;
  readonly claimant: HolderId;
  readonly estateId: string;
  /** The piece claimed, or the whole estate. */
  readonly pieceId?: string;
  readonly basis: ClaimBasis;
  /** 0–100, before evidence. */
  readonly strength: number;
  readonly evidence: readonly Evidence[];
  readonly since: number;
  readonly status: "open" | "suing" | "won" | "lost" | "lapsed";
  /** DTR-23: a claim of fresh dispossession (novel disseisin, a forcible entry) — its suit skips evidence and patronage. */
  readonly novel?: true;
}

/** ES-7: the suit's track — filed, evidence, patronage, hearing, judgment; possession is enforced apart. */
export type SuitStage = "filed" | "evidence" | "patronage" | "hearing" | "judged" | "enforcing" | "closed";

export interface Suit {
  readonly id: string;
  readonly claimId: string;
  readonly plaintiff: HolderId;
  readonly defendant: HolderId;
  readonly estateId: string;
  readonly pieceId?: string;
  readonly stage: SuitStage;
  readonly stageSince: number;
  /** A patron the plaintiff won over (a faction), and the weight of its support. */
  readonly patron?: string;
  readonly patronSupport: number;
  readonly verdict?: "plaintiff" | "defendant";
  /** Enforcement attempts after a judgment for the plaintiff, and how the last went. */
  readonly enforcements: number;
  /** The possessor's hold left against enforcement (three quarters of its estate's on the judgment, worn by each attempt). */
  readonly hold?: number;
  readonly enforced?: boolean;
  /** Pennies the plaintiff has spent on it. */
  readonly costs: number;
  /** DTR-23: the lord as defendant — the evidence he brought, the patron he won over and its support. */
  readonly defenceEvidence?: readonly Evidence[];
  readonly defencePatron?: string;
  readonly defenceSupport?: number;
  /** DTR-23: ended by a final concord — the lord paid the plaintiff off, or yielded the piece. */
  readonly settled?: "pay" | "yield";
  /** DTR-23: the tick the lord last put men in to hold the possession against the plaintiff's enforcement. */
  readonly heldTick?: number;
  /** DTR-23: a novel disseisin's suit (filed, then the hearing). */
  readonly fast?: true;
}

/**
 * DTR-23 (S3, the ±60 large act, P-W2): a hostile house gathers men to enter a piece the lord possesses of its estate —
 * forewarned a season ahead; the lord may guard it or appease the house, else the house enters at the season's turn.
 */
export interface EntryThreat {
  readonly id: string;
  readonly house: HolderId;
  readonly estateId: string;
  readonly pieceId: string;
  readonly tick: number;
  readonly due: number;
  readonly guarded?: true;
}

/** ES-1: the estates state — absent while the portfolio is the opening one (ES-9: no state until something differs). */
export interface EstatesState {
  readonly estates: readonly Estate[];
  readonly claims: readonly Claim[];
  readonly suits: readonly Suit[];
  readonly nextClaim: number;
  readonly nextSuit: number;
  /** ES-8: the neighbour families not among the factions' people (the third neighbour's house). */
  readonly people: readonly Person[];
  /** DTR-23: forcible entries forewarned (absent: none ever). */
  readonly threats?: readonly EntryThreat[];
}
