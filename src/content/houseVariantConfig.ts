/**
 * INSTALL-26 the Wave 26 house variants on the map (src/render/houseVariantChoice.ts): which of a level's five
 * paintings a household's single-lot house shows, and when its state layers go on. Presentation only: nothing here
 * changes the simulation. Weights are relative (a painting's chance is its weight over the level's total).
 */
export type HouseRoof = "thatch" | "clay_tile" | "stone_slate";
export type HouseWealth = "common" | "rich";

export const HOUSE_VARIANT_CONFIG = {
  /**
   * The roof of each level's approved painting (the "existing" choice, which keeps its Wave 2 variants and the INSTALL-3
   * alehouse), read off the art: thatch at L0 and L1, clay tile from L2 (Wave 26 README: 2 thatch among the 5).
   */
  existingRoof: ["thatch", "thatch", "clay_tile", "clay_tile", "clay_tile"] as readonly HouseRoof[],
  /**
   * A painting's weight by its roof and the household's wealth. Commoners thatch (a tile roof is three times rarer than
   * a thatch one); rich households tile (thatch three times rarer); stone slate, the heaviest roof (L4 e and f only),
   * a little rarer than tile for both. With these, L2 is 82 % thatch for a commoner and 33 % for a rich household.
   */
  roofWeight: {
    common: { thatch: 3, clay_tile: 1, stone_slate: 1 },
    rich: { thatch: 1, clay_tile: 3, stone_slate: 2 },
  } as Readonly<Record<HouseWealth, Readonly<Record<HouseRoof, number>>>>,
  /**
   * Rich: the head's class band is one of these (the engine gives `artisan` only to the masters of the mill, sawmill and
   * masonry, PS-4, so it is the upper artisan; `merchant` the market's chapman), or the house is built to this level.
   */
  richClassBands: ["merchant", "gentry", "artisan"] as readonly string[],
  richFromLevel: 4,
  /** `fresh`: this many seasons after the household first moved in (history `person.move_in`) or its rebuild (`person.rebuilt`). */
  freshSeasons: 2,
  /** `weathered`: the house was completed this many years ago (a founding house counts from the game's start)… */
  oldYears: 10,
} as const;
