// LM-R1: Astra's steward round (docs/qa/steward-20261004, top 10) — B04, the right's restoration when the treasury cannot pay.
import assert from "node:assert/strict";
import test from "node:test";
import { RESTORE_RIGHT_PETITION_ID } from "../src/content/chapterConfig";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { LORDSHIP_BALANCE } from "../src/content/lordshipConfig";
import type { GameState } from "../src/engine/engine.types";
import { initialPolitics } from "../src/engine/politics";
import type { PetitionRecord } from "../src/engine/politics.types";
import { calendarLabel } from "../src/engine/scenarioState";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { petitionCard } from "../src/ui/decisionCard/families/petitionCard";
import { PETITION_ANSWER_COPY as ANSWER, type AnswerWords } from "../src/ui/decisionCard/families/petitionCardCopy.ko";

/** Each answer's own sentences on the card (its first now line, its first later line), by answer. */
function answers(state: GameState): ReadonlyMap<string, readonly string[]> {
  return new Map(petitionCard(state)!.card.choices.map(choice => [choice.id, [choice.now[0]!, ...(choice.later[0] === undefined ? [] : [choice.later[0]])]]));
}
const words = (answer: AnswerWords) => [answer.now[0]!, ...(answer.later[0] === undefined ? [] : [answer.later[0]])];

/** A declined lordship (a right lost to the merchants) with its restoration petition open and `coin` in the treasury. */
function declined(coin: number): { readonly state: GameState; readonly petition: PetitionRecord } {
  const base = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, seed: 1 })!;
  const posted = postLedgerEntries(base, [{ account: "cash", category: "opening_balance", amount: coin - treasuryBalance(base), sourceRefs: [{ type: "scenario", id: "test" }] }]);
  const petition: PetitionRecord = { id: `${RESTORE_RIGHT_PETITION_ID}@${base.tick}`, defId: RESTORE_RIGHT_PETITION_ID, petitioner: "merchants", arrivedTick: base.tick };
  const politics = base.politics ?? initialPolitics(base);
  const state: GameState = { ...base, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger,
    lordship: { house: { order: 1, name: "de Fauconval", heraldrySeed: 1, since: 0 }, pastHouses: [], titleDemoted: true,
      decline: { since: base.tick, cause: "arrears", lost: "tolls", by: "merchants" } },
    politics: { ...politics, petitions: [...politics.petitions, petition] } } as GameState;
  return { state, petition };
}

test("LM-R1 (Astra B04): a restoration the treasury cannot pay says so, how much is missing and when it comes again", () => {
  const { state, petition } = declined(15);
  // DEC-CARD: the card's answers say it from the answer run on the state (the shortfall, and when it comes again).
  const card = answers(state);
  const again = calendarLabel({ ...state, tick: state.tick + LORDSHIP_BALANCE.restoreRetryTicks });
  assert.deepEqual(card.get("accept_with_price"), words(ANSWER.restore_right.short(LORDSHIP_BALANCE.restoreFeeHaggled, 15, again)));
  assert.deepEqual(card.get("accept"), words(ANSWER.restore_right.short(LORDSHIP_BALANCE.restoreFee, 15, again)));
  assert.deepEqual(card.get("refuse"), words(ANSWER.restore_right.refuse(again)));
  // What the card says is what the engine does: nothing paid, nothing restored, the petition again a year later.
  const answered = gameReducer(state, { type: "petition_response", petitionId: petition.id, response: "accept_with_price" });
  assert.equal(treasuryBalance(answered), 15);
  assert.notEqual(answered.lordship!.decline, null);
  assert.equal(answered.lordship!.decline!.petitionFrom, state.tick + LORDSHIP_BALANCE.restoreRetryTicks);
});

test("LM-R1 (Astra B04): with the price in the treasury the answer reads as before and the right comes back", () => {
  const { state, petition } = declined(51);
  const card = answers(state);
  assert.deepEqual(card.get("accept_with_price"), words(ANSWER.restore_right.haggled(calendarLabel({ ...state, tick: state.tick + LORDSHIP_BALANCE.titleReturnTicks }))));
  assert.deepEqual(card.get("accept"), words(ANSWER.restore_right.short(LORDSHIP_BALANCE.restoreFee, 51,
    calendarLabel({ ...state, tick: state.tick + LORDSHIP_BALANCE.restoreRetryTicks }))));
  const answered = gameReducer(state, { type: "petition_response", petitionId: petition.id, response: "accept_with_price" });
  assert.equal(treasuryBalance(answered), 1);
  assert.equal(answered.lordship!.decline, null);
});
