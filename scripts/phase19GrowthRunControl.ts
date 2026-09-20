import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { applyOpeningVillageToTile } from "../src/state/openingVillage";
import { buildWorldGrid } from "../src/world/terrain";

/** Reuses the game's terrain and opening-village construction, without changing its default seed. */
export function createGrowthInitialState(seed: number) {
  const state = structuredClone(DEFAULT_GAME_STATE);
  const world = buildWorldGrid({ width: state.width, height: state.height, seed });
  return { ...state, seed, tiles: world.tiles.map(applyOpeningVillageToTile) };
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
