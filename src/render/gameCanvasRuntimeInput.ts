import type { Dispatch, RefObject, SetStateAction } from "react";

import type { GameState, OverlayMode } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import type { HoveredBuilding } from "./BuildingInspector";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import type { PalisadeDraftState } from "./palisadeDraftInteraction";
import type { PlacementTool } from "./renderer";
import type { AnchoredWorldSelection } from "./worldSelection";

export type GameCanvasRuntimeInput = {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly state: GameState;
  readonly dispatch: Dispatch<GameAction>;
  readonly selectedTool: PlacementTool | null;
  readonly overlayMode: OverlayMode;
  readonly setHoveredBuilding: Dispatch<SetStateAction<HoveredBuilding | null>>;
  readonly selection: AnchoredWorldSelection | null;
  readonly setSelection: Dispatch<SetStateAction<AnchoredWorldSelection | null>>;
  readonly highlightedHouseIds: readonly string[];
  readonly palisadeDraft?: PalisadeDraftState | null;
  readonly houseMaterialWave?: HouseMaterialWave | null;
  readonly palisadeCeremonyStartedAtMs?: number | null;
  readonly onPalisadeDraftChange?: Dispatch<SetStateAction<PalisadeDraftState | null>> | undefined;
  readonly onPalisadeDraftCancel?: (() => void) | undefined;
};
