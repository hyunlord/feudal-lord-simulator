import type { PalisadePath } from '../world/palisadeGeometry';
import type { TilePos } from "../agents/walker.types";
import type { BuildingKind } from "../content/buildingConfig";

export const AUTOPLAY_TICK_CADENCE = 120;

export type AutoplayAction = import("./autoplayFoodTransient").FoodTransientMetadata & import("./autoplayMaterialTypes").MaterialPlacementMetadata & AutoplayCommand;
type AutoplayCommand =
  | { readonly kind: "place_building"; readonly building: BuildingKind; readonly tx: number; readonly ty: number }
  | { readonly kind: "place_road"; readonly from: TilePos; readonly to: TilePos }
  | { readonly kind: "proclaim_era"; readonly candidatePath?: PalisadePath }
  | { readonly kind: "none" };
