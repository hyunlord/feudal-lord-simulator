import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { arableStripStates } from "../zones/arableStrips";
import { zonesOf } from "../zones/zoneEdits";
import { variantImage } from "./buildingVariantAssets";
import { frameBuildingVariant } from "./buildingVariants";
import { BUILDING_VARIANT_POOLS } from "./buildingVariantManifest";
import { drawWorldSpriteAtWorldAnchor, type WorldSpriteOptions } from "./worldSprite";

// Farmstead (barn) art (C1f, Wave 4c): `farmstead_a` / `farmstead_b` picked by the V1 variant rule (position hash +
// neighbour push, building:farmstead pool), and `farmstead_working` while the harvest is on: one of the strips this
// farmstead tends is `ripe` (C1c-2 arableStripStates: stage + farmsteadId). The art is painted in the storehouse's
// frame (160 x 136, ground pivot 80,120), so it is drawn with the storehouse's registration; the farmstead is 1 x 1
// (C1c-2 A3) against the storehouse's 2 x 2, so it stands on its own tile at FARMSTEAD_SCALE of the storehouse size.

const FRAME_KEY = "storehouse";
/** 1x1 barn at 0.75 of the 2x2 storehouse: about 62 px wide at zoom 1 over a 64 px tile. */
export const FARMSTEAD_SCALE = 0.75;
const POOL = BUILDING_VARIANT_POOLS.find(pool => pool.kind === "farmstead");
const WORKING = POOL?.variants.find(variant => variant.id === "working");

/** Per farmstead: harvest on (a tended strip is ripe), and the first tended strip ploughed / harvested (for the props). */
export type FarmsteadFieldWork = {
  readonly ripe: boolean;
  readonly ploughed: readonly { readonly tx: number; readonly ty: number }[] | null;
  readonly harvested: readonly { readonly tx: number; readonly ty: number }[] | null;
};

/**
 * Farmstead id -> its field work this tick. Cache (AGENTS rule 10): (a) keyed on the buildings, zones and arableFields
 * arrays (the tick moves with the buildings array, replaced every tick); (b) arableStripStates reads nothing else that
 * changes a strip's stage or tending farmstead; (c) one arableStripStates pass per arable zone per state, the same
 * work the field strips' lookup does.
 */
const fieldWork = new WeakMap<object, WeakMap<object, WeakMap<object, ReadonlyMap<string, FarmsteadFieldWork>>>>();
const NO_FIELDS: readonly unknown[] = [];
export function farmsteadFieldWork(state: GameState): ReadonlyMap<string, FarmsteadFieldWork> {
  const zones = zonesOf(state);
  const fields = (state.arableFields ?? NO_FIELDS) as object;
  let byZones = fieldWork.get(state.buildings);
  if (byZones === undefined) { byZones = new WeakMap(); fieldWork.set(state.buildings, byZones); }
  let byFields = byZones.get(zones);
  if (byFields === undefined) { byFields = new WeakMap(); byZones.set(zones, byFields); }
  const cached = byFields.get(fields);
  if (cached !== undefined) return cached;
  const work = new Map<string, { ripe: boolean; ploughed: FarmsteadFieldWork["ploughed"]; harvested: FarmsteadFieldWork["harvested"] }>();
  for (const zone of zones) {
    if (zone.kind !== "arable") continue;
    for (const strip of arableStripStates(zone, state).strips) {
      if (strip.farmsteadId === null) continue;
      const entry = work.get(strip.farmsteadId) ?? { ripe: false, ploughed: null, harvested: null };
      if (strip.stage === "ripe") entry.ripe = true;
      if (strip.stage === "ploughed" && entry.ploughed === null) entry.ploughed = strip.cells;
      if (strip.stage === "harvested" && entry.harvested === null) entry.harvested = strip.cells;
      work.set(strip.farmsteadId, entry);
    }
  }
  byFields.set(fields, work);
  return work;
}

/** The farmstead image this frame: working during the harvest, else its variant (a / b). */
export function farmsteadImageUrl(state: GameState, building: Pick<Building, "id">): string | null {
  if (farmsteadFieldWork(state).get(building.id)?.ripe === true && WORKING !== undefined) return WORKING.url;
  return frameBuildingVariant(building)?.url ?? POOL?.variants[0]?.url ?? null;
}

export function drawFarmsteadSprite(context: CanvasRenderingContext2D, building: Building, state: GameState, options: WorldSpriteOptions): boolean {
  const url = farmsteadImageUrl(state, building);
  const image = url === null ? null : variantImage(url, 160, 136);
  if (image === null) return false;
  return drawWorldSpriteAtWorldAnchor(context, FRAME_KEY, building.tx, building.ty, { ...options, image, scale: (options.scale ?? 1) * FARMSTEAD_SCALE });
}
