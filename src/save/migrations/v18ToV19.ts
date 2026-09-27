import { CHAPTER_ONE, CHAPTER_TWO } from "../../content/chapterConfig";
import { scenarioById } from "../../content/scenario/registry";
import type { GameState } from "../../engine/engine.types";

/**
 * v19 adds FAIL-3's lordship (spec `docs/design/failure-ladder-campaign.md`, FL-1…FL-10): `GameState.lordship` (the
 * lord's house, lost rights, title demotion, decline), the `overlord` petitioner and the `restore_right` petition. A v18
 * town has the first house, holds every right and is not declining — `lordship` stays absent, which means exactly that.
 * A v18 campaign town whose chapter 1 had ended (FC-5) opens in chapter 2, begun at that end's tick (FL-8).
 */
export function migrateStateV18ToV19<T extends GameState>(state: T): T {
  const politics = state.politics;
  const end = politics?.chapterEnds.find(entry => entry.chapter === CHAPTER_ONE.chapter);
  if (politics === undefined || end === undefined || politics.chapter.number !== CHAPTER_ONE.chapter) return state;
  // A save naming an unknown scenario is refused after migration with its own message; leave its chapter alone.
  let campaign = false;
  try { campaign = scenarioById(state.scenarioId).mode === "campaign"; } catch { return state; }
  if (!campaign) return state;
  const populationStart = end.chronicle?.stats?.populationEnd ?? state.population;
  return { ...state, politics: { ...politics, chapter: { number: CHAPTER_TWO.chapter, startTick: end.tick, populationStart,
    peakPopulation: Math.max(populationStart, state.population) } } };
}

export function migrateV18ToV19(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v18 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v18 save has no state");
  return { ...envelope, schemaVersion: 19, state: migrateStateV18ToV19(envelope.state as GameState) };
}
