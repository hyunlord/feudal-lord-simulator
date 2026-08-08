import { useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { OverlayMode } from "../engine/engine.types";
import { DEFAULT_PLACEMENT_TOOL } from "./interactions";
import type { PlacementTool } from "./renderer";
import { useGameStore } from "../state/gameStore";
import { BuildingInspector, type HoveredBuilding } from "./BuildingInspector";
import { useGameCanvasRuntime } from "./useGameCanvasRuntime";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import type { PalisadeDraftState } from "./palisadeDraftInteraction";
import { DiagnosticCard, type DiagnosticCardModel } from "./DiagnosticCard";
import type { AnchoredWorldSelection } from "./worldSelection";
import { houseDiagnosisModel } from "../ui/houseDiagnosisModel";
import { walkerDiagnosisModel } from "../ui/walkerDiagnosisModel";
import {
  constructionCancellationDisabledReason,
  constructionSiteCardModel,
} from "../ui/constructionSiteCardModel";
import type { DistributorRouteHistory } from "../ui/distributorRouteHistory";

type GameCanvasProps = {
  readonly selectedTool?: PlacementTool | null;
  readonly overlayMode?: OverlayMode;
  readonly highlightedHouseIds?: readonly string[];
  readonly distributorRouteHistory?: DistributorRouteHistory | null;
  readonly palisadeDraft?: PalisadeDraftState | null;
  readonly houseMaterialWave?: HouseMaterialWave | null;
  readonly palisadeCeremonyStartedAtMs?: number | null;
  readonly onPalisadeDraftChange?: Dispatch<SetStateAction<PalisadeDraftState | null>>;
  readonly onPalisadeDraftCancel?: () => void;
};

export function GameCanvas({
  selectedTool = DEFAULT_PLACEMENT_TOOL,
  overlayMode = "none",
  highlightedHouseIds = [],
  distributorRouteHistory = null,
  palisadeDraft = null,
  houseMaterialWave = null,
  palisadeCeremonyStartedAtMs = null,
  onPalisadeDraftChange,
  onPalisadeDraftCancel,
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
    palisadeDraft,
    houseMaterialWave,
    palisadeCeremonyStartedAtMs,
    onPalisadeDraftChange,
    onPalisadeDraftCancel,
  });

  let cardModel: DiagnosticCardModel | null = null;
  if (selection?.kind === "building") {
    const value = houseDiagnosisModel(state, selection.buildingId, distributorRouteHistory);
    if (value !== null) cardModel = { kind: "house", value };
  } else if (selection?.kind === "walker") {
    const value = walkerDiagnosisModel(state, selection.walkerId);
    if (value !== null) cardModel = { kind: "walker", value };
  } else if (selection?.kind === "construction_site") {
    const site = state.constructionSites.find((candidate) => candidate.id === selection.siteId);
    if (site !== undefined) {
      cardModel = {
        kind: "construction_site",
        value: constructionSiteCardModel(site, {
          constructionSites: state.constructionSites,
          materialDiagnosisState: {
            buildings: state.buildings,
            walkers: state.walkers,
          },
          cancellationDisabledReason: state.palisade === null
            ? null
            : constructionCancellationDisabledReason(site),
        }),
      };
    }
  }

  const cancelConstruction = (siteId: string) => {
    dispatch({ type: "cancel_construction", siteId });
    setSelection(null);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className={selectedTool === null ? "game-canvas" : "game-canvas game-canvas--placement-armed"}
        aria-label="Simulation canvas"
      />
      <BuildingInspector state={state} hover={selection === null ? hoveredBuilding : null} />
      {selection !== null && cardModel !== null ? (
        <DiagnosticCard
          model={cardModel}
          onCancelConstruction={cancelConstruction}
          position={selection.position}
        />
      ) : null}
    </>
  );
}
