export const TILE_W = 64;
export const TILE_H = 32;

export interface ScreenPos {
  sx: number;
  sy: number;
}

export function tileToScreen(tx: number, ty: number): ScreenPos {
  return {
    sx: ((tx - ty) * TILE_W) / 2,
    sy: ((tx + ty) * TILE_H) / 2,
  };
}

export function screenToTile(
  sx: number,
  sy: number,
): { tx: number; ty: number } {
  return {
    tx: sy / TILE_H + sx / TILE_W,
    ty: sy / TILE_H - sx / TILE_W,
  };
}

export function depthKey(tx: number, ty: number): number {
  return tx + ty;
}
