import { LEGACY_BALANCE } from "../content/legacyConfig";
import type { GameState } from "../engine/engine.types";
import { legacyForecast } from "../engine/legacy";
import { stateCalendar } from "../engine/scenarioState";
import { CHAPTER_COPY } from "./chapterCopy.ko";

/**
 * UI-10 (F5-A LG-1 / LG-8): chapter 5's goal line on the goal rail while the legacy waits — the steps come of the
 * eight (`legacyForecast`) and the years left to the last market day (the summer of 1450), as chapter 3's
 * `resettledProgress` shows its recovery.
 */
export function legacyGoalProgress(state: GameState): { readonly steps: number; readonly total: number; readonly years: number; readonly line: string } {
  const forecast = legacyForecast(state);
  const steps = forecast.filter(step => step.state === "done").length;
  const years = Math.max(0, LEGACY_BALANCE.lastMarketYear - stateCalendar(state).year);
  const total = forecast.length === 0 ? 8 : forecast.length;
  return { steps, total, years, line: CHAPTER_COPY.legacyProgress(steps, total, years) };
}
