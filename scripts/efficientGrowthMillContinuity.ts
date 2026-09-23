import type { GameState } from '../src/engine/engine.types';

const CHRONIC_ZERO_WHEAT_TICKS = 2400;

type MillWheatSample = Readonly<{ id: string; wheat: number }>;
type Streak = { consecutive: number; longest: number };
export type MillZeroWheatReport = Readonly<{ known: boolean; stableTicks: number; millIds: readonly string[] }>;

export function millWheatSamples(state: GameState): readonly MillWheatSample[] {
  return state.buildings.filter(building => building.kind === 'mill')
    .map(building => ({ id: building.id, wheat: building.inventory.wheat ?? 0 }));
}

export function createMillZeroWheatObservation() {
  const streaks = new Map<string, Streak>();
  let lastTick: number | null = null;
  let stableSince: number | null = null;
  let stableTicks = 0;
  return {
    observe(tick: number, currentStableSince: number | null, mills: readonly MillWheatSample[]) {
      if (currentStableSince === null || stableSince !== currentStableSince ||
        lastTick !== null && tick !== lastTick + 1) {
        streaks.clear();
        stableTicks = 0;
      }
      stableSince = currentStableSince;
      lastTick = tick;
      if (currentStableSince === null) return;
      stableTicks += 1;
      const present = new Set(mills.map(mill => mill.id));
      for (const id of streaks.keys()) if (!present.has(id)) streaks.delete(id);
      for (const mill of mills) {
        const previous = streaks.get(mill.id);
        const consecutive = mill.wheat === 0 ? (previous?.consecutive ?? 0) + 1 : 0;
        streaks.set(mill.id, { consecutive, longest: Math.max(previous?.longest ?? 0, consecutive) });
      }
    },
    report(): MillZeroWheatReport {
      return { known: stableTicks >= CHRONIC_ZERO_WHEAT_TICKS, stableTicks,
        millIds: [...streaks].filter(([, streak]) => streak.longest >= CHRONIC_ZERO_WHEAT_TICKS)
          .map(([id]) => id).sort() };
    },
  };
}
