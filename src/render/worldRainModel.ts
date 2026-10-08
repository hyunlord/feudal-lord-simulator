import { mix, type Rect } from './weatherPlacement';

export type WorldRainParticle = { readonly id: string; readonly x: number; readonly y: number; readonly variant: number; readonly age: number; readonly life: number; readonly strength: number; readonly preferStrong: boolean };
export type RainWorldInput = { readonly seed: number; readonly seconds: number; readonly intensity: number };
/** A translating world-space front; neither phase nor period depends on camera dimensions. */
export function rainBandWeight(x: number, y: number, seconds: number, seed: number): number {
  const phase = (x + y * 0.35 - seconds * 42 + mix(seed, 39101) % 900) / 900;
  return 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.cos(phase * Math.PI * 2), 3);
}
/** Stateless births in fixed world cells. Overscan includes a full lifetime of drift before culling. */
export function worldRainParticles(input: RainWorldInput, view: Rect): readonly WorldRainParticle[] {
  if (input.intensity <= 0) return [];
  const result: WorldRainParticle[] = [];
  const cell = 48, interval = 0.18, maxLife = 0.7, drift = 180;
  const birth = Math.floor(input.seconds / interval);
  for (let cy = Math.floor((view.y - drift) / cell); cy <= Math.floor((view.y + view.height + drift) / cell); cy += 1) {
    for (let cx = Math.floor((view.x - drift) / cell); cx <= Math.floor((view.x + view.width + drift) / cell); cx += 1) {
      for (let step = birth - Math.ceil(maxLife / interval) - 1; step <= birth; step += 1) {
        const h = mix(input.seed, cx, cy, step, 39103);
        const born = step * interval + (h % 1000) / 1000 * interval;
        const age = input.seconds - born, life = 0.3 + ((h >>> 10) % 401) / 1000;
        if (age < 0 || age >= life) continue;
        const x0 = cx * cell + (h % cell), y0 = cy * cell + ((h >>> 6) % cell);
        const band = rainBandWeight(x0, y0, input.seconds, input.seed);
        const density = Math.min(1, input.intensity * (0.05 + 1.75 * band * band * band));
        const strength = Math.min(0.9, input.intensity * (0.25 + 2 * band * band));
        if (((h >>> 17) % 1000) / 1000 >= density) continue;
        const speed = 120 + ((h >>> 12) % 101);
        const x = x0 - age * speed * 0.2, y = y0 + age * speed;
        if (x < view.x - 16 || x > view.x + view.width + 16 || y < view.y - 24 || y > view.y + view.height + 24) continue;
        result.push({ id: `${cx}:${cy}:${step}`, x, y, variant: (h >>> 21) % 12, age, life, strength, preferStrong: band >= 0.65 });
      }
    }
  }
  return result;
}
