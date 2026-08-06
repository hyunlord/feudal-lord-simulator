import { useRef, useState } from "react";

import type { OverlayMode } from "../engine/engine.types";
import { DEFAULT_PLACEMENT_TOOL } from "./interactions";
import type { PlacementTool } from "./renderer";
import { useGameStore } from "../state/gameStore";
import { BuildingInspector, type HoveredBuilding } from "./BuildingInspector";
import { useGameCanvasRuntime } from "./useGameCanvasRuntime";
import { DiagnosticCard, type DiagnosticCardModel } from "./DiagnosticCard";
import type { AnchoredWorldSelection } from "./worldSelection";
import { houseDiagnosisModel } from "../ui/houseDiagnosisModel";
import { walkerDiagnosisModel } from "../ui/walkerDiagnosisModel";

type GameCanvasProps = {
  readonly selectedTool?: PlacementTool | null;
  readonly overlayMode?: OverlayMode;
  readonly highlightedHouseIds?: readonly string[];
};

export function GameCanvas({
  selectedTool = DEFAULT_PLACEMENT_TOOL,
  overlayMode = "none",
  highlightedHouseIds = [],
}: GameCanvasProps) {
  const { state, dispatch } = useGameStore();
  const [hoveredBuilding, setHoveredBuilding] = useState<HoveredBuilding | null>(null);
  const [selection, setSelection] = useState<AnchoredWorldSelection | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useGameCanvasRuntime({
    canvasRef,
    state,
    dispatch,
    selectedTool,
    overlayMode,
    setHoveredBuilding,
    selection,
    setSelection,
    highlightedHouseIds,
  });

  let cardModel: DiagnosticCardModel | null = null;
  if (selection?.kind === "building") {
    const value = houseDiagnosisModel(state, selection.buildingId);
    if (value !== null) cardModel = { kind: "house", value };
  } else if (selection?.kind === "walker") {
    const value = walkerDiagnosisModel(state, selection.walkerId);
    if (value !== null) cardModel = { kind: "walker", value };
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className={selectedTool === null ? "game-canvas" : "game-canvas game-canvas--placement-armed"}
        aria-label="Simulation canvas"
      />
      <BuildingInspector state={state} hover={hoveredBuilding} />
      {selection !== null && cardModel !== null ? (
        <DiagnosticCard model={cardModel} position={selection.position} />
      ) : null}
    </>
  );
}
