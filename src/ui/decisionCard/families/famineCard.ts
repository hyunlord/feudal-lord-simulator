import { FAMINE_RESPONSE_CHOICES, FAMINE_RESPONSE_CONFIG, type FamineResponseChoice } from "../../../content/chapterConfig";
import type { GameState } from "../../../engine/engine.types";
import { famineShortHouses } from "../../../engine/eventSchedule";
import { famineStatus } from "../../../engine/politics";
import { calendarLabel } from "../../../engine/scenarioState";
import { treasuryBalance } from "../../../ledger/ledger";
import { foodDays } from "../../hud/statusPillModel";
import { courtLine } from "../../lordCardsModel";
import { perState } from "../../perState";
import { DECISION_COPY } from "../../decisionCopy.ko";
import type { DecisionCardView, DecisionChoiceView } from "../decisionCardTypes";
import { afterAnswer, remembersOf } from "../remembers";
import { FAMINE_CARD_COPY as COPY } from "./famineCardCopy.ko";

// DEC-CARD, the Great Famine (FC-2): who suffers (the households the price shuts out, `famineShortHouses`), what is at
// stake (the stores' days, the lived-in homes, the treasury, the famine's end), and each answer run on the state
// (`afterAnswer`): its forecast two seasons on and the people that may leave by then (the decision record the engine
// writes, HL-3), when its actual is written, and who remembers it (its faction records). What each answer does every
// season while the famine lasts is FC-2's (the shares in FAMINE_RESPONSE_CONFIG). Once per state (`perState`).

const label = (state: GameState, tick: number) => calendarLabel({ ...state, tick });

const NOW: Readonly<Record<FamineResponseChoice, () => string>> = {
  relief: () => COPY.now.relief(),
  price_control: () => COPY.now.price_control(FAMINE_RESPONSE_CONFIG.priceCapPermille),
  laissez_faire: () => COPY.now.laissez_faire(),
  speculation: () => COPY.now.speculation(FAMINE_RESPONSE_CONFIG.speculationPermille),
};
const EACH_SEASON: Readonly<Record<FamineResponseChoice, string>> = {
  relief: COPY.eachSeason.relief, price_control: COPY.eachSeason.price_control(FAMINE_RESPONSE_CONFIG.priceControlMerchantPerSeason),
  laissez_faire: COPY.eachSeason.laissez_faire, speculation: COPY.eachSeason.speculation,
};

export type FamineCardView = Readonly<{ card: DecisionCardView; eventId: string }>;

export const famineCard = perState((state: GameState): FamineCardView | null => {
  const status = famineStatus(state);
  if (status === null || status.choices.length === 0) return null;
  const lived = state.houses.filter(house => house.residents > 0).length;
  const ends = label(state, status.endTick);
  const known = new Set((state.history?.records ?? []).map(record => record.id));
  const choices = FAMINE_RESPONSE_CHOICES.filter(choice => status.choices.includes(choice)).map((choice): DecisionChoiceView => {
    const option = { choice, label: DECISION_COPY.famine[choice].label };
    const after = afterAnswer(state, { type: "famine_response", choice });
    if (after === null) return { id: option.choice, label: option.label, now: [], later: [], remembers: [], refusal: COPY.refused };
    const decision = (after.history?.records ?? []).find(record => !known.has(record.id) && record.kind === "decision")?.decision;
    const predicted = decision?.predicted;
    const later = [EACH_SEASON[option.choice]];
    if (predicted?.population !== undefined && predicted.treasury !== undefined) {
      later.push(COPY.forecast(predicted.population, state.population, predicted.treasury, treasuryBalance(state)));
      later.push(predicted.population < state.population ? COPY.leaving(state.population - predicted.population) : COPY.nobodyLeaves);
    }
    if (decision?.actualDueTick !== undefined) later.push(COPY.actualDue(label(state, decision.actualDueTick)));
    return { id: option.choice, label: option.label, now: [NOW[option.choice]()], later, remembers: remembersOf(state, after), refusal: null };
  });
  return {
    eventId: status.eventId,
    card: {
      family: "famine", subjectId: status.eventId, title: DECISION_COPY.famineTitle, court: courtLine(state), from: COPY.from,
      situation: COPY.situation(famineShortHouses(state).length, lived), stake: COPY.stake(foodDays(state), lived, treasuryBalance(state), ends),
      deadline: COPY.deadline(ends), illustration: "decision_famine_intro", choices,
    },
  };
});
