import { PredictionPanel, type PredictionPresentation } from "../ui/PredictionPanel";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { houseProgressModel } from "../ui/houseProgressModel";
import { KO_UI } from "../content/locale.ko";
import type { OverlayMode } from "../engine/engine.types";
import { DEFAULT_PLACEMENT_TOOL } from "./interactions";
import type { PlacementTool } from "./renderer";
import { useGameStore } from "../state/gameStore";
import { buildingInspectorModel } from "./buildingInspectorModel";
import { BuildingInspector, buildingCauseLine, type HoveredBuilding } from "./BuildingInspector";
import { useGameCanvasRuntime } from "./useGameCanvasRuntime";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import type { PalisadeDraftState } from "./palisadeDraftInteraction";
import type { ZoneBrushTool } from "./zoneBrushInteraction";
import { DiagnosticCard, type DiagnosticCardModel } from "./DiagnosticCard";
import type { AnchoredWorldSelection } from "./worldSelection";
import { houseDiagnosisModel } from "../ui/houseDiagnosisModel";
import { walkerDiagnosisModel } from "../ui/walkerDiagnosisModel";
import {
  constructionCancellationDisabledReason,
  constructionSiteCardModel,
} from "../ui/constructionSiteCardModel";
import type { DistributorRouteHistory } from "../ui/distributorRouteHistory";
import type { StoreStockHistory } from "../ui/storeStockHistory";
import { storeInspectorModel } from "../ui/storeInspectorModel";
import { constructionBlockerLine } from "../ui/constructionBlockerLine";
import { PlacementConfirmBar } from "../ui/hud/PlacementConfirmBar";
import type { TileCoordinate } from "../world/grid";
import { getTile } from '../world/grid';

type GameCanvasProps = {
  readonly selectedTool?: PlacementTool | null;
  readonly overlayMode?: OverlayMode;
  readonly problemOnly?: boolean;
  readonly highlightedHouseIds?: readonly string[];
  readonly distributorRouteHistory?: DistributorRouteHistory | null;
  /** UX-3R2: the stores' weekly stock and cart history (the storage card). */
  readonly storeHistory?: StoreStockHistory | null;
  readonly palisadeDraft?: PalisadeDraftState | null;
  readonly houseMaterialWave?: HouseMaterialWave | null;
  readonly palisadeCeremonyStartedAtMs?: number | null;
  readonly onPalisadeDraftChange?: Dispatch<SetStateAction<PalisadeDraftState | null>>;
  readonly onPalisadeDraftCancel?: () => void;
  readonly zoneTool?: ZoneBrushTool | null;
  readonly onZoneRadiusChange?: (radius: number) => void;
  /** UX-3 S-30: the selection card holds the one panel slot — false (another panel took it, or Esc) drops it. */
  readonly selectionOpen?: boolean;
  readonly onSelectionChange?: (open: boolean) => void;
};

export function GameCanvas({
  selectedTool = DEFAULT_PLACEMENT_TOOL,
  overlayMode = "none",
  problemOnly = false,
  highlightedHouseIds = [],
  distributorRouteHistory = null,
  storeHistory = null,
  palisadeDraft = null,
  houseMaterialWave = null,
  palisadeCeremonyStartedAtMs = null,
  onPalisadeDraftChange,
  onPalisadeDraftCancel,
  zoneTool = null,
  onZoneRadiusChange,
  selectionOpen,
  onSelectionChange,
}: GameCanvasProps) {
  const { state, previousRenderState, interpolationAlpha, dispatch } = useGameStore();
  const [hoveredBuilding, setHoveredBuilding] = useState<HoveredBuilding | null>(null);
  const [selection, setSelection] = useState<AnchoredWorldSelection | null>(null);
  const [prediction, setPrediction] = useState<PredictionPresentation | null>(null);
  // UX-3R2 tablet placement: the tile a tap left the ghost on, waiting for the confirm bar (null: no bar).
  const [pendingPlacement, setPendingPlacement] = useState<TileCoordinate | null>(null);
  useEffect(() => { setPendingPlacement(null); }, [selectedTool]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasSelection = selection !== null;
  useEffect(() => { onSelectionChange?.(hasSelection); }, [hasSelection, onSelectionChange]);
  useEffect(() => { if (selectionOpen === false) setSelection(null); }, [selectionOpen]);

  useGameCanvasRuntime({
    canvasRef,
    setPrediction,
    state,
    previousRenderState,
    interpolationAlpha,
    dispatch,
    selectedTool,
    overlayMode,
    problemOnly,
    setHoveredBuilding,
    selection,
    setSelection,
    highlightedHouseIds,
    palisadeDraft,
    houseMaterialWave,
    palisadeCeremonyStartedAtMs,
    onPalisadeDraftChange,
    onPalisadeDraftCancel,
    zoneTool,
    onZoneRadiusChange,
    setPendingPlacement,
  });

  let cardModel: DiagnosticCardModel | null = null;
  if (selection?.kind === "building") {
    const value = houseDiagnosisModel(state, selection.buildingId, distributorRouteHistory);
    const store = value === null ? storeInspectorModel(state, selection.buildingId, storeHistory) : null;
    if (value !== null) cardModel = { kind: "house", value };
    else if (store !== null) cardModel = { kind: "store", value: store };
    else {
      const facility = buildingInspectorModel(state, selection.buildingId);
      if (facility !== null) cardModel = { kind: "building", value: facility };
    }
  } else if (selection?.kind === "walker") {
    const value = walkerDiagnosisModel(state, selection.walkerId);
    if (value !== null) cardModel = { kind: "walker", value };
  } else if (selection?.kind === "construction_site") {
    const site = state.constructionSites.find((candidate) => candidate.id === selection.siteId);
    if (site !== undefined) {
      cardModel = {
        kind: "construction_site",
        value: { blockerLine: constructionBlockerLine(state, site), ...constructionSiteCardModel(site, {
          constructionSites: state.constructionSites,
          materialDiagnosisState: {
            buildings: state.buildings,
            walkers: state.walkers,
            isRoad: tile => getTile(state, tile)?.hasRoad === true,
          },
          accessState: state,
          cancellationDisabledReason: state.palisade === null
            ? null
            : constructionCancellationDisabledReason(site),
        }) },
      };
    }
  }

  const demolishHouse = (buildingId: string) => {
    dispatch({ type: "demolish_house", buildingId });
    setSelection(null);
    setHoveredBuilding(null);
  };

  const cancelConstruction = (siteId: string) => {
    dispatch({ type: "cancel_construction", siteId });
    setSelection(null);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className={canvasCursorClass(selectedTool, zoneTool, hoveredBuilding !== null)}
        // UX-3R2: road / palisade click-click and the tablet ✓ (the input replays read it to drive the new baseline).
        data-line-tools="click-click"
        aria-label={KO_UI.simulationCanvas}
      />
      {prediction === null ? null : <PredictionPanel {...prediction} />}
      {pendingPlacement !== null && selectedTool !== null && selectedTool !== "road" ? <PlacementConfirmBar /> : null}
      <BuildingInspector state={state} hover={selectedTool === null && zoneTool === null && selection === null ? hoveredBuilding : null} />
      {selection !== null && cardModel !== null ? (
        <DiagnosticCard
          model={cardModel}
          {...(selection.kind !== 'building' || cardModel.kind !== 'building' ? {} : {
            buildingOperation: { paused: state.buildings.find(building => building.id === selection.buildingId)?.operationPaused === true,
              onToggle: () => dispatch({ type: 'set_building_operation', buildingId: selection.buildingId,
                paused: state.buildings.find(building => building.id === selection.buildingId)?.operationPaused !== true }) },
          })}
          causeLine={selection.kind === 'building' ? buildingCauseLine(state, selection.buildingId) : null}
          causeSummary={selection.kind === 'building' ? houseProgressModel(state, selection.buildingId) : null}
          onClose={() => { setSelection(null); setHoveredBuilding(null); }}
          onCancelConstruction={cancelConstruction}
          onDemolishHouse={demolishHouse}
          onMergeHouses={(sourceBuildingId, targetBuildingId) => {
            dispatch({ type: "merge_houses", sourceBuildingId, targetBuildingId });
            setHoveredBuilding(null);
          }}
          position={selection.position}
        />
      ) : null}
    </>
  );
}

/** UX-2 cursor art by the armed tool: select, inspect (a building under the pointer), road, zone brush, placement
 * (valid / invalid from the frame's `data-placement`). */
export function canvasCursorClass(selectedTool: PlacementTool | null, zoneTool: ZoneBrushTool | null, overBuilding: boolean): string {
  if (zoneTool !== null) return "game-canvas game-canvas--placement-armed game-canvas--zone";
  if (selectedTool === "road") return "game-canvas game-canvas--placement-armed game-canvas--road";
  if (selectedTool !== null) return "game-canvas game-canvas--placement-armed game-canvas--place";
  return overBuilding ? "game-canvas game-canvas--inspect" : "game-canvas";
}
