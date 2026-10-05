import { createArtAdapters } from './art/artAdapters';
import { ART_REGISTRY } from './art/wave42Registry';
import type { Wave42StageKey } from './wave42StageManifest.generated';
import { drawCroppedWorldSprite } from './worldSprite';
import type { ArtRegistry } from './art/artRegistry';
import type { StageSeason } from "./landStageModel";

// NAT-5 Wave 42 art (public/assets/wave42, scripts/installWave42.py) through the shared manifest cache: each picture
// loads on its first draw (the chunk or object that needs it asks for it), never in the startup preload. The source
// cell is 128 x 64, the world tile 64 x 32, so every Wave 42 picture draws at 0.5 world px per source px. No picture is
// ever mirrored (the batch's no_flip on every file).

export function pathArtScale(registry: ArtRegistry): number {
  const scales = [...new Set(registry.entries('land-stage').flatMap(entry =>
    entry.kind === 'land-stage' && entry.family === 'path' ? [entry.geometry.scale] : []))];
  if (scales.length !== 1 || scales[0] === undefined) throw new Error('Joined path geometry requires a common world scale');
  return scales[0];
}
export const STAGE_SCALE = pathArtScale(ART_REGISTRY);

const art = createArtAdapters(ART_REGISTRY);
export const stageArt = art.image;
export const stageArtStatus = art.status;

export function drawStageArt(context: CanvasRenderingContext2D, key: Wave42StageKey, x: number, y: number, requestedScale?: number): boolean {
  const entry = ART_REGISTRY.entry(key);
  if (entry === null || entry.kind !== 'land-stage' || (requestedScale !== undefined && requestedScale !== entry.geometry.scale)) throw new Error(`Invalid stage geometry ${key}`);
  const scale = entry.geometry.scale;
  if (entry.layout === 'single') return art.draw(context, key, { at: { x, y } });
  const image = art.image(key);
  if (image === null) return false;
  const { pivot } = entry.geometry;
  drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: entry.image.width, height: entry.image.height },
    { x: x - pivot.x * scale, y: y - pivot.y * scale, width: entry.image.width * scale, height: entry.image.height * scale }, false, true);
  return true;
}

/** Resolve the connector used by the path layout, with the same family scope as its validator. */
export function stageKey(base: string, season: StageSeason, registry: ArtRegistry = ART_REGISTRY): Wave42StageKey {
  const path = registry.select('land-stage', 'path', { family: 'path', stage: base, season }, 0);
  if (path !== null) return path.id;
  const matching = registry.entries('land-stage').filter(entry => entry.kind === 'land-stage' && entry.family === 'path' && entry.stage === base && entry.season === season);
  if (matching.length !== 1 || matching[0] === undefined) throw new Error(`Expected one stage edition ${base}/${season}`);
  return matching[0].id;
}

/** Whether every key has loaded (asking starts their loads). */
export function stageArtReady(keys: readonly Wave42StageKey[]): boolean {
  let ready = true;
  for (const key of keys) if (art.image(key) === null) ready = false;
  return ready;
}
