import type { Dispatch, ReactNode } from "react";

import type { BuildingKind } from "../content/buildingConfig";
import type { GameSpeed, GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import type { PalisadePath } from "../world/palisadeGeometry";

export interface GameProviderProps {
  children: ReactNode;
}

export type GameAction =
  | { readonly type: "advance_tick" }
  | { readonly type: "advance_frame"; readonly speed: GameSpeed }
  | {
      readonly type: "place_building";
      readonly kind: BuildingKind;
      readonly tx: number;
      readonly ty: number;
    }
  | {
      readonly type: "place_road_line";
      readonly start: TileCoordinate;
      readonly destination: TileCoordinate;
    }
  | {
      readonly type: "cancel_construction";
      readonly siteId: string;
    }
  | {
      readonly type: "confirm_palisade_proclamation";
      readonly candidatePath: PalisadePath;
    }
  | { readonly type: "confirm_stone_town_proclamation" };

export interface GameStoreContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}
