import type { BuildingKind } from '../content/buildingConfig';
import { CHAPTER_THREE } from '../content/chapterConfig';
import { PLAGUE_BALANCE } from '../content/plagueConfig';
import { CLOTH_OPPORTUNITY_KINDS } from '../content/townAgencyConfig';
import { clothTime } from './autoplayCloth';
import type { GameState } from './engine.types';
import { scenarioOf } from './scenarioState';

/**
 * SUBSIDY-CLOTH (the user's ruling 2026-10-21): whether a subsidy on this kind would do anything now. Before the cloth's
 * time (`clothTime`, CL7: 1364 in the sandbox and lord mode, after chapter 3 in the campaign) the town proposes no cloth
 * building as an opportunity (CLOTH1-1), so a subsidy on one of the four starts and pays nothing. A code, not words —
 * the screen makes its words from `from` ("아직 아님 · 1364년부터" / "4장부터") and shuts the choice.
 */
export type SubsidyEffectFrom = { readonly year: number } | { readonly chapter: number };
export type SubsidyEffect =
  | { readonly effect: 'effective' }
  | { readonly effect: 'not_yet'; readonly reason: 'cloth_time'; readonly from: SubsidyEffectFrom };

/** `from`: when the subsidy starts to work — the year (lord mode, the sandbox) or the chapter (the campaign). */
export function subsidyEffect(state: GameState, kind: BuildingKind): SubsidyEffect {
  if (!CLOTH_OPPORTUNITY_KINDS.includes(kind) || clothTime(state)) return { effect: 'effective' };
  const from: SubsidyEffectFrom = scenarioOf(state).mode === 'campaign'
    ? { chapter: CHAPTER_THREE.chapter + 1 } : { year: PLAGUE_BALANCE.chapterEndYear };
  return { effect: 'not_yet', reason: 'cloth_time', from };
}
