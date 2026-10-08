/**
 * SUIT-THREAD (decision DTR-20; the user's instruction 2026-10-08): what the lord possesses of an estate he does not hold
 * whole — a piece a judgment put in his hands, or the estate's possession without its title — yields him its rent each
 * season: a quarter of its year's worth (a ruling's scope takes its share, ER-8). Before it, a judgment enforced on a
 * neighbour's piece changed the possessor and nothing more: the rent stayed with no one. Lord mode only; the estates the
 * lord holds whole keep their own season (`estateSeason`, the steward's accounts).
 */
import { postLedgerEntries } from "../ledger/ledger";
import type { LedgerPosting } from "../ledger/ledger.types";
import type { GameState } from "./engine.types";
import { estatesOf, LORD } from "./estates";
import type { RightPiece } from "./estates.types";

/** The ledger's mark on a possession's rent: the piece (or the estate) it came from. */
export const POSSESSION_RENT_DETAIL = "possession";

const scoped = (piece: RightPiece) => piece.scope === undefined ? piece.annualValue : Math.round(piece.annualValue * piece.scope.sharePermille / 1000);

/** The season's rent of what the lord possesses without holding the estate whole (the caller runs it at a season's start). */
export function possessionRentSeason(state: GameState): GameState {
  if (state.agency === undefined || state.estates === undefined) return state;
  const postings: LedgerPosting[] = [];
  for (const estate of estatesOf(state).estates) {
    if (!estate.offMap || (estate.titleHolder === LORD && estate.possessor === LORD)) continue;
    const take = (id: string, year: number) => {
      const amount = Math.round(year / 4);
      if (amount > 0) postings.push({ account: "cash", category: "estate_income", amount,
        sourceRefs: [{ type: "actor", id: `estate:${estate.id}` }, { type: "right", id, detail: POSSESSION_RENT_DETAIL }] });
    };
    if (estate.possessor === LORD) take(estate.id, estate.annualValue);
    else for (const piece of estate.pieces) if (piece.possessor === LORD) take(piece.id, scoped(piece));
  }
  if (postings.length === 0) return state;
  const posted = postLedgerEntries(state, postings);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}
