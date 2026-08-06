import type { GameState } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import type { TileCoordinate } from "../world/grid";
import type { PlacementTool } from "./renderer";
import { selectWorldAtTile } from "./worldSelection";

type CanvasContextMenuInput = Readonly<{
  state: GameState;
  tile: TileCoordinate | null;
  selectedTool: PlacementTool | null;
}>;

type CanvasContextMenuResolution = Readonly<{
  action: GameAction | null;
  clearSelection: true;
}>;

export function resolveCanvasContextMenu(input: CanvasContextMenuInput): CanvasContextMenuResolution {
  if (input.tile === null) return { action: null, clearSelection: true };
  const selection = selectWorldAtTile(input.state, input.tile);
  return {
    action: selection?.kind === "construction_site"
      ? { type: "cancel_construction", siteId: selection.siteId }
      : null,
    clearSelection: true,
  };
}
