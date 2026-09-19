import type { Building } from "../content/buildingConfig";
import { CROP_REGISTRATION, cropDestination, farmCropRoots, type CropStage } from "./farmCropLayout";
import { createTintCanvas, drawCroppedWorldSprite } from "./worldSprite";
import type { RasterizedWorldSprite } from "./worldSpriteRaster";

export const FARM_CANOPY_CAPACITY = 64;
export const FARM_CANOPY_RESOLUTION = 3;
type Plot = Pick<Building, "tx" | "ty">;
type Canopy = RasterizedWorldSprite & Readonly<{
  destination: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;
type Entry = Readonly<{ sprite: RasterizedWorldSprite; canopy: Canopy }>;

/** Transparent crop pixels only; soil and simulation state never enter this bounded LRU. */
export function createFarmCanopyCache() {
  const entries = new Map<string, Entry>();
  const usedThisFrame = new Set<string>();
  let hits = 0;
  let misses = 0;
  let evictions = 0;
  let admissionsSkipped = 0;
  return {
    beginFrame: () => usedThisFrame.clear(),
    size: () => entries.size,
    stats: () => ({ entries: entries.size, capacity: FARM_CANOPY_CAPACITY, hits, misses, evictions, admissionsSkipped,
      bytes: [...entries.values()].reduce((sum, entry) => sum + entry.canopy.source.width * entry.canopy.source.height * 4, 0) }),
    get(plot: Plot, stage: CropStage, sprite: RasterizedWorldSprite): Canopy | null {
      const key = `${plot.tx},${plot.ty}:${stage}`;
      const cached = entries.get(key);
      entries.delete(key);
      if (cached !== undefined && cached.sprite.image === sprite.image
        && cached.sprite.source.x === sprite.source.x && cached.sprite.source.y === sprite.source.y
        && cached.sprite.source.width === sprite.source.width && cached.sprite.source.height === sprite.source.height) {
        hits += 1;
        entries.set(key, cached);
        usedThisFrame.add(key);
        return cached.canopy;
      }
      misses += 1;
      // Never replace a canopy already needed by this frame: dense scenes would rebuild it every frame.
      const oldestUnused = entries.size >= FARM_CANOPY_CAPACITY
        ? [...entries.keys()].find(candidate => !usedThisFrame.has(candidate)) : undefined;
      if (entries.size >= FARM_CANOPY_CAPACITY && oldestUnused === undefined) {
        admissionsSkipped += 1;
        return null;
      }
      const canopy = rasterizeCanopy(plot, stage, sprite);
      if (canopy === null) return null;
      if (oldestUnused !== undefined) { entries.delete(oldestUnused); evictions += 1; }
      entries.set(key, { sprite, canopy });
      usedThisFrame.add(key);
      return canopy;
    },
  };
}

function rasterizeCanopy(plot: Plot, stage: CropStage, sprite: RasterizedWorldSprite): Canopy | null {
  const destinations = farmCropRoots(plot).map(root => cropDestination(root, CROP_REGISTRATION[stage]));
  const x = Math.floor(Math.min(...destinations.map(rect => rect.x))) - 1;
  const y = Math.floor(Math.min(...destinations.map(rect => rect.y))) - 1;
  const width = Math.ceil(Math.max(...destinations.map(rect => rect.x + rect.width))) + 1 - x;
  const height = Math.ceil(Math.max(...destinations.map(rect => rect.y + rect.height))) + 1 - y;
  const resolution = FARM_CANOPY_RESOLUTION;
  const canvas = createTintCanvas(width * resolution, height * resolution);
  const context = canvas?.getContext("2d");
  if (canvas === null || context === null || context === undefined) return null;
  context.setTransform(resolution, 0, 0, resolution, -x * resolution, -y * resolution);
  for (const destination of destinations) {
    drawCroppedWorldSprite(context, sprite.image, sprite.source, destination, false, true);
  }
  return {
    image: canvas,
    source: { x: 0, y: 0, width: canvas.width, height: canvas.height },
    destination: { x, y, width, height },
  };
}
