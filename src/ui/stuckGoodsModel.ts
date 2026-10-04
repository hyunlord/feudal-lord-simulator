import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { InputIntent } from "../input/inputIntent";
import type { TileCoordinate } from "../world/grid";

// UI-AUDIT-1: where a stuck pile lies, in the words the HUD's chip uses ("북쪽 헛간에 …"). LM-R1: the piles themselves
// are the engine's (FIX-11 `stuckStock`, read through `hud/stuckStockView.ts`); the screen-side guess that stood here
// before the engine kept a reason (roads, receivers, a per-session memory) is gone.

export type Compass = "north" | "northEast" | "east" | "southEast" | "south" | "southWest" | "west" | "northWest" | "centre";
/** Within this many tiles of the town centre a building is "by the keep", not in a direction. */
export const STUCK_CENTRE_RADIUS_TILES = 4;
const COMPASS: readonly Compass[] = ["east", "southEast", "south", "southWest", "west", "northWest", "north", "northEast"];

function footprintCentre(building: Building): TileCoordinate {
  const size = buildingFootprint(building);
  return { tx: building.tx + Math.floor((size.width - 1) / 2), ty: building.ty + Math.floor((size.height - 1) / 2) };
}

/** The town's centre: the keep, else the church or chapel, else the buildings' mean, else the map's middle. */
export function townCentre(state: GameState): TileCoordinate {
  const seat = state.buildings.find(building => building.kind === "keep")
    ?? state.buildings.find(building => building.kind === "church" || building.kind === "chapel");
  if (seat !== undefined) return footprintCentre(seat);
  if (state.buildings.length === 0) return { tx: Math.floor(state.width / 2), ty: Math.floor(state.height / 2) };
  const sum = state.buildings.reduce((total, building) => ({ tx: total.tx + building.tx, ty: total.ty + building.ty }), { tx: 0, ty: 0 });
  return { tx: Math.round(sum.tx / state.buildings.length), ty: Math.round(sum.ty / state.buildings.length) };
}

/**
 * Where `tile` lies from the town centre as the player sees it on the screen (the map is drawn 2:1 isometric, so
 * screen up is -tx -ty; the words follow the screen, not the grid axes).
 */
export function compassFromCentre(state: GameState, tile: TileCoordinate): Compass {
  const centre = townCentre(state);
  const dx = tile.tx - centre.tx;
  const dy = tile.ty - centre.ty;
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= STUCK_CENTRE_RADIUS_TILES) return "centre";
  // iso.ts tileToScreen: sx = (tx - ty) * 32, sy = (tx + ty) * 16.
  const angle = Math.atan2((dx + dy) * 16, (dx - dy) * 32);
  const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return COMPASS[sector]!;
}

/** The chip's press: the camera to the building. */
export function stuckGoodsLookAtIntent(row: { readonly tile: TileCoordinate }): InputIntent {
  return { kind: "lookAt", tile: row.tile };
}
