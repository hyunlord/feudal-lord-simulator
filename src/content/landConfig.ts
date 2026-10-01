/**
 * LM-E5 (spec docs/design/living-growth.md LG-3): how the land changes by itself — a felled tree's years to a sapling
 * and to a grown tree, the footfall that wears a footpath and keeps it, and the years an abandoned plot or field takes
 * to go to grass, scrub and saplings.
 */
/** LG-3 ①: a felled tree is a stump for two years, a sapling to five; then grown (its cell can be felled again). */
export const STUMP_YEARS = 2;
export const GROWN_YEARS = 5;
/** LG-3 ②: a year's trips over a cell (each resident's walks) that make it a footpath, and below which one grows over. */
export const FOOTPATH_MAKE = 24;
export const FOOTPATH_KEEP = 6;
/** LG-3 ②: the services a household walks to each season (the nearest of each kind), and how often a builder is counted. */
export const FOOTFALL_TARGETS: readonly (readonly string[])[] = [["well"], ["market"], ["church", "chapel"]];
export const BUILDER_SAMPLE_TICKS = 50;
/** LG-3 ②: a felled tree's trips from its camp (felling, trimming, hauling), and a tended strip's from its farmstead a season. */
export const WOODCUTTER_TRIPS = 3;
export const FIELD_HAND_TRIPS = 6;
/** LG-3 ③: an abandoned plot or field is grass its first year, scrub its second, saplings from its third. */
export const FALLOW_SCRUB_YEARS = 1;
export const FALLOW_SAPLING_YEARS = 2;
