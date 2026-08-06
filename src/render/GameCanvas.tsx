import { useRef, useState } from "react";

import type { OverlayMode } from "../engine/engine.types";
import { DEFAULT_PLACEMENT_TOOL } from "./interactions";
import type { PlacementTool } from "./renderer";
import { useGameStore } from "../state/gameStore";
import { BuildingInspector, type HoveredBuilding } from "./BuildingInspector";
import { useGameCanvasRuntime } from "./useGameCanvasRuntime";

type GameCanvasProps = { readonly selectedTool?: PlacementTool | null; readonly overlayMode?: OverlayMode };

export function GameCanvas({ selectedTool = DEFAULT_PLACEMENT_TOOL, overlayMode = "none" }: GameCanvasProps) {
  const { state, dispatch } = useGameStore();
  const [hoveredBuilding, setHoveredBuilding] = useState<HoveredBuilding | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useGameCanvasRuntime({
    canvasRef,
    state,
    dispatch,
    selectedTool,
    overlayMode,
    setHoveredBuilding,
  });

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" aria-label="Simulation canvas" />
      <BuildingInspector state={state} hover={hoveredBuilding} />
    </>
  );
}
