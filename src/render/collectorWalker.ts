import { manifestArt } from "./manifestArt";
import { WALKER_FIGURE_PX } from "./walkerComposer";
import { WAVE17_WALKER_IMAGES } from "./wave17WalkerManifest.generated";
import { drawCroppedWorldSprite } from "./worldSprite";

// UI-9b: the lord's tax collector (Wave 17 wk_tax_collector, scripts/installWave17Collector.py), who is chased from the
// market in 1381 (reorgWorldProps.ts). Each cell stands on its own foot (the batch's frame_pivots.csv), and the figure
// is WALKER_FIGURE_PX tall like the other story walkers.
const collector = manifestArt(WAVE17_WALKER_IMAGES);
export const preloadCollectorArt = collector.preload;
const META = WAVE17_WALKER_IMAGES.wk_tax_collector;
export const COLLECTOR_SCALE = WALKER_FIGURE_PX / META.figureHeight;
export type CollectorDirection = (typeof META.directions)[number];

/** Draws the collector with the cell's foot at (x, y); false until the sheet is loaded. */
export function drawCollector(context: CanvasRenderingContext2D, direction: CollectorDirection, gait: number, x: number, y: number): boolean {
  const image = collector.art("wk_tax_collector");
  if (image === null) return false;
  const { width, height, rows } = META.frames;
  const frame = gait % rows;
  const foot = META.feet[direction][frame]!;
  drawCroppedWorldSprite(context, image, { x: META.directions.indexOf(direction) * width, y: frame * height, width, height },
    { x: x - foot.x * COLLECTOR_SCALE, y: y - foot.y * COLLECTOR_SCALE, width: width * COLLECTOR_SCALE, height: height * COLLECTOR_SCALE }, false, true);
  return true;
}
