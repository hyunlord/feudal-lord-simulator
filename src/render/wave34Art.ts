import { manifestArt } from "./manifestArt";
import type { SeasonIndex } from "./seasonArt";
import { WAVE34_WORKS, type Wave34WorksKey } from "./wave34WorksManifest.generated";
import { WAVE41_FORDS, type Wave41FordKey } from "./wave41LandManifest.generated";
import type { DrainStage, FordAxis } from "./landWorksModel";

// LAND-UI Wave 34 art (public/assets/wave34, scripts/installWave34.py) through the shared manifest cache (manifestArt:
// each picture loads on its first draw — the ground chunk that needs it asks for it — never in the startup preload).
// LU-D1: Wave 34 has summer and winter only; spring and autumn use summer. Scale: the source tile is 128 x 64, the
// world tile 64 x 32, so every Wave 34 picture draws at 0.5 world px per source px (records/README "표시 배율").
// NAT-4: the Wave 41 width-1 fords (public/assets/wave41/ford, scripts/installWave41.py; same 512 x 256 sheet, pivot
// (256, 128), water span one cell) join the same cache.

export const WORKS_SCALE = 0.5;

/** A works picture: Wave 34's, or a Wave 41 width-1 ford. */
export type WorksKey = Wave34WorksKey | Wave41FordKey;

const art = manifestArt<WorksKey>({ ...WAVE34_WORKS, ...WAVE41_FORDS });
export const worksArt = art.art;
export const drawWorksArt = art.draw;

export type WorksSeason = "summer" | "winter";
export function worksSeason(season: SeasonIndex): WorksSeason {
  return season === 3 ? "winter" : "summer";
}
export const WORKS_SEASONS: readonly WorksSeason[] = ["summer", "winter"];

/** The ford sheet of a group `width` cells along its axis: w1 (Wave 41; LU-D4 drew the w2 sheet until it came) to w4. */
export function fordKey(width: number, axis: FordAxis, season: WorksSeason): WorksKey {
  return width <= 1 ? `ford_w1_${axis}_${season}` : `ford_w${Math.min(4, width)}_${axis}_${season}` as Wave34WorksKey;
}

export function stageKey(stage: DrainStage, region: "3x3" | "5x5", season: WorksSeason): Wave34WorksKey {
  return stage === 1 ? `drain_stage1_staked_${season}` : stage === 2 ? `drain_stage2_ditched_${season}` : `drain_stage3_drying_${season}_${region}`;
}

export function doneEdgeKey(season: WorksSeason): Wave34WorksKey {
  return `drain_done_edge_${season}`;
}

/** Whether every key has loaded (calling it starts the loads). */
export function worksArtReady(keys: readonly WorksKey[]): boolean {
  let ready = true;
  for (const key of keys) if (art.art(key) === null) ready = false;
  return ready;
}

export function worksMeta(key: Wave34WorksKey): (typeof WAVE34_WORKS)[Wave34WorksKey] {
  return WAVE34_WORKS[key];
}
