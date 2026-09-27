import type { GameState } from "../engine/engine.types";
import { getTile, type TileCoordinate } from "../world/grid";
import { pickTile } from "./picking";
import { walkerVisualAnchor } from "./walkerAnchor";

export type WorldSelection =
  | { readonly kind: "building"; readonly buildingId: string }
  | { readonly kind: "walker"; readonly walkerId: string }
  | { readonly kind: "construction_site"; readonly siteId: string }
  /** UI-6: a finished wall segment (its card shows the ring's defence against a raid). */
  | { readonly kind: "wall_segment"; readonly segmentId: string };

export type AnchoredWorldSelection = WorldSelection & {
  readonly position: { readonly x: number; readonly y: number };
};

export function selectWorldAtTile(
  state: Pick<GameState, "buildings" | "constructionSites" | "tiles" | "width" | "height" | "walkers"> & Partial<Pick<GameState, "palisade">>,
  tile: TileCoordinate,
): WorldSelection | null {
  const walker = [...state.walkers]
    .reverse()
    .filter((candidate) => candidate.kind !== "builder")
    .find((candidate) => {
      const anchor = walkerVisualAnchor(candidate.position);
      const renderedTile = pickTile({ x: anchor.sx, y: anchor.sy });
      return renderedTile?.tx === tile.tx && renderedTile.ty === tile.ty;
    });
  if (walker !== undefined) return { kind: "walker", walkerId: walker.id };

  const palisadeSite = state.constructionSites.find((candidate) =>
    candidate.kind === "palisade_segment" &&
    candidate.path.some((point) => point.x === tile.tx && point.y === tile.ty)
  );
  if (palisadeSite !== undefined) {
    return { kind: "construction_site", siteId: palisadeSite.id };
  }

  const buildingId = getTile(state, tile)?.buildingId ?? null;
  if (buildingId === null) {
    // A finished wall segment whose line passes this tile (the same test as a wall construction site's path).
    const segment = state.palisade?.segments.find(candidate => candidate.completed
      && candidate.edgePath.some(point => point.x === tile.tx && point.y === tile.ty));
    return segment === undefined ? null : { kind: "wall_segment", segmentId: segment.id };
  }
  const site = state.constructionSites.find((candidate) => candidate.id === buildingId);
  if (site !== undefined) return { kind: "construction_site", siteId: site.id };
  return state.buildings.some((building) => building.id === buildingId)
    ? { kind: "building", buildingId }
    : null;
}
