/**
 * LM-E9b (spec docs/design/registry.md ER-21): the neighbour world's yearly rules the registry runs in lord mode
 * (docs/design/neighbor-world-20261003/RULES.md; its chances are game estimates).
 */
/** NW07: a neighbour estate whose papers surface a claim of the lord's — permille a year (the design's 5–18 %, its pick 10 %). */
export const NW07_CLAIM_SURFACES_PERMILLE = 100;
/** NW08: a neighbour house's head died last year — a contested succession gives the lord a claim, permille (the design's 250‰). */
export const NW08_CONTESTED_SUCCESSION_PERMILLE = 250;
/**
 * ER-21 (Paston, the user's decision 2026-10-05): a piece the lord took from a neighbour house that still holds the
 * estate's title — its heirs, widow or kin claim it back and sue, permille a year (one open on an estate at a time).
 */
export const RECOVERY_CLAIM_PERMILLE = 100;
/**
 * ER-21 (Paston): the house brings its old papers to the suit — each of these with this chance, permille (seed draw).
 * Without them its claim (inheritance 60) never passes the lord's defence (title 60 + hold 20); with a charter, or a deed
 * and witnesses, it does — about half its suits. Game estimate.
 */
export const RECOVERY_EVIDENCE_PERMILLE = 500;
export const RECOVERY_EVIDENCE: readonly ("charter" | "deed" | "witnesses")[] = ["charter", "deed", "witnesses"];
