import { PRESSURE_BALANCE } from '../content/balanceConfig';
import { GROWN_YEARS, STUMP_YEARS } from '../content/landConfig';
import type { ForestHarvest } from '../engine/engine.types';
import { fallowStage, treeStage } from '../engine/land';
import { ART_REGISTRY, selectLandArt } from './art/wave42Registry';
import { ArtRegistryError, type ArtRegistry } from './art/artRegistry';
import type { SeasonIndex } from './seasonArt';

const YEAR = 4 * PRESSURE_BALANCE.seasonTicks;
const SAPLING_YEARS = GROWN_YEARS - STUMP_YEARS;
/** Engine transitions plus authored visual boundaries share the selector's interval data. */
export const TREE_PICTURE_TURNS: readonly number[] = Object.freeze([...new Set([
  ...ART_REGISTRY.boundaries('land-stage', 'tree', 'ageYears').map(year => year * YEAR),
  STUMP_YEARS * YEAR,
  ...ART_REGISTRY.boundaries('land-stage', 'tree', 'stageProgress').map(progress => (STUMP_YEARS + progress * SAPLING_YEARS) * YEAR),
  GROWN_YEARS * YEAR,
])].sort((a, b) => a - b));

export type TreeStagePicture = string;
export type FallowPicture = string;
export type LandStagePicture = string;
export type StageSeason = 'summer' | 'winter';

/** Engine facts are read unchanged; stageProgress is the fraction of configured sapling years. */
export function treeStagePicture(harvest: Pick<ForestHarvest, 'tx' | 'ty' | 'harvestedAtTick'>, tick: number): TreeStagePicture {
  return treeStageArt(harvest, tick, 'summer').stage;
}

export function treeStageArt(harvest: Pick<ForestHarvest, 'tx' | 'ty' | 'harvestedAtTick'>, tick: number,
  season: StageSeason, registry: ArtRegistry = ART_REGISTRY) {
  const ageYears = (tick - harvest.harvestedAtTick) / YEAR;
  return selectLandArt('tree', {
    family: 'tree', stage: treeStage(harvest, tick), season, ageYears,
    stageProgress: (ageYears - STUMP_YEARS) / SAPLING_YEARS,
    parity: cellHash(harvest.tx, harvest.ty) % 2,
  }, cellHash(harvest.tx, harvest.ty), registry);
}

/** Absolute next visual boundary; the memoizing caller also handles tick rewind. */
export function nextTreePictureTick(harvest: Pick<ForestHarvest, 'harvestedAtTick'>, tick: number): number {
  const age = tick - harvest.harvestedAtTick;
  const turn = TREE_PICTURE_TURNS.find(at => at > age);
  return turn === undefined ? Number.POSITIVE_INFINITY : harvest.harvestedAtTick + turn;
}

export function fallowPicture(plot: boolean, since: number, tick: number): FallowPicture {
  return fallowStageArt(plot, since, tick, 'summer').stage;
}

export function fallowStageArt(plot: boolean, since: number, tick: number, season: StageSeason,
  seed = 0, registry: ArtRegistry = ART_REGISTRY) {
  return selectLandArt('fallow', { family: 'fallow', stage: fallowStage(since, tick), plot, season }, seed, registry);
}

/** Resolve the seasonal edition through the same authored rules as actual stage selection. */
export function stageSeason(season: SeasonIndex): StageSeason {
  const names = ['spring', 'summer', 'autumn', 'winter'] as const;
  const selected = selectLandArt('tree', { family: 'tree', stage: 'stump', ageYears: 0, parity: 0, season: names[season] });
  if (selected.season !== 'summer' && selected.season !== 'winter') throw new ArtRegistryError([{ path: '$/season', message: `Unsupported stage edition ${selected.season}` }]);
  return selected.season;
}

/** The established cell hash remains the variant identity; no engine RNG is consumed. */
export function cellHash(tx: number, ty: number): number {
  let hash = Math.imul(tx + 7_919, 374_761_393) ^ Math.imul(ty + 104_729, 668_265_263);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return (hash ^ (hash >>> 16)) >>> 0;
}
