import type { GameState } from "../../../engine/engine.types";
import { calendarDays } from "../../gameTimeCopy.ko";
import { HOME_PETITION_COPY } from "../../lordCardsCopy.ko";
import { courtLine, homePetitionView, homeStanding, openHomePetitions, parties } from "../../lordCardsModel";
import { perState } from "../../perState";
import { HOME_PETITION_ART } from "../../wave44Art";
import type { DecisionCardView, DecisionChoiceView } from "../decisionCardTypes";
import { outlookLater, outlookOf, outlookRemembers, outlookTreasury } from "../outlook";
import { HOME_PETITION_CARD_COPY as COPY, HOME_PETITION_STAKE } from "./homePetitionCopy.ko";

// DEC-CARD, the home estate's petition (LM-R1 FIX-14): the petition's own words as the situation, its kind's stake,
// and each answer from the engine's outlook (DEC-CARD-2, DC-D7 `answerOutlook`): the treasury's change now, what it sets
// going later, and the factions that remember it. A home petition is lord mode's, so the outlook gives it all — no dry
// run here. Later also says the kind's standing policy: the steward answers it so from now on unless it is set to
// 영주에게 (DTR-1; LM9-3's "the same answer twice" is gone). Once per state (`perState`): the chips read
// `homePetitionView`, this only the card that is up.

const money = (pennies: number): string => pennies > 0 ? COPY.treasuryIn(pennies) : pennies < 0 ? COPY.treasuryOut(-pennies) : COPY.treasurySame;

export const homePetitionCard = perState((state: GameState): DecisionCardView | null => {
  const petition = openHomePetitions(state)[0];
  // The petition's title and words as its chip shows them (ER-13: the canon's variant words when the engine finds them so).
  const head = homePetitionView(state);
  if (petition === undefined || head === null) return null;
  const copy = HOME_PETITION_COPY[petition.kind];
  const named = parties(state, petition);
  const standing = homeStanding(state, petition);
  const choice = (grant: boolean): DecisionChoiceView => {
    const id = grant ? "grant" : "refuse";
    const label = grant ? copy.grant(named) : copy.refuse(named);
    const outlook = outlookOf(state, { type: "answer_estate_petition", petitionId: petition.id, grant });
    if (outlook === null) return { id, label, now: [], later: [], remembers: [], refusal: COPY.refused };
    return { id, label, now: [money(outlookTreasury(outlook))], later: [standing, ...outlookLater(state, outlook)],
      remembers: outlookRemembers(state, outlook), refusal: null };
  };
  return {
    family: "home_petition", subjectId: petition.id, title: head.title, court: courtLine(state), from: COPY.from,
    situation: head.demand, stake: HOME_PETITION_STAKE[petition.kind](petition.amount, named),
    deadline: COPY.deadline(calendarDays(petition.deadline - state.tick)), illustration: HOME_PETITION_ART[petition.kind],
    choices: [choice(true), choice(false)],
  };
});
