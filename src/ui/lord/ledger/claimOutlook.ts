import type { GameState } from "../../../engine/engine.types";
import { estatesOf } from "../../../engine/estates";
import { suitHearing } from "../../../engine/estateSuits";
import { treasuryBalance } from "../../../ledger/ledger";
import { gameReducer } from "../../../state/gameStore";

// PLAY-2 (Astra's second lord-mode play, 2026-10-08: "소송 걸기" said nothing of what it costs or how the claim stands):
// what filing a claim would do, read off the game's own command tried on the current state (the button's `file_suit`;
// a refused command hands back the same state) — the treasury it takes and the hearing's two sides the engine gives for
// the new suit (`suitHearing`). No cost or weight is read from estateConfig and no rule of the hearing is copied (P-D4):
// a refused filing (the treasury short) says nothing of its cost; the line says which side is larger now (the user's
// rule, ledgerCopy `sidesNow`), not who wins (docs/requests/engine-play2-reads.md).

export type ClaimOutlook = Readonly<{
  /** The pennies filing takes from the treasury now. */
  cost: number;
  /** The hearing's two sides for the suit filed now (null when the engine gives none). */
  sides: Readonly<{ plaintiff: number; defence: number }> | null;
}>;

/** What filing this claim would do now, or null when the game would refuse it. */
export function claimOutlook(state: GameState, claimId: string): ClaimOutlook | null {
  const after = gameReducer(state, { type: "file_suit", claimId });
  if (after === state) return null;
  const before = new Set(estatesOf(state).suits.map(suit => suit.id));
  const suit = estatesOf(after).suits.find(entry => entry.claimId === claimId && !before.has(entry.id));
  return { cost: treasuryBalance(state) - treasuryBalance(after), sides: suit === undefined ? null : suitHearing(after, suit.id) };
}
