import type { Dispatch, ReactNode } from "react";

import type { BuildingKind } from "../content/buildingConfig";
import type { GameSpeed, GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import type { PalisadePath } from "../world/palisadeGeometry";

export interface GameProviderProps {
  children: ReactNode;
}

export type GameAction = import("../engine/autoplayFoodTransient").FoodTransientMetadata & import("../engine/autoplayMaterialTypes").MaterialPlacementMetadata & GameCommand;
type GameCommand =
  | { readonly type: "set_building_operation"; readonly buildingId: string; readonly paused: boolean }
  | { readonly type: "record_autoplay_food_confirmation" }
  | { readonly type: "restart_settlement" }
  | { readonly type: "start_new_game"; readonly scenarioId: string }
  | { readonly type: "load_saved_state"; readonly state: GameState }
  | { readonly type: "merge_houses"; readonly sourceBuildingId: string; readonly targetBuildingId: string }
  | {
      readonly type: "commit_simulation_state";
      readonly previousState: GameState;
      readonly nextState: GameState;
    }
  | {
      readonly type: "place_building";
      readonly kind: BuildingKind;
      readonly tx: number;
      readonly ty: number;
      readonly autoplayFoodObservation?: boolean;
    }
  | {
      readonly type: "place_road_line";
      readonly start: TileCoordinate;
      readonly destination: TileCoordinate;
    }
  | {
      readonly type: "remove_road";
      readonly tx: number;
      readonly ty: number;
    }
  | {
      readonly type: "demolish_house";
      readonly buildingId: string;
    }
  | {
      /** F0-B EV-6: rebuild a burnt house from stage 2. */
      readonly type: "rebuild_house";
      readonly buildingId: string;
    }
  | {
      /** F0-C1 FC-2: the lord's answer to the Great Famine. */
      readonly type: "famine_response";
      readonly choice: import("../content/chapterConfig").FamineResponseChoice;
    }
  | {
      /** F0-C1 FC-3: the lord's answer to a petition. */
      readonly type: "petition_response";
      readonly petitionId: string;
      readonly response: import("../content/chapterConfig").PetitionResponse;
    }
  | {
      readonly type: "cancel_construction";
      readonly siteId: string;
    }
  | {
      readonly type: "confirm_palisade_proclamation";
      readonly candidatePath: PalisadePath;
    }
  | { readonly type: "confirm_stone_town_proclamation" }
  /** Spec Z-5: paint a zone stroke (new zone, or merged into touching zones of the same kind). */
  | { readonly type: "zone_paint"; readonly kind: import("../zones/zone.types").ZoneKind; readonly stroke: import("../zones/zone.types").ZoneStroke }
  /** Spec Z-6: remove the stroke's cells from every zone. */
  | { readonly type: "zone_erase"; readonly stroke: import("../zones/zone.types").ZoneStroke }
  /** Spec Z-7. */
  | { readonly type: "zone_remove"; readonly id: string }
  /** Spec Z-17: undo the last zone_paint / zone_erase. */
  | { readonly type: "zone_undo_stroke" }
  | { readonly type: "set_wall_construction_priority"; readonly priority: import("../engine/constructionReserve").WallConstructionPriority };

export interface GameStoreContextValue {
  state: GameState;
  previousRenderState: Pick<GameState, "constructionSites" | "walkers">;
  interpolationAlpha: () => number;
  dispatch: Dispatch<GameAction>;
  speed: GameSpeed;
  setSpeed: (speed: GameSpeed) => void;
}
