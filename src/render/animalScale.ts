// ASSET-2 (ASSET-1 finding: Wave 13 at its spec's × 0.5 would be more than twice the pasture's animals): the scale the
// Wave 13 animals and carts are drawn at when MOVE-2 installs them. One factor for the batch, so its animals keep the
// proportions Astra drew between them (sheep, pigs, geese, dogs), set by the large animals: the mean body length of its
// cow, ox and draught horse drawn at this factor equals the pasture's installed cow (`cattle_pair`, 128 px drawn 30 px
// wide: a cow 61 px long → 14.3 px). Body length: the widest separate figure's opaque width (alpha > 64) in the sheet.
// Measured on the sheets: cow 64, ox 71, draught horse 72.5 → mean 69.2 → 14.3 / 69.2. `tests/asset2Scales.test.ts`
// measures them again and holds each large animal within ± 10 % of the installed cow.
export const PASTURE_COW_LENGTH_PX = 61 * (30 / 128);
export const WAVE13_LARGE_ANIMAL_LENGTH_PX = (64 + 71 + 72.5) / 3;
export const WAVE13_ANIMAL_SCALE = PASTURE_COW_LENGTH_PX / WAVE13_LARGE_ANIMAL_LENGTH_PX;
