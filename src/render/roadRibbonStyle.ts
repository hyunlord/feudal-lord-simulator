import type { RoadMaterial } from "../world/boundary/roadCenterline";
import { ROAD_STRIP_CHOICE, ROAD_STRIP_SETS, type RoadStripSet } from "./boundaryAssetManifest";

// Road ribbon width (D1a-2 C07): the visible earth width in tiles. 0.65 since C1b (owner decision after the D1a-2
// 0.55 / 0.65 / 0.75 captures); the URL query `road-ribbon-width` (clamped to 0.45..0.85) still overrides it. Part of the ground
// scene key, so changing it re-derives the ribbon layout and re-rasters road chunks.

export const ROAD_RIBBON_WIDTH = 0.65;
export const ROAD_RIBBON_WIDTH_QUERY = "road-ribbon-width";
const MIN_WIDTH = 0.45;
const MAX_WIDTH = 0.85;

export function resolveRoadRibbonWidth(search: string | undefined): number {
  const value = Number(new URLSearchParams(search ?? "").get(ROAD_RIBBON_WIDTH_QUERY));
  return Number.isFinite(value) && value > 0 ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value)) : ROAD_RIBBON_WIDTH;
}

let width = resolveRoadRibbonWidth(typeof window === "undefined" ? undefined : window.location.search);

export function roadRibbonWidth(): number {
  return width;
}

/** Tests and proof tools. */
export function setRoadRibbonWidth(value: number): void {
  width = value;
}

// Road strip set per material (boundaryAssetManifest ROAD_STRIP_SETS / ROAD_STRIP_CHOICE). The URL query
// `road-strip=v1|v2` overrides the earth choice so the evidence captures can put both sets side by side.
export const ROAD_STRIP_QUERY = "road-strip";
let earthOverride: string | null = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(ROAD_STRIP_QUERY);

export function roadStripSet(material: RoadMaterial): RoadStripSet {
  const sets = ROAD_STRIP_SETS[material] as Record<string, RoadStripSet>;
  const choice = material === "earth" && earthOverride !== null && earthOverride in sets ? earthOverride : ROAD_STRIP_CHOICE[material];
  return sets[choice] as RoadStripSet;
}

/** Tests and proof tools: force the earth strip set (null = manifest choice). */
export function setRoadStripOverride(value: string | null): void {
  earthOverride = value;
}

/** Part of the ground scene key. */
export function roadStripSignature(): string {
  return `${roadStripSet("earth").images.join("+")}|${roadStripSet("stone").images.join("+")}`;
}
