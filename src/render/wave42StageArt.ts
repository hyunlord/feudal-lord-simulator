import { manifestArt } from "./manifestArt";
import { WAVE42_STAGES, type Wave42StageKey } from "./wave42StageManifest.generated";
import type { StageSeason } from "./landStageModel";

// NAT-5 Wave 42 art (public/assets/wave42, scripts/installWave42.py) through the shared manifest cache: each picture
// loads on its first draw (the chunk or object that needs it asks for it), never in the startup preload. The source
// cell is 128 x 64, the world tile 64 x 32, so every Wave 42 picture draws at 0.5 world px per source px. No picture is
// ever mirrored (the batch's no_flip on every file).

export const STAGE_SCALE = 0.5;

const art = manifestArt<Wave42StageKey>(WAVE42_STAGES);
export const stageArt = art.art;
export const drawStageArt = art.draw;

/** The season file of a picture base (`stump_oak_large_fresh` + summer). */
export function stageKey(base: string, season: StageSeason): Wave42StageKey {
  const key = `${base}_${season}`;
  if (!(key in WAVE42_STAGES)) throw new Error(`no Wave 42 picture ${key}`);
  return key as Wave42StageKey;
}

/** Whether every key has loaded (asking starts their loads). */
export function stageArtReady(keys: readonly Wave42StageKey[]): boolean {
  let ready = true;
  for (const key of keys) if (art.art(key) === null) ready = false;
  return ready;
}
