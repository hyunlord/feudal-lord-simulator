import { predictionStateKey } from '../ui/predictionCache';
import type { GameState } from '../engine/engine.types';
import type { TileCoordinate } from '../world/grid';
import { buildingPlacementPrediction, roadPlacementPrediction } from '../ui/placementPrediction';
import { roadConnectsConstructionSite } from '../ui/constructionAccessModel';
import { A_TRIPLE_PRIME_ROAD_COPY } from '../ui/aTriplePrimeRoadCopy';
import type { PlacementPrediction } from '../ui/predictionTypes';
import type { PredictionPresentation } from '../ui/PredictionPanel';
import type { PlacementTool } from './renderer';
import type { PlacementPreview } from './overlays';
import type { CameraState } from './camera';
import { placementPreview } from './interactions';
import { TILE_W, tileToScreen } from './iso';
import { placementChipModel } from '../ui/placementChip';
import { predictPlacementLedger } from '../engine/placementLedger';
import { PLACEMENT_REASON_LABELS } from '../ui/predictionRegistry';

let lastPreview: { readonly stateKey: string; readonly key: string; readonly preview: PlacementPreview } | null = null;

export function cachedPlacementPreview(state: GameState, tool: PlacementTool | null,
  tile: TileCoordinate | null, roadStart: TileCoordinate | null, selectedConstructionSiteId: string | null = null): PlacementPreview {
  const key = `${tool}:${tile?.tx}:${tile?.ty}:${roadStart?.tx}:${roadStart?.ty}:${selectedConstructionSiteId}`;
  const stateKey = tool === null || tile === null ? '' : `${predictionStateKey(state)}:${selectedConstructionSiteId === null ? '' : state.tick}`;
  if (lastPreview?.key === key && lastPreview.stateKey === stateKey) return lastPreview.preview;
  const preview = placementPreview(state, tool, tile, roadStart);
  const basePrediction: PlacementPrediction | undefined = tool === null || tile === null ? undefined
    : tool === 'road' ? roadPlacementPrediction(state, preview.roadPath) : buildingPlacementPrediction(state, tool, tile);
  const selectedSite = selectedConstructionSiteId === null ? undefined
    : state.constructionSites.find(site => site.id === selectedConstructionSiteId);
  const prediction: PlacementPrediction | undefined = basePrediction === undefined ? undefined
    : tool === 'road' && selectedSite !== undefined && roadConnectsConstructionSite(state, selectedSite, preview.roadPath)
      ? { ...basePrediction, lines: [...basePrediction.lines,
        { id: 'construction-road-connection', tone: 'positive', text: A_TRIPLE_PRIME_ROAD_COPY.connectsConstructionSite }] }
      : basePrediction;
  // UX-3 S-53: the cursor chip (three lines) is built with the preview, so it is cached with it.
  const chip = tool === null || tile === null ? undefined : placementChipModel(state, { tool, ...(preview.marks === undefined ? {} : { marks: preview.marks }),
    ...(tool === 'road' ? {} : { ledger: predictPlacementLedger(state, tool, tile) }),
    timberCost: preview.timberCost ?? null, reachHouses: prediction?.range === null || prediction === undefined ? null : prediction.houseIds.length,
    failureLabel: tool === 'road' && preview.reason !== null && preview.reason in PLACEMENT_REASON_LABELS ? PLACEMENT_REASON_LABELS[preview.reason as keyof typeof PLACEMENT_REASON_LABELS] : null });
  const result = prediction === undefined ? preview : { ...preview, prediction, ...(chip === undefined ? {} : { chip }) };
  lastPreview = { stateKey, key, preview: result };
  return result;
}

export function createPredictionPublisher(publish: (value: PredictionPresentation | null) => void) {
  let previous: PredictionPresentation | null = null;
  return (preview: PlacementPreview, camera: CameraState) => {
    if (preview.prediction === undefined || preview.cursor === null) {
      if (previous !== null) { previous = null; publish(null); }
      return;
    }
    const anchor = tileToScreen(preview.cursor.tx, preview.cursor.ty);
    // UX-3: the chip stands clear of the ghost — right of the footprint's right corner and its one-tile ring.
    const right = preview.chip === undefined ? anchor.sx + 28 / camera.zoom
      : Math.max(...(preview.footprint.length > 0 ? preview.footprint : [preview.cursor]).map(tile => tileToScreen(tile.tx, tile.ty).sx)) + TILE_W + 8 / camera.zoom;
    const position = { x: Math.round(right * camera.zoom + camera.panX),
      y: Math.round(anchor.sy * camera.zoom + camera.panY + (preview.chip === undefined ? 20 : -36)) };
    if (previous?.lines === preview.prediction.lines && previous.chip === preview.chip && previous.position.x === position.x && previous.position.y === position.y) return;
    previous = { lines: preview.prediction.lines, position, ...(preview.chip === undefined ? {} : { chip: preview.chip }) };
    publish(previous);
  };
}
