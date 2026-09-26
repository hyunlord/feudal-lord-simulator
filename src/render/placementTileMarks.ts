import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";
import { constructionSiteFootprint, isBuildingConstructionSite } from "../economy/constructionSiteAccessors";
import type { GameState } from "../engine/engine.types";
import { ZonePlacementFailure } from "../zones/zonePlacement";
import { getTile, type TileCoordinate } from "../world/grid";
import { PlacementFailure } from "../world/placement";

// UX-3 S-52 placement validity, per tile: only the ghost's footprint and the one-tile ring around it are judged (not
// the whole screen). A footprint tile is fine or blocked by what stands on it (a building or site, a road, water, the
// map edge); a whole-building failure (wall clearance, materials, zone, era, no road or forest beside it) marks every
// footprint tile and draws its icon once, on the centre tile. The ring shows what the building touches: the road that
// gives it access, the forest a logging camp needs — and, when that contact is missing, the ring itself is marked.
// Forest is buildable ground (placement.isBuildableTerrain), so a tree is never a reason here.
export type TileMarkReason = "building" | "road" | "water" | "edge" | "wall" | "needs_road" | "needs_forest" | "materials" | "zone" | "locked";
export type TileMark = {
  readonly tx: number; readonly ty: number;
  /** false: blocked (hatched). */
  readonly ok: boolean;
  readonly reason: TileMarkReason | null;
  /** Draw the reason icon on this tile (each blocked tile for a tile reason, the centre tile for a whole-building one). */
  readonly icon: boolean;
  /** A ring tile: drawn as an outline — `contact` when it is the road / forest the building touches. */
  readonly ring: boolean;
  readonly contact?: boolean;
};

type Result = { readonly ok: boolean; readonly reason: PlacementFailure | ZonePlacementFailure | null };

const WHOLE_BUILDING: Partial<Record<PlacementFailure | ZonePlacementFailure, TileMarkReason>> = {
  [PlacementFailure.wall_clearance]: "wall", [PlacementFailure.insufficient_materials]: "materials",
  [PlacementFailure.locked_era]: "locked", [PlacementFailure.needs_road]: "needs_road",
  [PlacementFailure.needs_adjacent_terrain]: "needs_forest",
  [ZonePlacementFailure.outside_zone]: "zone", [ZonePlacementFailure.arable_inside_wall]: "zone",
};

function siteCovers(state: GameState, tile: TileCoordinate): boolean {
  return state.constructionSites.some(site => {
    if (!isBuildingConstructionSite(site)) return false;
    const box = constructionSiteFootprint(site);
    return tile.tx >= box.tx && tile.tx < box.tx + box.width && tile.ty >= box.ty && tile.ty < box.ty + box.height;
  });
}

function tileReason(state: GameState, coordinate: TileCoordinate): TileMarkReason | null {
  const tile = getTile(state, coordinate);
  if (tile === null) return "edge";
  if (tile.buildingId !== null || siteCovers(state, coordinate)) return "building";
  if (tile.hasRoad) return "road";
  if (tile.terrain === "water") return "water";
  return null;
}

/** Footprint + ring marks for a building ghost; `footprint` is the ghost's tiles, `result` the engine's verdict. */
export function buildingTileMarks(state: GameState, kind: BuildingKind, footprint: readonly TileCoordinate[], result: Result): readonly TileMark[] {
  if (footprint.length === 0) return [];
  const whole = result.ok || result.reason === null ? null : WHOLE_BUILDING[result.reason] ?? null;
  const xs = footprint.map(tile => tile.tx), ys = footprint.map(tile => tile.ty);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const centre = footprint.reduce((best, tile) =>
    Math.abs(tile.tx - (minX + maxX) / 2) + Math.abs(tile.ty - (minY + maxY) / 2) < Math.abs(best.tx - (minX + maxX) / 2) + Math.abs(best.ty - (minY + maxY) / 2) ? tile : best);
  const marks: TileMark[] = footprint.map(tile => {
    const reason = tileReason(state, tile);
    if (reason !== null) return { ...tile, ok: false, reason, icon: true, ring: false };
    if (whole !== null) return { ...tile, ok: false, reason: whole, icon: tile === centre, ring: false };
    // A tile-level failure elsewhere (another tile is on a building, road or water): this tile itself is fine.
    return { ...tile, ok: true, reason: null, icon: false, ring: false };
  });
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  const wantsRoad = definition.requiresRoad, wantsTerrain = definition.requiresAdjacentTerrain;
  const ringFailed = whole === "needs_road" || whole === "needs_forest" || whole === "wall";
  for (let ty = minY - 1; ty <= maxY + 1; ty += 1) {
    for (let tx = minX - 1; tx <= maxX + 1; tx += 1) {
      if (tx >= minX && tx <= maxX && ty >= minY && ty <= maxY) continue;
      const tile = getTile(state, { tx, ty });
      if (tile === null) continue;
      const contact = (wantsRoad && tile.hasRoad) || (wantsTerrain !== null && tile.terrain === wantsTerrain);
      marks.push({ tx, ty, ok: !ringFailed, reason: ringFailed ? whole : null, icon: false, ring: true, ...(contact ? { contact: true } : {}) });
    }
  }
  return marks;
}

/** The blocking reasons, most important first (the chip's one line, S-53: the first plus "+N"). */
export function blockingReasons(marks: readonly TileMark[]): readonly { readonly reason: TileMarkReason; readonly count: number }[] {
  const counts = new Map<TileMarkReason, number>();
  for (const mark of marks) if (!mark.ok && !mark.ring && mark.reason !== null) counts.set(mark.reason, (counts.get(mark.reason) ?? 0) + 1);
  const order: readonly TileMarkReason[] = ["edge", "water", "building", "road", "wall", "needs_road", "needs_forest", "zone", "locked", "materials"];
  return order.filter(reason => counts.has(reason)).map(reason => ({ reason, count: counts.get(reason)! }));
}
