/**
 * FIX-7 (spec docs/design/chapter-two-war.md WR-2, decision FX7-1): the wool the town's pasture flocks give before
 * wool is a good. Until C5 (the cloth chain) makes the fleece a resource with a store, the clip is reckoned from the
 * pasture zones and paid over only as the wool levy in kind: nothing is stored, nothing is carted.
 *
 * Values are a hypothesis (decision FX7-1), to be set again when C5 grazes the sheep:
 * - a sheep to a pasture cell;
 * - a fleece (about a pound and a half of wool) a sheep a year, shorn in early summer and handed over through the year
 *   as the Crown's collectors come, a quarter each season;
 * - 5d a fleece: the 1337 wool bought for the Crown at about £5–6 a sack of some 240 fleeces.
 */
export const PASTURE_WOOL = {
  sheepPerPastureCell: 1,
  fleecesPerSheepYear: 1,
  seasonsPerClip: 4,
  fleeceValue: 5,
} as const;

/** The in-kind ledger line's resource until C5: the clip's fleeces (C5 turns this id into the good `fleece`). */
export const FLEECE_IN_KIND = "fleece";
