import type { Rng } from "../content/random";

const UINT32_RANGE = 0x1_0000_0000;
const MULBERRY_INCREMENT = 0x6d2b_79f5;
const FNV_OFFSET = 0x811c_9dc5;
const FNV_PRIME = 0x0100_0193;

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

function mixString(hash: number, value: string): number {
  let mixed = hash >>> 0;

  for (let index = 0; index < value.length; index += 1) {
    mixed ^= value.charCodeAt(index);
    mixed = Math.imul(mixed, FNV_PRIME) >>> 0;
  }

  return mixNumber(mixed, value.length);
}

function mixNumber(hash: number, value: number): number {
  let mixed = hash >>> 0;
  let word = Math.trunc(value) >>> 0;

  for (let byte = 0; byte < 4; byte += 1) {
    mixed ^= word & 0xff;
    mixed = Math.imul(mixed, FNV_PRIME) >>> 0;
    word >>>= 8;
  }

  return mixed;
}

function avalanche(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb_352d) >>> 0;
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846c_a68b) >>> 0;
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}
