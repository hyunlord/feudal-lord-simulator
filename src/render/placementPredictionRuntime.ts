import { predictionStateKey } from '../ui/predictionCache';
import type { GameState } from '../engine/engine.types';
import type { TileCoordinate } from '../world/grid';
import { buildingPlacementPrediction, roadPlacementPrediction } from '../ui/placementPrediction';
import type { PlacementPrediction } from '../ui/predictionTypes';
import type { PredictionPresentation } from '../ui/PredictionPanel';
import type { PlacementTool } from './renderer';
import type { PlacementPreview } from './overlays';
import type { CameraState } from './camera';
import { placementPreview } from './interactions';
import { tileToScreen } from './iso';

let lastPreview: { readonly stateKey: string; readonly key: string; readonly preview: PlacementPreview } | null = null;

export function cachedPlacementPreview(state: GameState, tool: PlacementTool | null,
  tile: TileCoordinate | null, roadStart: TileCoordinate | null): PlacementPreview {
  const key = `${tool}:${tile?.tx}:${tile?.ty}:${roadStart?.tx}:${roadStart?.ty}`;
  const stateKey = tool === null || tile === null ? '' : predictionStateKey(state);
  if (lastPreview?.key === key && lastPreview.stateKey === stateKey) return lastPreview.preview;
  const preview = placementPreview(state, tool, tile, roadStart);
  const prediction: PlacementPrediction | undefined = tool === null || tile === null ? undefined
    : tool === 'road' ? roadPlacementPrediction(state, preview.roadPath) : buildingPlacementPrediction(state, tool, tile);
  const result = prediction === undefined ? preview : { ...preview, prediction };
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
    const position = { x: Math.round(anchor.sx * camera.zoom + camera.panX + 28),
      y: Math.round(anchor.sy * camera.zoom + camera.panY + 20) };
    if (previous?.lines === preview.prediction.lines && previous.position.x === position.x && previous.position.y === position.y) return;
    previous = { lines: preview.prediction.lines, position };
    publish(previous);
  };
}
