import type { GameState } from '../engine/engine.types';
import { getTile, type TileCoordinate } from '../world/grid';
import { canvasToWorld, type CameraState, type Point } from './camera';
import { causeMarkersForState } from './causeMapOverlay';
import { hitCauseMarker } from './causeMarkerLayout';
import type { PlacementTool } from './renderer';

export function causeMarkerAtCanvasPoint(state: GameState, camera: CameraState, point: Point) {
  return hitCauseMarker(causeMarkersForState(state, camera.zoom), canvasToWorld(point, camera), camera.zoom);
}

export function causeHoverTarget(state: GameState, camera: CameraState, point: Point,
  selectedTool: PlacementTool | null, groundTile: TileCoordinate | null) {
  const marker = selectedTool === null ? causeMarkerAtCanvasPoint(state, camera, point) : null;
  const building = state.buildings.find(item => item.id === marker?.buildingIds[0]);
  const tile = building === undefined ? groundTile : { tx: building.tx, ty: building.ty };
  return { tile, buildingId: building?.id ?? (tile === null ? null : getTile(state, tile)?.buildingId ?? null),
    clusterCount: marker?.buildingIds.length ?? 1 };
}
