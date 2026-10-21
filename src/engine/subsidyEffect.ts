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
 * the screen says it ("아직 아님 · 1364년부터") and shuts the choice.
 */
export type SubsidyEffect =
  | { readonly kind: 'effective' }
  | { readonly kind: 'not_yet'; readonly reason: 'cloth_time'; readonly fromYear: number | null; readonly fromChapter: number | null };

export function subsidyEffect(state: GameState, kind: BuildingKind): SubsidyEffect {
  if (!CLOTH_OPPORTUNITY_KINDS.includes(kind) || clothTime(state)) return { kind: 'effective' };
  const campaign = scenarioOf(state).mode === 'campaign';
  return { kind: 'not_yet', reason: 'cloth_time',
    fromYear: campaign ? null : PLAGUE_BALANCE.chapterEndYear, fromChapter: campaign ? CHAPTER_THREE.chapter + 1 : null };
}
