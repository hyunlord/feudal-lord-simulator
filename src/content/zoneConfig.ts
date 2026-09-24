import type { BuildingKind } from "./buildingConfig";
import type { ZoneKind } from "../zones/zone.types";

/**
 * Zone kinds and placement rules v0 (spec Z-11). All six kinds can be painted; only burgage and arable
 * carry rules yet. Pasture, hay meadow, woodland and orchard rules come with C5/C1c.
 */
export interface ZoneKindConfig {
  readonly kind: ZoneKind;
  /** Hard rule: the kind can never own a cell whose centre lies inside the town wall (Z-9). */
  readonly forbiddenInsideWall: boolean;
}

export const ZONE_KIND_CONFIG = {
  burgage: { kind: "burgage", forbiddenInsideWall: false },
  arable: { kind: "arable", forbiddenInsideWall: true },
  pasture: { kind: "pasture", forbiddenInsideWall: false },
  hay_meadow: { kind: "hay_meadow", forbiddenInsideWall: false },
  woodland_common: { kind: "woodland_common", forbiddenInsideWall: false },
  orchard: { kind: "orchard", forbiddenInsideWall: false },
} as const satisfies Record<ZoneKind, ZoneKindConfig>;

/**
 * While at least one zone exists, these buildings need their whole footprint inside a zone of the
 * given kind. Every other building ignores zones (workshops, wells, markets, churches…).
 */
export const ZONE_PLACEMENT_RULES = {
  house: "burgage",
  wheat_farm: "arable",
} as const satisfies Partial<Record<BuildingKind, ZoneKind>>;

/** Z-17: how many paint/erase edits `zone_undo_stroke` can step back through. */
export const ZONE_UNDO_LIMIT = 20;

/** Stroke limits (Z-2). Brush radius and points are in tiles. */
export const ZONE_STROKE_LIMITS = {
  maxPoints: 256,
  minBrushRadius: 0.5,
  maxBrushRadius: 8,
} as const;

/** Frontage parcels (Z-12): strip depth along the road normal, sampled every quarter tile. */
export const PARCEL_RULES = {
  depthTiles: 3.2,
  depthStep: 0.25,
  minWidth: 2,
  maxWidth: 4,
} as const;

/** ZoneFillAgent v0 (Z-14): at most this many house plots under construction at once. */
export const ZONE_FILL_MAX_PARCELS = 10;
