import type { WalkerPresentationDirection } from './walkerPresentation';
import { walkerSheet } from './walkerLook';
import { composedCell, WALKER_COMPOSED_CELL, WALKER_PAD, WALKER_FIGURE_PX } from './walkerComposer';
import { drawCroppedWorldSprite } from './worldSprite';

/** Presentation-only figures share the normal compositor without entering the simulated walker pool. */
export function drawExplicitWalkerLook(context: CanvasRenderingContext2D, sheetId: string, propId: string,
  direction: WalkerPresentationDirection, gaitFrame: 0 | 1, x: number, y: number): boolean {
  const frame = walkerSheet(sheetId).frames.find(frame => frame.direction === direction && frame.gaitFrame === gaitFrame);
  if (!frame) return false;
  const cell = composedCell(sheetId, propId, null, direction, gaitFrame);
  if (!cell) return false;
  const factor = WALKER_FIGURE_PX / frame.figureHeight;
  drawCroppedWorldSprite(context, cell, { x: 0, y: 0, width: WALKER_COMPOSED_CELL, height: WALKER_COMPOSED_CELL }, {
    x: x - (WALKER_PAD + frame.foot.x) * factor, y: y - (WALKER_PAD + frame.foot.y) * factor,
    width: WALKER_COMPOSED_CELL * factor, height: WALKER_COMPOSED_CELL * factor,
  }, false, true);
  return true;
}
