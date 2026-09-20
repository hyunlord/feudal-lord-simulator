const SAMPLE_CAPACITY = 240;

export type ProofFrameWorkSnapshot = {
  readonly capacity: number;
  readonly frameCount: number;
  readonly tickCount: number;
  readonly frameWorkMs: readonly number[];
  readonly tickWorkMs: readonly number[];
};

type WorkRing = {
  readonly record: (durationMs: number) => void;
  readonly samples: () => readonly number[];
  readonly count: () => number;
  readonly clear: () => void;
};

type ProofFrameWorkRecorder = {
  readonly recordFrame: (durationMs: number) => void;
  readonly recordTick: (durationMs: number) => void;
  readonly snapshot: () => ProofFrameWorkSnapshot;
};

// One active canvas owns collection; tick callbacks resolve it when they execute.
export const proofFrameWork: { current: ProofFrameWorkRecorder | null } = { current: null };

export function installProofFrameWork(): ProofFrameWorkRecorder & { readonly dispose: () => void } {
  const frames = createWorkRing();
  const ticks = createWorkRing();
  const recorder: ProofFrameWorkRecorder = {
    recordFrame: frames.record,
    recordTick: ticks.record,
    snapshot: () => ({
      capacity: SAMPLE_CAPACITY,
      frameCount: frames.count(),
      tickCount: ticks.count(),
      frameWorkMs: frames.samples(),
      tickWorkMs: ticks.samples(),
    }),
  };
  proofFrameWork.current = recorder;
  return {
    ...recorder,
    dispose: () => {
      if (proofFrameWork.current === recorder) proofFrameWork.current = null;
      frames.clear();
      ticks.clear();
    },
  };
}

function createWorkRing(): WorkRing {
  const values = new Float64Array(SAMPLE_CAPACITY);
  let count = 0;
  return {
    record: (durationMs) => { values[count % SAMPLE_CAPACITY] = durationMs; count += 1; },
    count: () => count,
    samples: () => {
      const length = Math.min(count, SAMPLE_CAPACITY);
      const start = count - length;
      return Array.from({ length }, (_, offset) => values[(start + offset) % SAMPLE_CAPACITY] ?? 0);
    },
    clear: () => { count = 0; values.fill(0); },
  };
}
