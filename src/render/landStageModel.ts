import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { GROWN_YEARS, STUMP_YEARS } from "../content/landConfig";
import type { ForestHarvest } from "../engine/engine.types";
import { fallowStage, treeStage } from "../engine/land";
import type { SeasonIndex } from "./seasonArt";

// NAT-5 (Wave 42, docs/design/living-growth.md LG-3): which picture each land change stage draws. The engine's stages
// decide (treeStage, fallowStage; the old screen clock forestRecovery.ts is gone); within a stage the picture only
// follows the stage's own years, so a stage change and a picture change fall on ticks the engine knows:
//  - a felled tree: its stump is fresh in its first year, mossy in its second (STUMP_YEARS); its saplings are the knee
//    high clump (sapling_1to3) for the first half of the sapling years and the person high one (sapling_4to8) after;
//    grown, it is young wood (a or b by the cell) until the engine drops the record at a year's turn and the forest's
//    own trees stand there again. Large oak or small ash stump by the cell.
//  - a fallow cell: grass (a house plot's tall grass, a strip's overgrown furrows) its first year, then bramble, then
//    saplings.
// Pictures come in summer and winter only (the batch): spring and autumn draw summer's, as Wave 34 (LU-D1).

const YEAR = 4 * PRESSURE_BALANCE.seasonTicks;
/** The sapling picture turns tall halfway through the engine's sapling years (2 to 5 years after felling). */
const TALL_SAPLING_TICKS = ((STUMP_YEARS + GROWN_YEARS) / 2) * YEAR;
/** Ticks after felling at which a felled tree's picture changes (fresh -> mossy -> short -> tall saplings -> young wood). */
export const TREE_PICTURE_TURNS: readonly number[] = [YEAR, STUMP_YEARS * YEAR, TALL_SAPLING_TICKS, GROWN_YEARS * YEAR];

export type TreeStagePicture =
  | `stump_${"oak_large" | "ash_small"}_${"fresh" | "mossy"}`
  | "sapling_1to3" | "sapling_4to8" | "young_wood_a" | "young_wood_b";
export type FallowPicture = "abandoned_grass" | "abandoned_overgrown_furrows" | "abandoned_bramble" | "abandoned_saplings";
export type LandStagePicture = TreeStagePicture | FallowPicture;
export type StageSeason = "summer" | "winter";

/** A felled tree's picture at `tick` (its engine stage, then the stage's own years). */
export function treeStagePicture(harvest: Pick<ForestHarvest, "tx" | "ty" | "harvestedAtTick">, tick: number): TreeStagePicture {
  const stage = treeStage(harvest, tick);
  const age = tick - harvest.harvestedAtTick;
  const odd = cellHash(harvest.tx, harvest.ty) % 2 === 1;
  if (stage === "stump") return `stump_${odd ? "ash_small" : "oak_large"}_${age < YEAR ? "fresh" : "mossy"}`;
  if (stage === "sapling") return age < TALL_SAPLING_TICKS ? "sapling_1to3" : "sapling_4to8";
  return odd ? "young_wood_b" : "young_wood_a";
}

/** The first tick after `tick` at which the felled tree's picture changes (Infinity once it is young wood). */
export function nextTreePictureTick(harvest: Pick<ForestHarvest, "harvestedAtTick">, tick: number): number {
  const age = tick - harvest.harvestedAtTick;
  const turn = TREE_PICTURE_TURNS.find(at => at > age);
  return turn === undefined ? Number.POSITIVE_INFINITY : harvest.harvestedAtTick + turn;
}

/** A fallow cell's picture: a house plot (`plot`) or a field strip, left at `since`. */
export function fallowPicture(plot: boolean, since: number, tick: number): FallowPicture {
  const stage = fallowStage(since, tick);
  if (stage === "grass") return plot ? "abandoned_grass" : "abandoned_overgrown_furrows";
  return stage === "scrub" ? "abandoned_bramble" : "abandoned_saplings";
}

/** The batch's season file for a season (summer and winter only). */
export function stageSeason(season: SeasonIndex): StageSeason {
  return season === 3 ? "winter" : "summer";
}

/** A small deterministic hash of a cell (picture variants, the season turn's moment). */
export function cellHash(tx: number, ty: number): number {
  let hash = Math.imul(tx + 7_919, 374_761_393) ^ Math.imul(ty + 104_729, 668_265_263);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return (hash ^ (hash >>> 16)) >>> 0;
}
