import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { placeDiagnosticCard } from "./DiagnosticCard";
import {
  resolveBuildingPlacementAttempt,
  type PlacementAttemptOutcome,
} from "./interactions";
import type { Point } from "./camera";
import type { PlacementTool } from "./renderer";
import { selectWorldAtTile, type AnchoredWorldSelection } from "./worldSelection";

type ClickResolution =
  | { readonly kind: "ignored"; readonly clearSuppression: boolean }
  | { readonly kind: "selection"; readonly selection: AnchoredWorldSelection | null }
  | { readonly kind: "placement"; readonly attempt: PlacementAttemptOutcome };

type ClickResolutionInput = Readonly<{
  suppressClick: boolean;
  spacePressed: boolean;
  dragMode: "none" | "pan" | "road";
  hover: TileCoordinate | null;
  selectedTool: PlacementTool | null;
  state: GameState;
  point: Point;
  viewport: { readonly width: number; readonly height: number };
  nowMs: number;
}>;

export function resolveCanvasClick(input: ClickResolutionInput): ClickResolution {
  if (input.suppressClick) return { kind: "ignored", clearSuppression: true };
  if (input.spacePressed || input.dragMode !== "none" || input.hover === null) {
    return { kind: "ignored", clearSuppression: false };
  }
  if (input.selectedTool === null) {
    const selected = selectWorldAtTile(input.state, input.hover);
    if (selected === null) return { kind: "selection", selection: null };
    const position = placeDiagnosticCard(
      input.viewport,
      { x: input.point.x - 12, y: input.point.y - 12, width: 24, height: 24 },
      { width: 300, height: 260 },
    );
    return { kind: "selection", selection: { ...selected, position } };
  }
  if (input.selectedTool === "road") {
    return { kind: "ignored", clearSuppression: false };
  }
  return {
    kind: "placement",
    attempt: resolveBuildingPlacementAttempt({
      state: input.state,
      tool: input.selectedTool,
      tile: input.hover,
      nowMs: input.nowMs,
    }),
  };
}
