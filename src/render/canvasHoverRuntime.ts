import { causeHoverTarget } from './causeMapInteraction';
import { canvasToWorld, type Point } from './camera';
import { hoveredBuildingPosition } from './canvasRuntime';
import { pickTile } from './picking';
import type { GameCanvasRuntimeInput } from './gameCanvasRuntimeInput';
import type { CanvasMutableRefs } from './canvasRuntimeRefs';
import type { GameState } from '../engine/engine.types';
import type { PlacementTool } from './renderer';

/**
 * The pointer is at `point` (canvas pixels; the `point` intent): hover tile, cause marker under it, hover card. The
 * town landscape line is no longer a hover tooltip (B9): selecting the tile shows it (canvasClickRuntime.ts).
 */
export function updateCanvasHover(point: Point, canvas: HTMLCanvasElement, refs: CanvasMutableRefs,
  state: GameState, selectedTool: PlacementTool | null,
  setHoveredBuilding: GameCanvasRuntimeInput['setHoveredBuilding']): void {
  const bounds = canvas.getBoundingClientRect();
  refs.hoverRef.current = pickTile(canvasToWorld(point, refs.cameraRef.current));
  const target = causeHoverTarget(state, refs.cameraRef.current, point, selectedTool, refs.hoverRef.current);
  refs.hoverRef.current = target.tile;
  setHoveredBuilding(target.buildingId === null ? null : { buildingId: target.buildingId,
    clusterCount: target.clusterCount, ...hoveredBuildingPosition({ clientX: point.x + bounds.left, clientY: point.y + bounds.top }, bounds) });
}
