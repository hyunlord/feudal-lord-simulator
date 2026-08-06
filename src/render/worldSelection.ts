import type { GameState } from "../engine/engine.types";
import { getTile, type TileCoordinate } from "../world/grid";
import { pickTile } from "./picking";
import { walkerVisualAnchor } from "./walkerAnchor";

export type WorldSelection =
  | { readonly kind: "building"; readonly buildingId: string }
  | { readonly kind: "walker"; readonly walkerId: string };

export type AnchoredWorldSelection = WorldSelection & {
  readonly position: { readonly x: number; readonly y: number };
};

export function selectWorldAtTile(
  state: Pick<GameState, "tiles" | "width" | "height" | "walkers">,
  tile: TileCoordinate,
): WorldSelection | null {
  const walker = [...state.walkers]
    .reverse()
    .find((candidate) => {
      const anchor = walkerVisualAnchor(candidate.position);
      const renderedTile = pickTile({ x: anchor.sx, y: anchor.sy });
      return renderedTile?.tx === tile.tx && renderedTile.ty === tile.ty;
    });
  if (walker !== undefined) return { kind: "walker", walkerId: walker.id };

  const buildingId = getTile(state, tile)?.buildingId ?? null;
  return buildingId === null ? null : { kind: "building", buildingId };
}
