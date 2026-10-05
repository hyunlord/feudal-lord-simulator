import type { GameState } from '../engine/engine.types';
import { NATURE_ART } from './art/natureArt';
import { calendarProgress } from './calendarProgress';
import { worldParticleBirths } from './worldParticleBirths';
import type { Rect } from './weatherPlacement';
import { SNOW_MOTION } from './snowProgressionProfiles';

/** Snow uses the same world birth lattice as rain, with authored snow timing and slow drift. */
export function worldSnowParticles(seed: number, seconds: number, view: Rect, blowing = false) {
  const motion = SNOW_MOTION;
  if (motion === null) return [];
  const lattice = blowing ? { cell: motion.bandCell, interval: motion.bandInterval, maxLife: motion.bandLife, overscan: motion.overscan, domain: motion.domain + 1 } : motion;
  const particles = [];
  for (const birth of worldParticleBirths(seed, seconds, view, lattice)) {
    if (birth.age < 0 || birth.age >= lattice.maxLife) continue;
    const x = birth.x + birth.age * (blowing ? motion.bandSpeed : motion.drift);
    const y = birth.y + (blowing ? 0 : birth.age * motion.speed);
    if (x < view.x - 64 || y < view.y - 32 || x > view.x + view.width + 64 || y > view.y + view.height + 32) continue;
    particles.push({ ...birth, x, y, opacity: Math.min(1, birth.age / 0.2, (lattice.maxLife - birth.age) / 0.3) });
  }
  return particles;
}
/** Four ready paintings or one legacy fallback; never mix incomplete families. */
export function drawWorldSnow(context: CanvasRenderingContext2D, state: GameState, view: Rect, zoom: number): boolean {
  if (SNOW_MOTION === null) return false;
  const flakes = NATURE_ART.resolve('snow'), bands = NATURE_ART.resolve('blowing-snow');
  if (flakes === null || bands === null) return false;
  const progress = calendarProgress(state);
  if (progress.season !== 3) return true;
  for (const blowing of [false, true]) {
    if (zoom < (blowing ? 0.6 : 1)) continue;
    const role = blowing ? 'blowing-snow' : 'snow';
    const family = blowing ? bands : flakes;
    for (const particle of worldSnowParticles(state.seed, progress.seconds, view, blowing)) {
      const ready = NATURE_ART.select(family, role, 'all', particle.hash);
      if (ready !== null) NATURE_ART.draw(context, ready, particle.x, particle.y, zoom, particle.opacity, particle.age);
    }
  }
  return true;
}
