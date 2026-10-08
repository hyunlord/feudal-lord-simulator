/**
 * SUIT-THREAD (decision DTR-20; the user's instruction 2026-10-08): what the lord possesses of an estate he does not hold
 * whole — a piece a judgment put in his hands, or the estate's possession without its title — yields him its rent each
 * season: a quarter of its year's worth (a ruling's scope takes its share, ER-8). Before it, a judgment enforced on a
 * neighbour's piece changed the possessor and nothing more: the rent stayed with no one. Lord mode only; the estates the
 * lord holds whole keep their own season (`estateSeason`, the steward's accounts).
 * DTR-21 (A6, the user's judgement): while its title holder disputes it the tenants hold back half, and a keeper takes a
 * small share (less while the lord oversees an estate himself) — going to law is worth it, not always a gain.
 */
import { POSSESSION_RENT } from "../content/possessionConfig";
import { postLedgerEntries } from "../ledger/ledger";
import type { LedgerPosting } from "../ledger/ledger.types";
import type { GameState } from "./engine.types";
import { estatesOf, LORD } from "./estates";
import type { RightPiece } from "./estates.types";

/** The ledger's mark on a possession's rent: the piece (or the estate) it came from. */
export const POSSESSION_RENT_DETAIL = "possession";

const scoped = (piece: RightPiece) => piece.scope === undefined ? piece.annualValue : Math.round(piece.annualValue * piece.scope.sharePermille / 1000);

/** One possession's season: its gross quarter, what the tenants hold back while it is disputed, the keeper's share, the net. */
export interface PossessionRentLine {
  readonly estateId: string;
  readonly pieceId: string;
  readonly gross: number;
  readonly withheld: number;
  readonly keeper: number;
  readonly net: number;
  readonly contested: boolean;
}

/** DTR-20, DTR-21: what the lord's possessions pay this season (pure; the season posts the nets). */
export function possessionRentLines(state: GameState): readonly PossessionRentLine[] {
  if (state.agency === undefined || state.estates === undefined) return [];
  const estates = estatesOf(state);
  const direct = (state.stewardship?.oversight ?? []).some(entry => entry.mode === "direct");
  const keeperPermille = direct ? POSSESSION_RENT.keeperDirectPermille : POSSESSION_RENT.keeperPermille;
  const lines: PossessionRentLine[] = [];
  for (const estate of estates.estates) {
    if (!estate.offMap || (estate.titleHolder === LORD && estate.possessor === LORD)) continue;
    const take = (pieceId: string, year: number, claimPiece?: string) => {
      const gross = Math.round(year / 4);
      if (gross <= 0) return;
      // Disputed: a claim or suit of another's on it (or the whole estate) stands open.
      const contested = estates.claims.some(claim => claim.claimant !== LORD && claim.estateId === estate.id
        && (claim.pieceId === undefined || claim.pieceId === claimPiece) && (claim.status === "open" || claim.status === "suing"));
      const withheld = contested ? Math.round(gross * POSSESSION_RENT.contestedWithheldPermille / 1000) : 0;
      const keeper = Math.round((gross - withheld) * keeperPermille / 1000);
      lines.push({ estateId: estate.id, pieceId, gross, withheld, keeper, net: gross - withheld - keeper, contested });
    };
    if (estate.possessor === LORD) take(estate.id, estate.annualValue);
    else for (const piece of estate.pieces) if (piece.possessor === LORD) take(piece.id, scoped(piece), piece.id);
  }
  return lines;
}

/** The season's rent of what the lord possesses without holding the estate whole (the caller runs it at a season's start). */
export function possessionRentSeason(state: GameState): GameState {
  const postings: LedgerPosting[] = possessionRentLines(state).filter(line => line.net > 0).map(line => ({ account: "cash" as const, category: "estate_income" as const,
    amount: line.net, sourceRefs: [{ type: "actor" as const, id: `estate:${line.estateId}` }, { type: "right" as const, id: line.pieceId, detail: POSSESSION_RENT_DETAIL }] }));
  if (postings.length === 0) return state;
  const posted = postLedgerEntries(state, postings);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}
