import type { GameState } from "../../../engine/engine.types";
import { treasuryBalance } from "../../../ledger/ledger";
import { calendarDays } from "../../gameTimeCopy.ko";
import { HOME_PETITION_COPY } from "../../lordCardsCopy.ko";
import { courtLine, openHomePetitions, parties, settledHomeAnswer } from "../../lordCardsModel";
import { perState } from "../../perState";
import { HOME_PETITION_ART } from "../../wave44Art";
import type { DecisionCardView, DecisionChoiceView } from "../decisionCardTypes";
import { afterAnswer, remembersOf } from "../remembers";
import { HOME_PETITION_CARD_COPY as COPY, HOME_PETITION_STAKE } from "./homePetitionCopy.ko";

// DEC-CARD, the home estate's petition (LM-R1 FIX-14): the petition's own words as the situation, its kind's stake,
// and each answer from the engine — the answer run on the state: the treasury's change and the factions it moves
// (recordDecision's faction.relation records). The precedent line is the steward's rule as it stands (LM9-3).
// Once per state (`perState`): the chips read `homePetitionView`, this only the card that is up.

const money = (pennies: number): string => pennies > 0 ? COPY.treasuryIn(pennies) : pennies < 0 ? COPY.treasuryOut(-pennies) : COPY.treasurySame;

export const homePetitionCard = perState((state: GameState): DecisionCardView | null => {
  const petition = openHomePetitions(state)[0];
  if (petition === undefined) return null;
  const copy = HOME_PETITION_COPY[petition.kind];
  const named = parties(state, petition);
  const settled = settledHomeAnswer(state, petition.kind);
  const choice = (grant: boolean): DecisionChoiceView => {
    const after = afterAnswer(state, { type: "answer_estate_petition", petitionId: petition.id, grant });
    const label = grant ? copy.grant(named) : copy.refuse(named);
    return {
      id: grant ? "grant" : "refuse", label,
      now: after === null ? [] : [money(treasuryBalance(after) - treasuryBalance(state))],
      later: [settled === null ? COPY.precedent : COPY.settled(settled ? copy.grant(named) : copy.refuse(named))],
      remembers: remembersOf(state, after), refusal: after === null ? COPY.refused : null,
    };
  };
  return {
    family: "home_petition", subjectId: petition.id, title: copy.title, court: courtLine(state), from: COPY.from,
    situation: copy.demand(petition.amount, named), stake: HOME_PETITION_STAKE[petition.kind](petition.amount, named),
    deadline: COPY.deadline(calendarDays(petition.deadline - state.tick)), illustration: HOME_PETITION_ART[petition.kind],
    choices: [choice(true), choice(false)],
  };
});
