import type { Rng } from "../content/random";

export function createMulberry32(seed: number): Rng {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  function range(min: number, max: number): number {
    if (max <= min) return min;
    return min + (max - min) * next();
  }

  function int(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) return minInclusive;
    return Math.floor(range(minInclusive, maxExclusive));
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty list");
    }
    return items[int(0, items.length)] as T;
  }

  return { next, range, int, pick };
}
