/**
 * ZoneFillAgent v0 (spec Z-14, Z-15). Fills empty frontage plots of burgage zones with L0 houses through
 * the ordinary `place_building` rules. It never paints zones or sets policy. DevAutoPlayer asks it first,
 * and only while a zone exists; with no zone it is never called.
 */
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { ZONE_FILL_MAX_PARCELS } from "../content/zoneConfig";
import { isBuildingConstructionSite } from "../economy/construction";
import type { AutoplayAction } from "../engine/autoplay.types";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../geometry/tileGeometry";
import { PlacementFailure } from "../world/placement";
import { deriveParcels } from "./parcels";
import { zonesOf } from "./zoneEdits";
import { canPlaceBuildingWithZones } from "./zonePlacement";
import type { Parcel } from "./zone.types";

export type ZoneFillDiagnosis = "no_parcels" | "no_anchor" | "materials" | "labour" | "in_progress_limit";

export interface ZoneFillPlacement {
  readonly parcelId: string;
  readonly tile: TileCoordinate;
}

export interface ZoneFillPlan {
  /** Houses to place, in plot order; at most the room left under ZONE_FILL_MAX_PARCELS. */
  readonly placements: readonly ZoneFillPlacement[];
  /** Why plots stay empty: per plot, or `null` key for the whole agent. */
  readonly blocked: readonly { readonly parcelId: string | null; readonly reason: ZoneFillDiagnosis }[];
}

/** Every burgage plot of every zone, zones in ordinal order. */
export function burgageParcels(state: GameState): readonly Parcel[] {
  return zonesOf(state)
    .filter(zone => zone.kind === "burgage")
    .sort((left, right) => left.createdOrdinal - right.createdOrdinal)
    .flatMap(zone => deriveParcels(zone, state));
}

/** House construction sites standing on burgage plots (the agent's work in progress). */
function housesUnderConstruction(state: GameState, parcels: readonly Parcel[]): number {
  const plotCells = new Set(parcels.flatMap(parcel => parcel.cells.map(cell => cell.ty * state.width + cell.tx)));
  return state.constructionSites.filter(isBuildingConstructionSite)
    .filter(site => site.kind === "house" && plotCells.has(site.ty * state.width + site.tx)).length;
}

/** Plans the next batch. Pure: applying the placements one by one through the reducer gives the same houses. */
export function planZoneFill(state: GameState): ZoneFillPlan {
  const parcels = burgageParcels(state);
  if (parcels.length === 0) {
    return { placements: [], blocked: zonesOf(state).some(zone => zone.kind === "burgage") ? [{ parcelId: null, reason: "no_parcels" }] : [] };
  }
  const room = ZONE_FILL_MAX_PARCELS - housesUnderConstruction(state, parcels);
  if (room <= 0) return { placements: [], blocked: [{ parcelId: null, reason: "in_progress_limit" }] };
  if (state.idleWorkers <= 0 && state.constructionSites.some(isBuildingConstructionSite)) {
    return { placements: [], blocked: [{ parcelId: null, reason: "labour" }] };
  }
  const placements: ZoneFillPlacement[] = [];
  const blocked: { parcelId: string | null; reason: ZoneFillDiagnosis }[] = [];
  let virtual = state;
  for (const parcel of parcels) {
    if (placements.length >= room) break;
    if (parcel.buildingIds.length > 0) continue;
    const tile = parcel.frontageCells.find(cell => canPlaceBuildingWithZones(virtual, "house", cell.tx, cell.ty).ok);
    if (tile === undefined) {
      const first = canPlaceBuildingWithZones(virtual, "house", parcel.anchor.tx, parcel.anchor.ty);
      blocked.push({ parcelId: parcel.id, reason: !first.ok && first.reason === PlacementFailure.insufficient_materials ? "materials" : "no_anchor" });
      continue;
    }
    placements.push({ parcelId: parcel.id, tile });
    virtual = reserveTile(virtual, tile);
  }
  return { placements, blocked };
}

/** Marks a planned house tile as taken so later plots in the batch do not pick it. */
function reserveTile(state: GameState, tile: TileCoordinate): GameState {
  const { width, height } = BUILDING_CONFIG_BY_KIND.house;
  const tiles = state.tiles.slice();
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      const index = (tile.ty + dy) * state.width + tile.tx + dx;
      tiles[index] = { ...tiles[index]!, buildingId: "zone-fill-plan" };
    }
  }
  return { ...state, tiles };
}

/** DevAutoPlayer entry: the first planned house as an autoplay action, or null when nothing is planned. */
export function zoneFillAction(state: GameState): AutoplayAction | null {
  const next = planZoneFill(state).placements[0];
  return next === undefined ? null : { kind: "place_building", building: "house", tx: next.tile.tx, ty: next.tile.ty };
}
