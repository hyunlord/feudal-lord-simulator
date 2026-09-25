import type { Dispatch, SetStateAction } from "react";

import type { GameState } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import type { PlacementTool } from "./renderer";
import type { AnchoredWorldSelection } from "./worldSelection";
import { pickTile } from "./picking";
import { resolveCanvasContextMenu } from "./canvasContextMenuResolution";
import type { WorldPoint } from "../input/inputIntent";

type AimedCancelInput = Readonly<{
  world: WorldPoint;
  dispatch: Dispatch<GameAction>;
  selectedToolRef: { current: PlacementTool | null };
  setSelection: Dispatch<SetStateAction<AnchoredWorldSelection | null>>;
  stateRef: { current: GameState };
}>;

/** `cancel` aimed at the map with no gesture to drop (right click): cancels the construction site there. */
export function handleAimedCancel(input: AimedCancelInput): void {
  const resolution = resolveCanvasContextMenu({
    state: input.stateRef.current,
    tile: pickTile(input.world),
    selectedTool: input.selectedToolRef.current,
  });
  if (resolution.action !== null) input.dispatch(resolution.action);
  input.setSelection(null);
}
