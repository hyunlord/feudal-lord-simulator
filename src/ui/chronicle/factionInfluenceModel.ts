// UI-9: pure model for chapter 4 faction influence bars (RG-4), the tug-of-war strip (RG-4) and the revolt
// pressure table (RG-8); rendered in FactionTab and FactionPage (commons), as well as the ledger rights tab.
import type { GameState } from "../../engine/engine.types";
import { factionInfluence, revoltPressure } from "../../engine/reorganisation";
import { FACTION_INFLUENCE_COPY as COPY } from "./factionInfluenceCopy.ko";

/** RG-4: tug-of-war between the town/merchant side and the lords' side (null before chapter 4). */
export interface TugOfWarView {
  readonly townSum: number;
  readonly merchantSum: number;
  readonly warningActive: boolean;
  readonly townSideLabel: string;
  readonly lordSideLabel: string;
  readonly warningLine: string;
  readonly warningActiveLabel: string;
}

/** RG-8: one cause line in the revolt pressure table. */
export interface PressureCauseLine {
  readonly key: string;
  readonly line: string;
}

/** RG-8: the revolt pressure section (null before chapter 4). */
export interface RevoltPressureSection {
  readonly total: number;
  readonly totalLabel: string;
  readonly thresholdLine: string;
  readonly causes: readonly PressureCauseLine[];
  readonly outcome: string | null;
}

/** RG-4: the tug-of-war view, or null before chapter 4. */
export function tugOfWarView(state: GameState): TugOfWarView | null {
  if (state.reorganisation === undefined) return null;
  const town = factionInfluence(state, "town") ?? 0;
  const m1 = factionInfluence(state, "merchant_house_1") ?? 0;
  const m2 = factionInfluence(state, "merchant_house_2") ?? 0;
  const warningActive = state.reorganisation.warningTick !== undefined;
  return {
    townSum: town, merchantSum: m1 + m2, warningActive,
    townSideLabel: COPY.townSide, lordSideLabel: COPY.lordSide,
    warningLine: COPY.warningLine, warningActiveLabel: COPY.warningActive,
  };
}

/** RG-8: the revolt pressure section, or null before chapter 4. */
export function revoltPressureSection(state: GameState): RevoltPressureSection | null {
  if (state.reorganisation === undefined) return null;
  const { total, causes } = revoltPressure(state);
  const outcome = state.reorganisation.rebellion === undefined ? null
    : state.reorganisation.rebellion.outcome === "chased" ? COPY.outcomeChased : COPY.outcomeQuiet;
  return {
    total, totalLabel: COPY.pressureTotal(total),
    thresholdLine: COPY.pressureThreshold,
    causes: causes.map(c => ({ key: c.id, line: COPY.causeLine(COPY.causeNames[c.id] ?? c.id, c.pressure) })),
    outcome,
  };
}
