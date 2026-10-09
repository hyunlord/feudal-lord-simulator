/**
 * GB-5 (GROW-BLOCK, the user's ruling 2026-10-09): a building site is laid out only where its materials can come — a
 * delivery route from a store exists now (`hasConnectedConstructionRoute`), or the construction road search, with its
 * service-space rule, can lay the road to it (a planned road counts). Seed 3's well, boxed in by a store and two
 * granaries, had one free side whose only road crossed the homes' service space: the search refused it each week and the
 * well stood six years (its site held the charter's search). The sandbox bot and the lord's town check the same.
 */
import type { BuildingKind } from "../content/buildingConfig";
import type { TileCoordinate } from "../world/grid";
import { hasConnectedConstructionRoute } from "./autoplayConstructionRoute";
import { plannedBuildingRoadAction } from "./autoplayConstructionRoads";
import type { GameState } from "./engine.types";

/** GB-4/GB-5: a spot the town gave up for want of material or hands is not taken again for a year (a road's want is the reach check itself). */
const ABANDONED_SPOT_TICKS = 4_000;

export function constructionSiteReachable(state: GameState, kind: BuildingKind, coordinate: TileCoordinate): boolean {
  if ((state.agency?.abandonedSites ?? []).some(entry => entry.kind === kind && entry.tx === coordinate.tx && entry.ty === coordinate.ty
    && entry.reason !== "road" && state.tick - entry.tick < ABANDONED_SPOT_TICKS)) return false;
  const candidate = { id: "reach-probe", kind, tx: coordinate.tx, ty: coordinate.ty, workers: 0 } as Parameters<typeof hasConnectedConstructionRoute>[1];
  if (hasConnectedConstructionRoute(state, candidate)) return true;
  return plannedBuildingRoadAction(state, candidate).kind === "place_road";
}
