import { FAMINE_RESPONSE_CHOICES, PETITION_DEFS, type FamineResponseChoice, type PetitionResponse } from "../content/chapterConfig";
import type { GameState } from "../engine/engine.types";
import { recordDecision } from "../engine/history";
import { famineResponse, famineStatus, openPetitions, respondToPetition } from "../engine/politics";
import { DECISION_COPY } from "./decisionCopy.ko";
import type { Wave8ImageId } from "./wave8Art";
import type { Wave16ImageId } from "./wave16Art";

// UI-4 decisions (modals, time stopped): the Great Famine's answer (F0-C1 FC-2) and the merchants' petition (FC-3).
// Each option shows the numbers the engine itself predicts for it (F0-C2 HL-3: `recordDecision` on the state that
// answer would make — the same prediction the history ledger stores when the lord chooses), read, never applied.
type Prediction = Readonly<Record<string, number>>;
export type DecisionOption<C extends string> = Readonly<{ choice: C; label: string; line: string; predicted: string }>;

function predicted(before: GameState, after: GameState, command: { readonly type: string } & Readonly<Record<string, unknown>>): Prediction {
  const recorded = recordDecision(before, after, command);
  return recorded.history?.records.at(-1)?.decision?.predicted ?? {};
}

export type FamineDecisionView = Readonly<{ eventId: string; options: readonly (DecisionOption<FamineResponseChoice> & { readonly illustration: Wave16ImageId })[] }>;

export function famineDecisionView(state: GameState): FamineDecisionView | null {
  const status = famineStatus(state);
  if (status === null || status.choices.length === 0) return null;
  const now = { population: state.population, treasury: state.treasuryCoin };
  return {
    eventId: status.eventId,
    options: FAMINE_RESPONSE_CHOICES.filter(choice => status.choices.includes(choice)).map(choice => ({
      choice, label: DECISION_COPY.famine[choice].label, line: DECISION_COPY.famine[choice].line, illustration: `decision_${choice}` as Wave16ImageId,
      predicted: DECISION_COPY.predicted(now, predicted(state, famineResponse(state, choice), { type: "famine_response", choice })),
    })),
  };
}

export type PetitionDecisionView = Readonly<{ petitionId: string; options: readonly (DecisionOption<PetitionResponse> & { readonly seal: Wave8ImageId })[] }>;
const SEALS: Readonly<Record<PetitionResponse, Wave8ImageId>> = { accept: "seal_petition_accept", accept_with_price: "seal_petition_price", refuse: "seal_petition_reject" };
const ORDER: readonly PetitionResponse[] = ["accept", "accept_with_price", "refuse"];

export function petitionDecisionView(state: GameState): PetitionDecisionView | null {
  const petition = openPetitions(state)[0];
  if (petition === undefined) return null;
  const def = PETITION_DEFS.find(candidate => candidate.id === petition.defId) ?? PETITION_DEFS[0]!;
  const now = { treasury: state.treasuryCoin, merchantGauge: state.politics?.merchantGauge ?? 50 };
  return {
    petitionId: petition.id,
    options: ORDER.map(response => ({
      response, choice: response, label: DECISION_COPY.petition[response].label, seal: SEALS[response],
      line: DECISION_COPY.petition[response].line(def.outcomes[response].stallFeePermille, def.outcomes[response].charterFee),
      predicted: DECISION_COPY.predicted(now, predicted(state, respondToPetition(state, petition.id, response), { type: "petition_response", petitionId: petition.id, response })),
    })),
  };
}
