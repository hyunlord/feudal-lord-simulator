import type { GameState } from "../engine/engine.types";
import { HOUSE_ALE_COPY } from "./houseAleCopy.ko";
import { buildingCauseSnapshot, progressClock, type HouseProgressModel } from "./houseProgressModel";

// INSTALL-3 (AL-6, decision AL11): what the ale rule does to a house's rise, in words. The numbers are the engine's
// (`aleRequired`, `aleServedHouses`, `aleHoldTicks` through houseProgressModel); nothing here re-decides the rule.

/** The card's progress line about ale; null when ale asks nothing of the next rise. */
export function houseAleProgressLine(progress: HouseProgressModel): string | null {
  const ale = progress.ale;
  if (ale === undefined || progress.nextLevel === null) return null;
  if (ale.served) return HOUSE_ALE_COPY.served;
  const hold = progressClock(ale.holdTicks), base = progressClock(ale.baseTicks);
  return progress.status === "ready" ? HOUSE_ALE_COPY.unservedReady(progress.nextLevel, hold, base) : HOUSE_ALE_COPY.unserved(progress.nextLevel, hold, base);
}

/** The house's ale condition for the development list; null before chapter 2 or when the next rise does not ask it. */
export function houseAleCondition(progress: HouseProgressModel | null): { readonly served: boolean; readonly label: string } | null {
  const ale = progress?.ale;
  if (progress === null || ale === undefined || progress.nextLevel === null) return null;
  return ale.served ? { served: true, label: HOUSE_ALE_COPY.conditionServed }
    : { served: false, label: HOUSE_ALE_COPY.conditionUnserved(progress.nextLevel, progressClock(ale.holdTicks), progressClock(ale.baseTicks)) };
}

/** Houses holding their conditions toward a rise that the want of ale lengthens now. */
export function housesWaitingForAle(state: GameState): number {
  let count = 0;
  for (const model of buildingCauseSnapshot(state).values()) {
    if ("currentLevel" in model && model.status === "ready" && model.ale !== undefined && !model.ale.served) count += 1;
  }
  return count;
}

/** The season card's cause line (null when no house waits for ale). */
export function seasonAleCause(state: GameState): string | null {
  const houses = housesWaitingForAle(state);
  return houses === 0 ? null : HOUSE_ALE_COPY.seasonWaiting(houses);
}
