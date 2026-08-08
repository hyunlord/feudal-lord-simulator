import type { Walker } from "../agents/walker.types";
import type { GameState } from "../engine/engine.types";

type WalkerInterpolationInput = {
  readonly previous: Pick<GameState, "walkers">;
  readonly current: Pick<GameState, "walkers">;
  readonly alpha: number;
};

export function interpolatedWalkerPositions(
  input: WalkerInterpolationInput,
): readonly Walker[] {
  const alpha = clampAlpha(input.alpha);
  if (alpha >= 1) return input.current.walkers;

  const previousById = new Map(input.previous.walkers.map((walker) => [walker.id, walker]));
  return input.current.walkers.map((current) => {
    const previous = previousById.get(current.id);
    if (previous === undefined) return current;
    return {
      ...current,
      position: {
        tx: lerp(previous.position.tx, current.position.tx, alpha),
        ty: lerp(previous.position.ty, current.position.ty, alpha),
      },
    };
  });
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function clampAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) return 1;
  return Math.max(0, Math.min(1, alpha));
}
