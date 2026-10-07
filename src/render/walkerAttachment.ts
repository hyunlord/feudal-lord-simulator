import type { ArtPoint } from './art/artContract';
import { drawCroppedWorldSprite } from './worldSprite';

/** Restore the author's three-pixel hand over a held item, preserving the original painted grip. */
export function restoreSourceHand(context: CanvasRenderingContext2D, body: HTMLImageElement,
  cellX: number, cellY: number, grip: ArtPoint, pad: number): void {
  drawCroppedWorldSprite(context, body,
    { x: cellX + grip.x - 1, y: cellY + grip.y - 1, width: 3, height: 3 },
    { x: pad + grip.x - 1, y: pad + grip.y - 1, width: 3, height: 3 }, false, true);
}
