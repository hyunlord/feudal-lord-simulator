/**
 * FIX-11 (item 10, FX11-10): a decision card's forecast per answer — the treasury two seasons on and the factions'
 * relation moves — for every chapter's petitions (war, pestilence, reorganisation, legacy). The treasury is each
 * chapter's own forecast (the number the card shows today); the relations are the answer's entry in that chapter's
 * relation table. Render (LM-R1 / the decision card) reads this to show answers that differ in money or in relations.
 */
import { LEGACY_PETITION_IDS, LEGACY_RELATIONS, type LegacyPetitionId } from "../content/legacyConfig";
import { PLAGUE_PETITION_IDS } from "../content/plagueConfig";
import { REORGANISATION_PETITION_IDS } from "../content/reorganisationConfig";
import type { PetitionResponse } from "../content/chapterConfig";
import type { GameState } from "./engine.types";
import { legacyDecisionForecast } from "./legacy";
import { plagueDecisionForecast } from "./plague";
import { reorganisationDecisionForecastRich } from "./reorganisation";
import { treasuryBalance } from "../ledger/ledger";
import { warDecisionForecast } from "./war";
import { WAR_PETITION_IDS } from "../content/warConfig";

export interface DecisionForecast {
  /** The treasury (pennies) two seasons after the answer. */
  readonly treasury: number;
  /** The relation move per faction id the answer makes at once. */
  readonly relations: Readonly<Partial<Record<string, number>>>;
}

const has = (ids: readonly string[], defId: string) => ids.includes(defId);

export function decisionForecast(state: GameState, defId: string, response: PetitionResponse): DecisionForecast {
  if (has(WAR_PETITION_IDS, defId)) return { treasury: warDecisionForecast(state, defId, response), relations: {} };
  if (has(PLAGUE_PETITION_IDS, defId)) return { treasury: plagueDecisionForecast(state, defId, response), relations: {} };
  if (has(REORGANISATION_PETITION_IDS, defId)) return reorganisationDecisionForecastRich(state, defId, response);
  if (has(LEGACY_PETITION_IDS, defId)) {
    return { treasury: legacyDecisionForecast(state, defId, response), relations: LEGACY_RELATIONS[defId as LegacyPetitionId]?.[response] ?? {} };
  }
  return { treasury: treasuryBalance(state), relations: {} };
}
