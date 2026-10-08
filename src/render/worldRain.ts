import type { GameState } from '../engine/engine.types';
import { calendarProgress } from './calendarProgress';
import { NATURE_ART } from './art/natureArt';
import type { Rect } from './weatherPlacement';
import { worldRainParticles } from './worldRainModel';

/** True means the new complete family owns this frame, including intentionally empty rain. */
export function drawWorldRain(context: CanvasRenderingContext2D, state: GameState, view: Rect, zoom: number, intensity: number): boolean {
  const family = NATURE_ART.resolve('rain');
  if (family === null) return false;
  const seconds = calendarProgress(state).seconds;
  for (const particle of worldRainParticles({ seed: state.seed, seconds, intensity }, view)) {
    const ready = NATURE_ART.select(family, 'rain', particle.preferStrong ? 'strong' : 'faint', particle.variant);
    if (ready !== null) NATURE_ART.draw(context, ready, particle.x, particle.y, zoom, particle.strength, seconds);
  }
  return true;
}
