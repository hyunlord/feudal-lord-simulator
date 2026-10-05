import { useEffect, useState } from "react";
import { createArtAdapters } from "../../../render/art/artAdapters";
import type { ArtPoint, RegionalMapEntry } from "../../../render/art/artContract";
import { ART_REGISTRY } from "../../../render/art/wave42Registry";
import type { RegionFlag, RegionSite } from "./regionModel";

// LM-R2 (region area): the region map's pictures — lord-components-region in renderer B's art catalog (bundle
// `lord-region`, scripts/installLmr2Region.py): the map itself (`regional-map`, its slots measured on the batch's assembly
// proof) and the sites and flags (`ui-image`, drawn through src/ui/lord/uiPartArt.ts). The registration below is the
// batch's records (records/asset-metrics.json), never a guessed (width/2, height).

export const REGION_MAP_ID = "lord.region.map_region";
export const siteArtId = (site: RegionSite): string => `lord.region.map_${site}`;
/** The picture names keep the batch's spelling (flag_neighbor). */
export const flagArtId = (flag: RegionFlag): string => `lord.region.flag_${flag === "neighbour" ? "neighbor" : flag}`;
export const REGION_PART_IDS: readonly string[] = [
  ...(["manor", "market", "mill"] as const).map(siteArtId), ...(["direct", "delegated", "neighbour"] as const).map(flagArtId),
];

/** Source pixels: a site picture is 96 × 96 with its foot at (48, 88); a flag 64 × 96 with its pole's foot at (14, 90). */
export const SITE_ART = { width: 96, height: 96, pivot: { x: 48, y: 88 } } as const;
export const FLAG_ART = { width: 64, height: 96, pivot: { x: 14, y: 90 } } as const;
/**
 * The flags' empty base (the light parchment square left on the cloth for a house's arms; the batch delivered the flags
 * "with no arms, so the arms can be put on them"), in source pixels: the bounding box of the largest 4-connected patch of
 * opaque (alpha > 200), light (luma > 190) pixels. Measured on the PNGs, not in the records; tests/lmr2Region.test.ts
 * measures the runtime files again.
 */
export const FLAG_BASE: Readonly<Record<RegionFlag, { readonly x: number; readonly y: number; readonly width: number; readonly height: number }>> = {
  direct: { x: 20, y: 22, width: 19, height: 20 },
  delegated: { x: 21, y: 23, width: 17, height: 19 },
  neighbour: { x: 22, y: 24, width: 20, height: 22 },
};

/** The map's own adapters. Cache (AGENTS rule 10): the loader's (a) key is the asset id; (b) nothing else enters — the
 * registry is the startup catalog snapshot, fixed for the session; (c) so the 1600 × 1000 map is requested and decoded
 * once, and only when the region screen first opens (no startup preload). */
const MAP_ART = createArtAdapters(ART_REGISTRY);

export type RegionMapArt = {
  /** The map's catalog entry (its slots place the estates even when the picture is not there), or null. */
  readonly entry: RegionalMapEntry | null;
  /** The deployed URL once the picture has loaded at its declared size; null keeps the plain map. */
  readonly url: string | null;
  /** The load settled without the picture (missing, wrong size, no Image API). */
  readonly failed: boolean;
};

/** The region map's entry and picture: loads on first use, re-renders once the load has settled (once per session). */
/** The map's entry with its deployed URL: one object for the session (the registry is fixed), so a view memoised on it
 * keeps its cache across renders. */
let mapEntry: RegionalMapEntry | null | undefined;
function regionMapEntry(): RegionalMapEntry | null {
  if (mapEntry === undefined) {
    const placed = MAP_ART.placement(REGION_MAP_ID, { at: { x: 0, y: 0 } });
    mapEntry = placed?.type === "ui-handoff" && placed.entry.kind === "regional-map" ? placed.entry : null;
  }
  return mapEntry;
}

export function useRegionMap(): RegionMapArt {
  const [, setSettled] = useState(0);
  useEffect(() => {
    let live = true;
    void MAP_ART.loadSettled(REGION_MAP_ID).then(() => { if (live) setSettled(count => count + 1); });
    return () => { live = false; };
  }, []);
  const entry = regionMapEntry();
  const status = MAP_ART.status(REGION_MAP_ID).status;
  return { entry, url: entry !== null && status === "ready" ? entry.image.url : null, failed: status === "missing" || status === "unavailable" };
}

/** The map's site slots and the flag slot beside each (`<id>.flag`), in the records' order. */
export function siteSlots(entry: Pick<RegionalMapEntry, "slots"> | null): readonly { readonly id: string; readonly site: ArtPoint; readonly flag: ArtPoint | null }[] {
  if (entry === null) return [];
  return entry.slots.filter(slot => !slot.id.endsWith(".flag")).map(slot => {
    const flag = entry.slots.find(other => other.id === `${slot.id}.flag`);
    return { id: slot.id, site: { x: slot.x, y: slot.y }, flag: flag === undefined ? null : { x: flag.x, y: flag.y } };
  });
}
