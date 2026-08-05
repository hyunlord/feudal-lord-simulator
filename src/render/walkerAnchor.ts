import type { TilePos } from "../agents/walker.types";
import { TILE_H, screenToTile, tileToScreen } from "./iso";

export type WalkerVisualAnchor = {
  readonly tx: number;
  readonly ty: number;
  readonly sx: number;
  readonly sy: number;
};

const WALKER_FOOT_Y_OFFSET = TILE_H * 0.18;

export function walkerVisualAnchor(position: TilePos): WalkerVisualAnchor {
  const center = tileToScreen(position.tx, position.ty);
  const sy = center.sy + WALKER_FOOT_Y_OFFSET;
  const anchor = screenToTile(center.sx, sy);
  return { tx: anchor.tx, ty: anchor.ty, sx: center.sx, sy };
}
