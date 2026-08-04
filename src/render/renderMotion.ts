export type AmbientInput = {
  readonly tick: number;
  readonly amplitude: number;
  readonly frequency: number;
  readonly phase: number;
};

const PHASE_SCALE = Math.PI * 2;

export const ambientOffset = (input: AmbientInput): number =>
  input.amplitude * Math.sin(input.tick * input.frequency + input.phase);

export const objectPhase = (kind: string, tx: number, ty: number): number => {
  let hash = 2_166_136_261;
  const key = `${kind}:${tx}:${ty}`;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return ((hash >>> 0) / 4_294_967_295) * PHASE_SCALE;
};
