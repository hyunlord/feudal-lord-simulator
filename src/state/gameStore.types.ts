import type { Dispatch, ReactNode } from "react";

import type { BuildingKind } from "../content/buildingConfig";
import type { GameSpeed, GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";

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
    };

export interface GameStoreContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}
