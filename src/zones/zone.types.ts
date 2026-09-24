/**
 * Player-painted land zones (spec `docs/design/zones.md`, Z-*).
 *
 * The source is what the player drew (`strokes`); the rule input is `membership`, the cells the
 * zone owns. Both are saved (schema v6). Parcels are derived and never saved.
 */
import type { TileCoordinate } from "../geometry/tileGeometry";

export const ZONE_KINDS = ["burgage", "arable", "pasture", "hay_meadow", "woodland_common", "orchard"] as const;
export type ZoneKind = (typeof ZONE_KINDS)[number];

/** A stroke point in tile-edge space: cell (tx,ty) spans [tx,tx+1)×[ty,ty+1), its centre is (tx+0.5, ty+0.5). */
export interface ZoneStrokePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * One drawing gesture. `brush` is the union of discs of `radius` swept along the polyline `points`;
 * `polygon` is the simple polygon through `points`. Stored values are multiples of 1/8 tile (Z-2).
 */
export interface ZoneStroke {
  readonly tool: "brush" | "polygon";
  readonly points: readonly ZoneStrokePoint[];
  readonly radius?: number;
}

export interface Zone {
  /** `zone-000001`, from `createdOrdinal`. */
  readonly id: string;
  readonly kind: ZoneKind;
  /** Paint strokes in the order they were applied. `membership` is always a subset of their raster. */
  readonly strokes: readonly ZoneStroke[];
  /** Owned cells as ascending tile indices (`ty * width + tx`). A cell belongs to at most one zone. */
  readonly membership: readonly number[];
  readonly createdOrdinal: number;
  readonly label?: string;
}

/** A frontage plot derived from a burgage zone and the roads beside it (Z-12). Not saved. */
export interface Parcel {
  /** `${zoneId}:${anchor.tx},${anchor.ty}`. Stable while the anchor frontage cell keeps its strip. */
  readonly id: string;
  readonly zoneId: string;
  /** Every cell of the plot, ascending by tile index. */
  readonly cells: readonly TileCoordinate[];
  /** Cells that touch a road, in road order. */
  readonly frontageCells: readonly TileCoordinate[];
  /** Where a new house goes: the first frontage cell in road order. */
  readonly anchor: TileCoordinate;
  /** Number of frontage strips (2–4 for ordinary plots). */
  readonly width: number;
  /** Longest strip, in cells. */
  readonly depth: number;
  /** Houses (and house construction sites) standing on the plot; their footprints stay whole (Z-13). */
  readonly buildingIds: readonly string[];
}

/**
 * One undoable zone edit (spec Z-17, save v9): the zone order before the edit, the earlier versions of
 * every zone the edit changed or removed, and the ordinal it started from. Zones the edit created are
 * simply absent from `order`. Undo restores exactly the state before that edit.
 */
export interface ZoneUndoRecord {
  readonly order: readonly string[];
  readonly previous: readonly Zone[];
  readonly nextZoneOrdinal: number;
}
