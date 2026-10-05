import { mix, type Rect } from './weatherPlacement';

export type ParticleLattice = { readonly cell: number; readonly interval: number; readonly maxLife: number; readonly overscan: number; readonly domain: number };
/** The camera selects cells only; birth identity and time remain fixed in world space. */
export function* worldParticleBirths(seed: number, seconds: number, view: Rect, lattice: ParticleLattice) {
  const { cell, interval, maxLife, overscan, domain } = lattice;
  const birth = Math.floor(seconds / interval);
  for (let cy = Math.floor((view.y - overscan) / cell); cy <= Math.floor((view.y + view.height + overscan) / cell); cy += 1) {
    for (let cx = Math.floor((view.x - overscan) / cell); cx <= Math.floor((view.x + view.width + overscan) / cell); cx += 1) {
      for (let step = birth - Math.ceil(maxLife / interval) - 1; step <= birth; step += 1) {
        const hash = mix(seed, cx, cy, step, domain);
        const born = step * interval + (hash % 1000) / 1000 * interval;
        yield { id: `${cx}:${cy}:${step}`, hash, age: seconds - born, x: cx * cell + hash % cell, y: cy * cell + (hash >>> 6) % cell };
      }
    }
  }
}
