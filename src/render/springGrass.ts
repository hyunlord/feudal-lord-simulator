import { RIVERSIDE_ARCHETYPE_ID } from '../content/scenario/archetypes';
import { stateArchetype } from '../engine/archetype';
import type { GameState } from '../engine/engine.types';
import type { SeasonIndex } from './seasonArt';
import { SPRING_WORLD_ART } from './art/springWorldArt';

export type SpringGroundState = Pick<GameState, 'scenarioId' | 'archetypeId'>;

export function riversideSpringGrass(state: SpringGroundState | undefined, season: SeasonIndex): boolean {
  return state !== undefined && season === 0 && stateArchetype(state)?.id === RIVERSIDE_ARCHETYPE_ID;
}

export function springGrassChunkToken(state: SpringGroundState | undefined, season: SeasonIndex): string {
  if (!riversideSpringGrass(state, season)) return '';
  const entry = SPRING_WORLD_ART.select('riverside-grass', 0);
  return `|spring-grass:${entry?.id ?? 'loading'}`;
}

export function springGrassImage(state: SpringGroundState | undefined, season: SeasonIndex): HTMLImageElement | null {
  if (!riversideSpringGrass(state, season)) return null;
  const entry = SPRING_WORLD_ART.select('riverside-grass', 0);
  return entry === null ? null : SPRING_WORLD_ART.image(entry.id);
}
