/**
 * UI-10: the six answer sets of scenario L9 (tests/chapterFiveLegacy.test.ts) — the same chapter-5 town ended six ways,
 * one per ending — and the run through chapter 5 step by step that L9 uses (the calendar moved to each step's tick,
 * the answers given as the game command). Shared by the ending screens' tests and scripts/ui10EndingSaves.ts.
 */
import type { PetitionResponse } from "../../src/content/chapterConfig";
import {
  BOROUGH_AUTONOMY_PETITION_ID,
  CHURCH_REBUILDING_PETITION_ID,
  HEIR_CHOICE_PETITION_ID,
  LEGACY_CHOICE_PETITION_ID,
  LEGACY_STEP_IDS,
  ROYAL_TAX_PETITION_ID,
  type LegacyEndingId,
} from "../../src/content/legacyConfig";
import type { GameState } from "../../src/engine/engine.types";
import { legacyForecast } from "../../src/engine/legacy";
import { movedTo, runAnswering } from "./legacyTown";

const SEASON = 1000;
export type LegacyAnswers = Partial<Record<string, PetitionResponse>>;

const STANDARD: LegacyAnswers = { [ROYAL_TAX_PETITION_ID]: "accept", [HEIR_CHOICE_PETITION_ID]: "refuse", [BOROUGH_AUTONOMY_PETITION_ID]: "accept", [LEGACY_CHOICE_PETITION_ID]: "accept" };

/** L9's answer sets, by the ending each one reaches. */
export const LEGACY_ENDING_ANSWERS: Readonly<Record<LegacyEndingId, LegacyAnswers>> = {
  free_borough: STANDARD,
  house_remembered: { ...STANDARD, [LEGACY_CHOICE_PETITION_ID]: "accept_with_price" },
  // FIX-11 (FX11-2): with the death table's tail the refused legacy's church score passed the town's (a 74–74 tie
  // before); the chantry is the town left without a chosen legacy (as chapterFiveLegacy L9).
  merchants_chantry: { ...STANDARD, [LEGACY_CHOICE_PETITION_ID]: undefined, [CHURCH_REBUILDING_PETITION_ID]: "refuse" },
  house_seat: { ...STANDARD, [BOROUGH_AUTONOMY_PETITION_ID]: "refuse", [LEGACY_CHOICE_PETITION_ID]: "accept_with_price" },
  pilgrim_town: { ...STANDARD, [BOROUGH_AUTONOMY_PETITION_ID]: "refuse", [LEGACY_CHOICE_PETITION_ID]: "refuse", [CHURCH_REBUILDING_PETITION_ID]: "accept" },
  lords_town: { [ROYAL_TAX_PETITION_ID]: "refuse", [HEIR_CHOICE_PETITION_ID]: "refuse", [BOROUGH_AUTONOMY_PETITION_ID]: "refuse", [CHURCH_REBUILDING_PETITION_ID]: "refuse" },
};

/** Runs chapter 5 step by step, answering; stops once `until` has come (L9's `through`). */
export function throughLegacy(state: GameState, answers: LegacyAnswers, until: (typeof LEGACY_STEP_IDS)[number] = "last_market"): GameState {
  let next = state;
  for (let guard = 0; guard < 40 && next.legacy?.steps[until] === undefined; guard += 1) {
    const step = legacyForecast(next).find(entry => entry.state !== "done");
    if (step === undefined) break;
    const target = step.tick !== null && step.tick > next.tick ? step.tick : (Math.floor(next.tick / SEASON) + 1) * SEASON;
    if (target > next.tick + 1) next = movedTo(next, target);
    next = runAnswering(next, target + 1, answers);
  }
  return next;
}
