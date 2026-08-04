const UINT32_MAX = 4_294_967_295;

function latticeHash(ix: number, iy: number, seed: number): number {
  let hash =
    Math.imul(ix, 0x1f12_3bb5) ^
    Math.imul(iy, 0x5f35_6495) ^
    Math.imul(seed | 0, 0x6c8e_9cf5);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9_f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9_f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) / UINT32_MAX;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function valueNoise2D(x: number, y: number, seed: number): number {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const horizontal = smoothstep(x - left);
  const vertical = smoothstep(y - top);

  const topValue = lerp(
    latticeHash(left, top, seed),
    latticeHash(left + 1, top, seed),
    horizontal,
  );
  const bottomValue = lerp(
    latticeHash(left, top + 1, seed),
    latticeHash(left + 1, top + 1, seed),
    horizontal,
  );

  return lerp(topValue, bottomValue, vertical);
}

export function fbm(x: number, y: number, seed: number, octaves: number): number {
  if (!Number.isInteger(octaves) || octaves <= 0) {
    throw new RangeError("octaves must be a positive integer");
  }

  let amplitude = 1;
  let frequency = 1;
  let weightedValue = 0;
  let totalAmplitude = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    weightedValue +=
      valueNoise2D(x * frequency, y * frequency, seed + octave * 1_013) * amplitude;
    totalAmplitude += amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }

  return weightedValue / totalAmplitude;
}
