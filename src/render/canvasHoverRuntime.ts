import { getTile } from '../world/grid';
import { causeHoverTarget } from './causeMapInteraction';
import { townLandscapeAssetReady } from './townLandscapeAssets';
import { townLandscapeAt, TOWN_LANDSCAPE_TOOLTIP } from './townLandscape';
import { clientToCanvas } from './camera';
import { hoveredBuildingPosition } from './canvasRuntime';
import { pointerTile } from './interactions';
import { updateCameraEdgePoint, type CameraInputState, type GameCanvasRuntimeInput } from './gameCanvasRuntimeInput';
import type { CanvasMutableRefs } from './canvasRuntimeRefs';
import type { GameState } from '../engine/engine.types';
import type { PlacementTool } from './renderer';

export function updateCanvasHover(event: MouseEvent, canvas: HTMLCanvasElement, refs: CanvasMutableRefs,
  cameraInput: CameraInputState, state: GameState, selectedTool: PlacementTool | null,
  setHoveredBuilding: GameCanvasRuntimeInput['setHoveredBuilding']): void {
  const bounds = canvas.getBoundingClientRect();
  const point = clientToCanvas(event, bounds);
  updateCameraEdgePoint(cameraInput, point);
  refs.hoverRef.current = pointerTile(event, bounds, refs.cameraRef.current);
  const ground = refs.hoverRef.current === null ? null : getTile(state, refs.hoverRef.current);
  const landscape = ground === null ? null : townLandscapeAt(state, ground);
  canvas.title = selectedTool === null && landscape !== null && townLandscapeAssetReady(landscape) ? TOWN_LANDSCAPE_TOOLTIP : '';
  const target = causeHoverTarget(state, refs.cameraRef.current, point, selectedTool, refs.hoverRef.current);
  refs.hoverRef.current = target.tile;
  setHoveredBuilding(target.buildingId === null ? null : { buildingId: target.buildingId,
    clusterCount: target.clusterCount, ...hoveredBuildingPosition(event, bounds) });
}
