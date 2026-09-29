/**
 * The seed hash (FNV-1a over a salt and whole numbers, then an avalanche): a deterministic 32-bit value. Moved from
 * `engine/prng.ts` unchanged (ARCH-1) so the world's generators can read it without importing the engine.
 */
export const FNV_OFFSET = 0x811c_9dc5;
const FNV_PRIME = 0x0100_0193;

/** F0-B (EV-1): a deterministic 32-bit value from the state seed, a salt and integers (event schedule, weather, fire). */
export function hashSeed(stateSeed: number, salt: string, ...values: readonly number[]): number {
  let hash = mixNumber(mixString(FNV_OFFSET, salt), stateSeed);
  for (const value of values) hash = mixNumber(hash, value);
  return avalanche(hash);
}

export function mixString(hash: number, value: string): number {
  let mixed = hash >>> 0;

  for (let index = 0; index < value.length; index += 1) {
    mixed ^= value.charCodeAt(index);
    mixed = Math.imul(mixed, FNV_PRIME) >>> 0;
  }

  return mixNumber(mixed, value.length);
}

export function mixNumber(hash: number, value: number): number {
  let mixed = hash >>> 0;
  let word = Math.trunc(value) >>> 0;

  for (let byte = 0; byte < 4; byte += 1) {
    mixed ^= word & 0xff;
    mixed = Math.imul(mixed, FNV_PRIME) >>> 0;
    word >>>= 8;
  }

  return mixed;
}

export function avalanche(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb_352d) >>> 0;
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846c_a68b) >>> 0;
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

