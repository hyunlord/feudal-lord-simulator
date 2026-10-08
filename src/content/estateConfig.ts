/**
 * LM-E2 (spec docs/design/estates.md): the estates' numbers — the home estate's pieces, the neighbours' values, the
 * claims' strengths and the suit's stages. Balance values; the historical anchors are named where they are used
 * (research `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md`: Paston 1444 "25 marks a year", 40 marks; a mark
 * is 160d).
 */
import type { ClaimBasis, Evidence, EstateKind, RightPieceKind, SuitStage } from "../engine/estates.types";

/** ES-1: the home estate's id (the town and its manor) — the player's first estate. */
export const HOME_ESTATE_ID = "estate-home";

/** ES-2: the home estate's pieces, in order; `market`, `tolls` and `mill` pay through the ledger (FAIL-3's three rights). */
export const HOME_PIECES: readonly { readonly id: string; readonly kind: RightPieceKind; readonly annualValue: number }[] = [
  { id: "home:land_rent", kind: "land_rent", annualValue: 0 },
  { id: "home:manor_court", kind: "manor_court", annualValue: 240 },
  { id: "home:market", kind: "market", annualValue: 0 },
  { id: "home:tolls", kind: "tolls", annualValue: 0 },
  { id: "home:mill", kind: "mill", annualValue: 0 },
  { id: "home:fishery", kind: "fishery", annualValue: 320 },
  { id: "home:advowson", kind: "advowson", annualValue: 0 },
];

/** ES-2: the ledger categories a paying piece's year is read from (the last four periods). */
export const PIECE_INCOME_CATEGORIES: Readonly<Partial<Record<RightPieceKind, readonly string[]>>> = {
  land_rent: ["rent"], market: ["stall_fee"], tolls: ["toll"], mill: ["mill_toll"],
};

/**
 * ES-10: the franchises granted from the home estate (chapters 1–5's `politics.rights`) and the piece each stands on —
 * the market charter and the market's tolls on the market, the bridge tolls on the tolls, commuted rent on the rent,
 * the mayoralty and the borough seal on the manor court (the town governs itself).
 */
export const GRANT_PIECE: Readonly<Record<string, RightPieceKind>> = {
  market_charter: "market", market_tolls: "market", bridge_tolls: "tolls", commuted_rent: "land_rent", mayoralty: "manor_court", borough_seal: "manor_court",
};

/** A mark in pennies (13s 4d). */
export const MARK_PENNIES = 160;

/**
 * ES-8: the three neighbour estates off the map. The first two are the neighbouring lords' (FACTION-0's `neighbour_1`,
 * `neighbour_2`); the third is a house of its own — an old lord with daughters only, of like rank, in money trouble
 * (the vertical slice's marriage match, LM-E3).
 */
export const NEIGHBOUR_ESTATES: readonly {
  readonly id: string; readonly faction: string | null; readonly kind: EstateKind; readonly manors: number; readonly marks: number;
  readonly burdens: { readonly debt: number; readonly rentCharges: number; readonly repairs: number };
  readonly pieces: readonly RightPieceKind[];
}[] = [
  { id: "estate-neighbour-1", faction: "neighbour_1", kind: "manor", manors: 3, marks: 40, burdens: { debt: 0, rentCharges: 480, repairs: 320 },
    pieces: ["land_rent", "manor_court", "fishery", "hunting"] },
  { id: "estate-neighbour-2", faction: "neighbour_2", kind: "mill_estate", manors: 2, marks: 25, burdens: { debt: 800, rentCharges: 320, repairs: 480 },
    pieces: ["land_rent", "manor_court", "mill", "advowson"] },
  // The old lord's: 25 marks a year like Paston's blocks, with debts past a year's worth and repairs owed.
  { id: "estate-neighbour-3", faction: null, kind: "manor", manors: 2, marks: 25, burdens: { debt: 6_400, rentCharges: 640, repairs: 960 },
    pieces: ["land_rent", "manor_court", "advowson", "hunting"] },
];

/** ES-8: the old lord's age at the town's opening, and his daughters' (no son; his wife is dead). */
export const OLD_LORD_AGE = 63;
export const OLD_LORD_DAUGHTER_AGES: readonly number[] = [19, 15];

/** ES-7 (the human path's dispute): the lord's old claim from the opening — the first neighbour's fishery, by an earl's
 * grant to the town's lords that the neighbour's house never honoured (Ermington 1432 dealt the fishery apart). */
export const OPENING_CLAIMS: readonly { readonly estateId: string; readonly pieceKind: RightPieceKind; readonly basis: ClaimBasis }[] = [
  { estateId: "estate-neighbour-1", pieceKind: "fishery", basis: "grant" },
];

/** ES-1: a sound title and hold (the home estate's, the neighbours' own). */
export const SOUND_STRENGTH = 100;

/** ES-5: a claim's strength by its basis, before evidence. */
export const CLAIM_BASIS_STRENGTH: Readonly<Record<ClaimBasis, number>> = {
  inheritance: 60, marriage: 50, purchase_deed: 55, grant: 45, old_possession: 40,
};

/** ES-6: years of possession without the title that raise the possessor's own claim (the old prescription). */
export const OLD_POSSESSION_YEARS = 30;

/** ES-7: each kind of evidence's weight (added to the claim's strength in the hearing). */
export const EVIDENCE_WEIGHT: Readonly<Record<Evidence["kind"], number>> = {
  charter: 20, deed: 15, court_roll: 10, witnesses: 8, possession_years: 12,
};
/** ES-7: what bringing a piece of evidence costs (search, copying, the witnesses' journey), pennies. */
export const EVIDENCE_COST: Readonly<Record<Evidence["kind"], number>> = {
  charter: 40, deed: 30, court_roll: 20, witnesses: 24, possession_years: 0,
};

/** ES-7: the suit's stages in order, each one season at least, and what entering it costs the plaintiff. */
export const SUIT_STAGES: readonly SuitStage[] = ["filed", "evidence", "patronage", "hearing", "judged", "enforcing", "closed"];
export const SUIT_STAGE_COST: Readonly<Partial<Record<SuitStage, number>>> = { filed: 60, hearing: 120, enforcing: 80 };
/** ES-7: a patron's support is its relation with the lord, at most this much, from this relation up. */
export const PATRON_SUPPORT_MAX = 30;
export const PATRON_MIN_RELATION = 10;
/** ES-7: the defendant's side in the hearing: a share of its title's strength and of its hold on the ground. */
export const DEFENCE_TITLE_PERMILLE = 600;
export const DEFENCE_POSSESSION_PERMILLE = 200;
/** ES-7: the judgment's loser still holds this share (‰) of its estate's possession strength on the ground. */
export const JUDGMENT_HOLD_PERMILLE = 750;
/** ES-7: enforcing a judgment: the plaintiff's force (patron support + this) against the possessor's hold. */
export const ENFORCEMENT_BASE = 40;
/** ES-7: each failed enforcement weakens the hold this much (the possessor's men tire, the sheriff comes again). */
export const ENFORCEMENT_WEAR = 20;
/**
 * DTR-21 (the user's judgement 2026-10-08, A6; Paston's suits ate years of income): in lord mode a stage costs the
 * larger of its fee (`SUIT_STAGE_COST`) and this share of the stake's year's worth (the piece's, or the estate's) —
 * and the lord pays the filing and hearing as a defendant too. Game estimates.
 */
// DTR-22: the writ stays its fee (the filing): a stake-scaled filing (160d on the opening's fishery) shut the slice's
// first suit to its 60d treasury; the counsel at the hearing and the sheriff's process carry the stake.
export const SUIT_STAKE_PERMILLE: Readonly<Partial<Record<SuitStage, number>>> = { hearing: 300, enforcing: 150 };
/** DTR-21: a possession the lord took lately holds weakly against the old house's enforcement — this, and this a year more. */
export const FRESH_HOLD_BASE = 30;
export const FRESH_HOLD_PER_YEAR = 5;

/**
 * DTR-23 (the user's decision 2026-10-08: the lord sued must have ways to defend; Astra lordplay2 friction 1). Game
 * estimates, scaled to the stake's year like the stage costs (DTR-21).
 * - A final concord (finalis concordia — the fine levied in the king's court that ended a dispute for good): the lord
 *   pays the plaintiff `concordPermille` of the stake's year times the plaintiff's share of the hearing's two sides
 *   (after a judgment against him, the whole) — doubled with a house past −60 — or yields the piece. It ends the
 *   house's remembered right (DTR-22).
 * - Holding on against a judgment: a season of men, `holdPermille` of the stake's year, adds `holdBoost` to the hold
 *   (at most `holdCap`), once a year.
 * - A forcible entry forewarned: men to guard the piece for the season (`guardPermille`), or a gift to the house
 *   (`appeasePermille`, its relation +`appeaseRelation`). Entered, the lord has a novel disseisin: a claim of
 *   `novelStrength` whose suit goes from its filing straight to the hearing.
 */
export const SUIT_DEFENCE = {
  concordPermille: 1500,
  concordHostileAt: -60,
  concordHostileFactor: 2,
  holdPermille: 150,
  holdBoost: 25,
  holdCap: 100,
  guardPermille: 250,
  appeasePermille: 200,
  appeaseRelation: 15,
  novelStrength: 80,
  /** The least a concord, a season's guard or a gift costs (pennies). */
  floor: 60,
} as const;
