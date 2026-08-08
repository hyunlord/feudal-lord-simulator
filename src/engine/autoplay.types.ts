import type { TilePos } from "../agents/walker.types";
import type { BuildingKind } from "../content/buildingConfig";

export type AutoplayAction =
  | { readonly kind: "place_building"; readonly building: BuildingKind; readonly tx: number; readonly ty: number }
  | { readonly kind: "place_road"; readonly from: TilePos; readonly to: TilePos }
  | { readonly kind: "proclaim_era" }
  | { readonly kind: "none" };
