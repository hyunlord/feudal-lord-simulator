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

// NAT-2 (QA-001): landscape motion — trees in the wind, a flag, a water wheel — on the wall clock (the frame's
// `nowMs`, as the water and the smoke): it goes on while paused and keeps its pace at every game speed. (On the tick
// the trees slid 2.3 times a second at 1x, 11 times at 5x, in tick-sized steps, and froze when paused.)
export const wallClockWave = (nowMs: number, periodMs: number, phase: number): number =>
  Math.sin((nowMs / periodMs) * PHASE_SCALE + phase);

/** A tree's sway period: slow, 3–6 s, its own by its phase (so neighbours do not sway in step). */
export const TREE_SWAY_MIN_MS = 3_000;
export const TREE_SWAY_MAX_MS = 6_000;
export const treeSwayPeriodMs = (phase: number): number =>
  TREE_SWAY_MIN_MS + (TREE_SWAY_MAX_MS - TREE_SWAY_MIN_MS) * (((phase % PHASE_SCALE) + PHASE_SCALE) % PHASE_SCALE) / PHASE_SCALE;

/** How far a tree's crown leans at `nowMs` (px at zoom 1, the sprite's scale included): half the old slide, ±1 × scale. */
export const TREE_SWAY_AMPLITUDE = 1;
export const treeSway = (nowMs: number, phase: number, scale: number): number =>
  TREE_SWAY_AMPLITUDE * scale * wallClockWave(nowMs, treeSwayPeriodMs(phase), phase);
