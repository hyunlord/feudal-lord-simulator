import { buildGroundCover } from "./groundCoverLayout";
import type { GameState } from "../engine/engine.types";
import { getTile } from "../world/grid";
import { isPointInsidePalisade } from "../world/palisadeGeometry";
import type { Tile } from "../world/world.types";

export type TownLandscapeKind = "vegetable" | "orchard" | "pasture";
export const TOWN_LANDSCAPE_TOOLTIP = "경관 장식 · 생산·통행 효과 없음 · 자유롭게 건설 가능";

/** A sparse visual use of vacant land; never a simulation object or occupancy. */
export function townLandscapeAt(state: GameState, tile: Tile): TownLandscapeKind | null {
  const wall = state.palisade;
  if (tile.terrain !== "grass" || tile.hasRoad || tile.buildingId !== null || wall === null) return null;
  const blockX = Math.floor(tile.tx / 8), blockY = Math.floor(tile.ty / 8);
  const hash = Math.imul(blockX + state.seed, 374761393) ^ Math.imul(blockY, 668265263);
  const localX = 2 + ((hash >>> 3) % 3), localY = 2 + ((hash >>> 7) % 3);
  if (tile.tx % 8 < localX || tile.tx % 8 > localX + 1 || tile.ty % 8 < localY || tile.ty % 8 > localY + 1) return null;
  if (wall.segments.length === 0 || !wall.segments.every(segment => segment.completed && segment.material === "stone")) return null;
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const neighbor = getTile(state, { tx: tile.tx + dx, ty: tile.ty + dy });
      if (neighbor === null || neighbor.terrain !== "grass" || neighbor.hasRoad || neighbor.buildingId !== null
        || !isPointInsidePalisade({ x: neighbor.tx + 0.5, y: neighbor.ty + 0.5 }, wall.polygon)
        || buildGroundCover({ tile: neighbor, seed: state.seed }).some(cover => cover.spriteKey !== "grass_tuft")) return null;
    }
  }
  switch ((hash >>> 0) % 3) {
    case 0: return "vegetable";
    case 1: return "orchard";
    default: return "pasture";
  }
}
