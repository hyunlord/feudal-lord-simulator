import { createGrowthOpening } from "./phase21OpeningTranslation";
export { InvalidGrowthOpeningError } from "./phase21OpeningTranslation";

export function createGrowthInitialState(seed: number) {
  return createGrowthOpening(seed).state;
}

/** Run-local continuous qualifying window; observations are completed simulation ticks. */
export function createGrowthStability(targetLots: number) {
  let stableSince: number | null = null;
  let sustainedTicks = 0;
  let interruptions = 0;
  return {
    observe(sample: { readonly tick: number; readonly lots: number; readonly victory: boolean; readonly fullService: boolean }) {
      if (sample.lots >= targetLots && sample.victory && sample.fullService) {
        stableSince ??= sample.tick;
        sustainedTicks = sample.tick - stableSince + 1;
      } else {
        if (stableSince !== null) interruptions += 1;
        stableSince = null;
        sustainedTicks = 0;
      }
    },
    report: () => ({ stableSince, sustainedTicks, interruptions, complete: sustainedTicks >= 24_000 }),
  };
}
