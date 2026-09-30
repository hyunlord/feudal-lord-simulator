import { FAMINE_RESPONSE_CHOICES, PETITION_DEFS, type FamineResponseChoice, type PetitionResponse } from "../content/chapterConfig";
import { HEIR_CHOICE_PETITION_ID, LEGACY_PETITION_IDS } from "../content/legacyConfig";
import { PLAGUE_PETITION_IDS } from "../content/plagueConfig";
import { REORGANISATION_PETITION_IDS } from "../content/reorganisationConfig";
import type { GameState } from "../engine/engine.types";
import { recordDecision } from "../engine/history";
import { legacyDecisionForecast } from "../engine/legacy";
import { plagueDecisionForecast } from "../engine/plague";
import { reorganisationDecisionForecast } from "../engine/reorganisation";
import { WAR_PETITION_IDS } from "../content/warConfig";
import { warDecisionForecast } from "../engine/war";
import { treasuryBalance } from "../ledger/ledger";
import { famineResponse, famineStatus, openPetitions, respondToPetition } from "../engine/politics";
import { DECISION_COPY } from "./decisionCopy.ko";
import { heirCandidateViews, type HeirCandidateView } from "./heirCandidateModel";
import { petitionPresentation, type PetitionPresentation } from "./petitionPresentation";
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

export type PetitionDecisionView = Readonly<{ petitionId: string; presentation: PetitionPresentation;
  /** UI-10: `heir` — on the heir's card (LG-3), the candidate the answer names. */
  options: readonly (DecisionOption<PetitionResponse> & { readonly seal: Wave8ImageId; readonly heir?: HeirCandidateView })[] }>;
const SEALS: Readonly<Record<PetitionResponse, Wave8ImageId>> = { accept: "seal_petition_accept", accept_with_price: "seal_petition_price", refuse: "seal_petition_reject" };
const ORDER: readonly PetitionResponse[] = ["accept", "accept_with_price", "refuse"];

/**
 * UI-6: the open petition as its kind presents it (`petitionPresentation`: scene, title, demand, who, each answer's line).
 * UI-8: the four plague petitions (F3-A PL-5…PL-8) use `plagueDecisionForecast` for their treasury prediction, and
 * show only the two answers the def offers (`PetitionDef.responses`) — ORDER is filtered accordingly.
 * UI-10 (LG-3): the answers are those the record allows (`PetitionRecord.options`, the heir's card: the heirs there are),
 * else the def's, else all three; chapter 5's and the interlude's predict with `legacyDecisionForecast`.
 */
export function petitionDecisionView(state: GameState): PetitionDecisionView | null {
  const petition = openPetitions(state)[0];
  if (petition === undefined) return null;
  const presentation = petitionPresentation(state, petition);
  const now = { treasury: state.treasuryCoin, merchantGauge: state.politics?.merchantGauge ?? 50 };
  // UI-6: the war's demands (F2-A) predict the treasury two seasons on with the rules' own forecast (HL-3
  // `warDecisionForecast`); the decision record keeps no metric for them.
  const war = (WAR_PETITION_IDS as readonly string[]).includes(petition.defId);
  const plague = !war && (PLAGUE_PETITION_IDS as readonly string[]).includes(petition.defId);
  const reorg = !war && !plague && (REORGANISATION_PETITION_IDS as readonly string[]).includes(petition.defId);
  const legacy = (LEGACY_PETITION_IDS as readonly string[]).includes(petition.defId);
  const allowed = petition.options ?? PETITION_DEFS.find(def => def.id === petition.defId)?.responses ?? ORDER;
  const heirs = petition.defId === HEIR_CHOICE_PETITION_ID ? heirCandidateViews(state) : undefined;
  const warNow = { treasury: treasuryBalance(state) };
  return {
    petitionId: petition.id,
    presentation,
    options: ORDER
      .filter(response => allowed.includes(response))
      .map(response => {
        const heir = heirs?.get(response);
        return {
          response, choice: response, label: presentation.label(response), seal: SEALS[response], line: presentation.line(response), ...(heir === undefined ? {} : { heir }),
          predicted: war ? DECISION_COPY.predicted(warNow, { treasury: warDecisionForecast(state, petition.defId, response) })
            : plague ? DECISION_COPY.predicted(warNow, { treasury: plagueDecisionForecast(state, petition.defId, response) })
            : reorg ? DECISION_COPY.predicted(warNow, { treasury: reorganisationDecisionForecast(state, petition.defId, response) })
            : legacy ? DECISION_COPY.predicted(warNow, { treasury: legacyDecisionForecast(state, petition.defId, response) })
            : DECISION_COPY.predicted(now, predicted(state, respondToPetition(state, petition.id, response), { type: "petition_response", petitionId: petition.id, response })),
        };
      }),
  };
}
