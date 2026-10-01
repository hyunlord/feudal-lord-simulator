import { manifestArt } from "./manifestArt";
import type { SeasonIndex } from "./seasonArt";
import { WAVE34_WORKS, type Wave34WorksKey } from "./wave34WorksManifest.generated";
import type { DrainStage, FordAxis } from "./landWorksModel";

// LAND-UI Wave 34 art (public/assets/wave34, scripts/installWave34.py) through the shared manifest cache (manifestArt:
// each picture loads on its first draw — the ground chunk that needs it asks for it — never in the startup preload).
// LU-D1: Wave 34 has summer and winter only; spring and autumn use summer. Scale: the source tile is 128 x 64, the
// world tile 64 x 32, so every Wave 34 picture draws at 0.5 world px per source px (records/README "표시 배율").

export const WORKS_SCALE = 0.5;

const art = manifestArt<Wave34WorksKey>(WAVE34_WORKS);
export const worksArt = art.art;
export const drawWorksArt = art.draw;

export type WorksSeason = "summer" | "winter";
export function worksSeason(season: SeasonIndex): WorksSeason {
  return season === 3 ? "winter" : "summer";
}
export const WORKS_SEASONS: readonly WorksSeason[] = ["summer", "winter"];

/** LU-D4: no w1 sheet — a single-cell ford draws the w2 sheet. */
export function fordKey(width: number, axis: FordAxis, season: WorksSeason): Wave34WorksKey {
  return `ford_w${Math.min(4, Math.max(2, width))}_${axis}_${season}` as Wave34WorksKey;
}

export function stageKey(stage: DrainStage, region: "3x3" | "5x5", season: WorksSeason): Wave34WorksKey {
  return stage === 1 ? `drain_stage1_staked_${season}` : stage === 2 ? `drain_stage2_ditched_${season}` : `drain_stage3_drying_${season}_${region}`;
}

export function doneEdgeKey(season: WorksSeason): Wave34WorksKey {
  return `drain_done_edge_${season}`;
}

/** Whether every key has loaded (calling it starts the loads). */
export function worksArtReady(keys: readonly Wave34WorksKey[]): boolean {
  let ready = true;
  for (const key of keys) if (art.art(key) === null) ready = false;
  return ready;
}

export function worksMeta(key: Wave34WorksKey): (typeof WAVE34_WORKS)[Wave34WorksKey] {
  return WAVE34_WORKS[key];
}
