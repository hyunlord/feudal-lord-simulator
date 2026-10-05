import { createFootprintGroundSupport, dryRoadAt } from './snowFootprintSupport';
import type { Walker } from '../agents/walker.types';
import type { GameState } from '../engine/engine.types';
import { walkerVisualAnchor } from './walkerAnchor';
import { groundWinterAlpha } from './seasonProgression';
import { calendarProgress } from './calendarProgress';
import { SNOW_FOOTPRINTS as rules, SNOW_FOOTPRINTS_VALID } from './snowProgressionProfiles';

export type ObservedFootprint = { readonly walkerId: string; readonly x: number; readonly y: number; readonly tick: number };
type Sample = { readonly x: number; readonly y: number };
/** Bounded observation history, not a cache or reconstructed past. Loading starts with no tracks. */
export function createSnowFootprintHistory() {
  let previous: GameState | null = null;
  const trails = new Map<string, Sample[]>();
  let prints: ObservedFootprint[] = [];
  const clear = () => { trails.clear(); prints = []; };
  const observe = (state: GameState, walkers: readonly Walker[]): readonly ObservedFootprint[] => {
    if (!SNOW_FOOTPRINTS_VALID) { clear(); return prints; }
    const reset = previous === null || previous.tiles !== state.tiles || previous.seed !== state.seed || previous.scenarioId !== state.scenarioId || state.tick < previous.tick || state.tick > previous.tick + 1 || state.tick === previous.tick && state !== previous;
    if (reset) clear();
    const advancing = previous !== null && state.tick > previous.tick;
    previous = state;
    if (calendarProgress(state).season !== 3) { clear(); return prints; }
    if (!advancing || reset) return prints;
    prints = prints.filter(print => state.tick - print.tick <= rules.lifeTicks);
    const active = new Set(walkers.slice(0, rules.maxWalkers).map(walker => walker.id));
    for (const id of trails.keys()) if (!active.has(id)) trails.delete(id);
    const groundSupports = createFootprintGroundSupport(state);
    for (const walker of walkers.slice(0, rules.maxWalkers)) {
      const anchor = walkerVisualAnchor(walker.position);
      const point = { x: anchor.sx, y: anchor.sy };
      const tx = Math.round(anchor.tx), ty = Math.round(anchor.ty);
      if (!dryRoadAt(state, point) || groundWinterAlpha(state, `tile:${tx}:${ty}`, 'drift') < rules.minAccumulation) { trails.delete(walker.id); continue; }
      const trail = trails.get(walker.id) ?? [];
      const last = trail.at(-1);
      if (last !== undefined && Math.hypot(point.x - last.x, point.y - last.y) > rules.maxStep) {
        trails.delete(walker.id); prints = prints.filter(print => print.walkerId !== walker.id); continue;
      }
      if (last !== undefined && Math.hypot(point.x - last.x, point.y - last.y) < rules.minStep) continue;
      trail.push(point); if (trail.length > rules.maxSamples) trail.shift(); trails.set(walker.id, trail);
      const first = trail[0];
      if (first === undefined || Math.abs(point.x - first.x) < rules.stripLength) continue;
      // These full canvases run down-right. Other directions and bends have no matching authored strip.
      const direction = Math.sign(point.x - first.x);
      const supported = trail.every((sample, i) => {
        const prior = trail[i - 1];
        return Math.abs(sample.y - first.y - (sample.x - first.x) * rules.slope) <= rules.tolerance
          && (i === 0 || prior !== undefined && direction * (sample.x - prior.x) > 0);
      });
      const stamp = { x: (first.x + point.x) / 2, y: (first.y + point.y) / 2 };
      if (supported && groundSupports(stamp)) {
        prints.push({ walkerId: walker.id, ...stamp, tick: state.tick });
        if (prints.length > rules.maxPrints) prints.shift();
      }
      trails.set(walker.id, [point]);
    }
    return prints;
  };
  return { observe, reset: () => { previous = null; clear(); }, counts: () => ({ walkers: trails.size, samples: [...trails.values()].reduce((sum, t) => sum + t.length, 0), prints: prints.length }) };
}
