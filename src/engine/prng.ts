import type { Rng } from "../content/random";
import { avalanche, FNV_OFFSET, hashSeed, mixNumber, mixString } from "../content/seedHash";

/** ARCH-1: `hashSeed` lives in content (the world's generators read it too, and the world does not import the engine). */
export { hashSeed };

const UINT32_RANGE = 0x1_0000_0000;
const MULBERRY_INCREMENT = 0x6d2b_79f5;

export interface RoamingJunctionSeedInput {
  readonly stateSeed: number;
  readonly walkerId: string;
  readonly tick: number;
  readonly tx: number;
  readonly ty: number;
  readonly visitCount: number;
}

export function createMulberry32(seed: number): Rng {
  let state = seed >>> 0;

  return {
    next(): number {
      state = (state + MULBERRY_INCREMENT) >>> 0;
      let mixed = Math.imul(state ^ (state >>> 15), state | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
    },
    range(min: number, max: number): number {
      return min + this.next() * (max - min);
    },
    int(minInclusive: number, maxExclusive: number): number {
      return Math.floor(this.range(minInclusive, maxExclusive));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new RangeError("Cannot pick from an empty collection");
      }

      const item = items[this.int(0, items.length)];
      if (item === undefined) {
        throw new RangeError("PRNG picked outside the collection bounds");
      }

      return item;
    },
  };
}

export function createRoamingJunctionSeed(input: RoamingJunctionSeedInput): number {
  let hash = FNV_OFFSET;
  hash = mixString(hash, "roaming-junction-v1");
  hash = mixNumber(hash, input.stateSeed);
  hash = mixString(hash, input.walkerId);
  hash = mixNumber(hash, input.tick);
  hash = mixNumber(hash, input.tx);
  hash = mixNumber(hash, input.ty);
  hash = mixNumber(hash, input.visitCount);
  return avalanche(hash);
}

/** F0-B: a deterministic roll in [0, 1000) (see `hashSeed`). */
export function rollPermille(stateSeed: number, salt: string, ...values: readonly number[]): number {
  return hashSeed(stateSeed, salt, ...values) % 1000;
}
