/**
 * DevAutoPlayer grain supply (spec AF-13). Wheat comes from arable strips tended from farmsteads, so the
 * planner works from the expected harvest instead of a measured flow (a harvest comes once a year):
 *
 * - need: a year of the homes' bread as wheat (measured requests or today's rations, whichever is larger), times
 *   `ARABLE_MARGIN_PERMILLE`;
 * - supply: `expectedAnnualWheat` (tended strips, at most `predictedCellsPerFarmstead` cells per farmstead);
 * - a field with untended strips gets a farmstead beside it first; otherwise the planner paints one 2×2 block
 *   (an old farm's footprint): beside a field whose farmstead has room, else a new block near a road with a
 *   free road-side cell for its farmstead, nearest the granaries by road.
 */
import { ARABLE_CONFIG } from "../content/arableConfig";
import { BALANCE, PRESSURE_BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../content/buildingConfig";
import { isBuildingConstructionSite } from "../economy/construction";
import type { TileCoordinate } from "../geometry/tileGeometry";
import { arableLayouts, stripTending } from "../zones/arableFields";
import { expectedAnnualWheat, farmsteadYears, homeWheatDemand } from "../zones/arableOutlook";
import { cellInsideWall, zonesOf } from "../zones/zoneEdits";
import type { ZoneStroke } from "../zones/zone.types";
import { foodEfficiencyMetrics } from "./autoplayFoodEfficiency";
import { autoplaySearchExhausted } from "./autoplaySearchBudget";
import { hasAutoplayBuildingClearance } from "./autoplaySetback";
import { preservesAutoplayServiceSpace } from "./autoplayServiceSpace";
import { preservesAutoplayWallSpace } from "./autoplayWallSpace";
import type { AutoplayAction } from "./autoplay.types";
import type { GameState } from "./engine.types";
import { resolveBuildingRoute } from "./routing";
import { plannedBuildingRoadAction } from "./autoplayConstructionRoads";

/** AF-13: the planner keeps the expected harvest this far above a year's need (growth headroom). */
export const ARABLE_MARGIN_PERMILLE = 1200;
/** F0-A `--naive-reserve` (FP-6): the bot variant without reserve measures plants for the year's need only. */
export const NAIVE_ARABLE_MARGIN_PERMILLE = 1000;

let activeMarginPermille: number = ARABLE_MARGIN_PERMILLE;

/** Runs `decide` with the planner's harvest margin set to `margin` (FP-6); the default margin is restored after. */
export function withArableMargin<T>(margin: number, decide: () => T): T {
  const previous = activeMarginPermille;
  activeMarginPermille = margin;
  try {
    return decide();
  } finally {
    activeMarginPermille = previous;
  }
}

const NONE = { kind: "none" } as const satisfies AutoplayAction;
const BLOCK = 2;

export type FarmsteadBuildAction = (state: GameState, kind: BuildingKind, accepts?: (coordinate: TileCoordinate) => boolean) => AutoplayAction;

/**
 * F0-A (FP-4, FP-6): a year eats three seasons at the ration and a winter at × 1.2, so 1.05 years of rations. Without
 * it the planner sized seed 4's fields for 0.95 of the year and the town stalled at L4 13–16/24 (guardrail run 1).
 */
export const YEAR_RATION_PERMILLE = 1000 + (PRESSURE_BALANCE.winterRationPermille - 1000) / 4;

/** A year of the homes' bread, as wheat, winter meals included. */
export function annualWheatNeed(state: GameState): number {
  const sample = foodEfficiencyMetrics(state);
  const perBread = BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 2;
  const measured = sample.known && sample.coveredTicks > 0
    ? Math.ceil((sample.requestedBread + sample.breadExported) * BALANCE.TICKS_PER_YEAR / sample.coveredTicks) * perBread : 0;
  return Math.ceil(Math.max(measured, homeWheatDemand(state, BALANCE.TICKS_PER_YEAR)) * YEAR_RATION_PERMILLE / 1000);
}

/** AF-13: the expected harvest falls short of the need with margin (`margin` ‰, default the planner's). */
export function arableSupplyShort(state: GameState, margin: number = activeMarginPermille): boolean {
  return expectedAnnualWheat(state) * 1000 < annualWheatNeed(state) * margin;
}

export function hasPendingFarmstead(state: GameState): boolean {
  return state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === "farmstead");
}

/**
 * Cells that need a farmstead: strips no farmstead reaches (AF-8), and strips past their farmstead's counted share
 * (`predictedCellsPerFarmstead`, in layout order as `farmsteadYears` counts them), which add nothing to the
 * expected harvest until a farmstead of their own takes them.
 */
export function untendedArableCells(state: GameState): readonly TileCoordinate[] {
  const layouts = arableLayouts(state);
  const tending = stripTending(state, layouts);
  const counted = new Map<string, number>();
  const cells: TileCoordinate[] = [];
  for (const strip of layouts.flatMap(layout => layout.strips)) {
    const assigned = tending.get(strip.id);
    if (assigned?.status === "no_farmstead") { cells.push(...strip.cells); continue; }
    if (assigned?.farmsteadId === null || assigned === undefined) continue;
    const before = counted.get(assigned.farmsteadId) ?? 0;
    if (before >= ARABLE_CONFIG.predictedCellsPerFarmstead) cells.push(...strip.cells);
    counted.set(assigned.farmsteadId, before + strip.cells.length);
  }
  return cells;
}

function openFieldCell(state: GameState, tx: number, ty: number, zoneCells: ReadonlySet<number>): boolean {
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
  const index = ty * state.width + tx;
  const tile = state.tiles[index]!;
  return (tile.terrain === "grass" || tile.terrain === "forest") && tile.buildingId === null && !tile.hasRoad
    && !zoneCells.has(index) && !cellInsideWall(state, index);
}

function blockCells(anchor: TileCoordinate): readonly TileCoordinate[] {
  return [anchor, { tx: anchor.tx + 1, ty: anchor.ty }, { tx: anchor.tx, ty: anchor.ty + 1 }, { tx: anchor.tx + 1, ty: anchor.ty + 1 }];
}

function blockStroke(anchor: TileCoordinate): ZoneStroke {
  return { tool: "polygon", points: [{ x: anchor.tx, y: anchor.ty }, { x: anchor.tx + BLOCK, y: anchor.ty },
    { x: anchor.tx + BLOCK, y: anchor.ty + BLOCK }, { x: anchor.tx, y: anchor.ty + BLOCK }] };
}

function virtualBlock(anchor: TileCoordinate): Building {
  return { id: "autoplay-field-block", kind: "wheat_farm", ...anchor, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

/** The block keeps the land autoplay needs for walls and services, like an old farm did. */
function blockKeepsSpace(state: GameState, anchor: TileCoordinate): boolean {
  return hasAutoplayBuildingClearance(state, "wheat_farm", anchor) && preservesAutoplayWallSpace(state, "wheat_farm", anchor)
    && preservesAutoplayServiceSpace(state, { kind: "place_building", building: "wheat_farm", tx: anchor.tx, ty: anchor.ty });
}

function touchesRoad(state: GameState, cells: readonly TileCoordinate[]): boolean {
  return cells.some(cell => [[cell.tx - 1, cell.ty], [cell.tx + 1, cell.ty], [cell.tx, cell.ty - 1], [cell.tx, cell.ty + 1]].some(([nx, ny]) =>
    nx! >= 0 && ny! >= 0 && nx! < state.width && ny! < state.height && state.tiles[ny! * state.width + nx!]!.hasRoad));
}

const farthest = (building: Pick<Building, "tx" | "ty">, cells: readonly TileCoordinate[]) =>
  Math.max(...cells.map(cell => Math.abs(cell.tx - building.tx) + Math.abs(cell.ty - building.ty)));

/** A free road-side cell beside the block where its farmstead could stand. */
function farmsteadRoomBeside(state: GameState, anchor: TileCoordinate, zoneCells: ReadonlySet<number>): boolean {
  const cells = blockCells(anchor);
  const inBlock = (tx: number, ty: number) => cells.some(cell => cell.tx === tx && cell.ty === ty);
  for (const cell of cells) {
    for (const [nx, ny] of [[cell.tx - 1, cell.ty], [cell.tx + 1, cell.ty], [cell.tx, cell.ty - 1], [cell.tx, cell.ty + 1]] as const) {
      if (inBlock(nx, ny) || !openFieldCell(state, nx, ny, zoneCells)) continue;
      const roadNext = [[nx - 1, ny], [nx + 1, ny], [nx, ny - 1], [nx, ny + 1]].some(([rx, ry]) =>
        rx! >= 0 && ry! >= 0 && rx! < state.width && ry! < state.height && state.tiles[ry! * state.width + rx!]!.hasRoad);
      if (roadNext) return true;
    }
  }
  return false;
}

/**
 * AF-13 field block: beside a field whose farmstead has room (touching the field first, then nearest that
 * farmstead); otherwise, when `newFarmsteadAllowed`, a new block with room for a farmstead, nearest a granary by
 * road (up to 24 route checks, like the other late food searches).
 */
export function fieldBlockAction(state: GameState, newFarmsteadAllowed: boolean): AutoplayAction {
  const zoneCells = new Set(zonesOf(state).flatMap(zone => zone.membership));
  const arableCells = new Set(zonesOf(state).filter(zone => zone.kind === "arable").flatMap(zone => zone.membership));
  const roomy = farmsteadYears(state).filter(year => year.cells + BLOCK * BLOCK <= ARABLE_CONFIG.predictedCellsPerFarmstead)
    .flatMap(year => state.buildings.filter(building => building.id === year.farmsteadId));
  const extension: { anchor: TileCoordinate; touches: boolean; distance: number }[] = [];
  const fresh: { anchor: TileCoordinate; distance: number }[] = [];
  const granaries = state.buildings.filter(building => building.kind === "granary");
  for (let ty = 1; ty < state.height - BLOCK; ty += 1) {
    for (let tx = 1; tx < state.width - BLOCK; tx += 1) {
      const anchor = { tx, ty };
      const cells = blockCells(anchor);
      if (!cells.every(cell => openFieldCell(state, cell.tx, cell.ty, zoneCells))) continue;
      const reach = roomy.map(building => farthest(building, cells)).filter(distance => distance <= ARABLE_CONFIG.tendRadius);
      if (reach.length > 0) {
        const touches = cells.some(cell => [[cell.tx - 1, cell.ty], [cell.tx + 1, cell.ty], [cell.tx, cell.ty - 1], [cell.tx, cell.ty + 1]]
          .some(([nx, ny]) => arableCells.has(ny! * state.width + nx!)));
        extension.push({ anchor, touches, distance: Math.min(...reach) });
      } else if (newFarmsteadAllowed && granaries.length > 0 && touchesRoad(state, cells)) {
        // A new field near a full farmstead counts as unworked (`untendedArableCells`), so the next step builds it a
        // farmstead of its own.
        // A new field touches a road like the old farm did, so its harvest and farmstead are reachable.
        fresh.push({ anchor, distance: Math.min(...granaries.map(granary => Math.abs(granary.tx - tx) + Math.abs(granary.ty - ty))) });
      }
    }
  }
  extension.sort((a, b) => Number(b.touches) - Number(a.touches) || a.distance - b.distance || a.anchor.ty - b.anchor.ty || a.anchor.tx - b.anchor.tx);
  for (const candidate of extension) {
    if (autoplaySearchExhausted()) return NONE;
    if (blockKeepsSpace(state, candidate.anchor)) return { kind: "paint_zone", zone: "arable", stroke: blockStroke(candidate.anchor) };
  }
  fresh.sort((a, b) => a.distance - b.distance || a.anchor.ty - b.anchor.ty || a.anchor.tx - b.anchor.tx);
  let best: { anchor: TileCoordinate; route: number } | null = null;
  let checked = 0;
  for (const candidate of fresh) {
    if (checked >= 24 || autoplaySearchExhausted()) break;
    if (!farmsteadRoomBeside(state, candidate.anchor, zoneCells) || !blockKeepsSpace(state, candidate.anchor)) continue;
    checked += 1;
    const block = virtualBlock(candidate.anchor);
    const routes = granaries.map(granary => resolveBuildingRoute(state, block, granary).path).filter(path => path !== null);
    if (routes.length === 0) continue;
    const route = Math.min(...routes.map(path => path.length));
    if (best === null || route < best.route) best = { anchor: candidate.anchor, route };
  }
  if (best !== null) return { kind: "paint_zone", zone: "arable", stroke: blockStroke(best.anchor) };
  return newFarmsteadAllowed ? fieldRoadAction(state, zoneCells) : NONE;
}

/**
 * No block beside a road qualifies: like the old farm search, lay a road toward the nearest open block that keeps
 * the wall and service space (up to 24 candidates by distance to the road network).
 */
function fieldRoadAction(state: GameState, zoneCells: ReadonlySet<number>): AutoplayAction {
  const roads = state.tiles.filter(tile => tile.hasRoad);
  if (roads.length === 0) return NONE;
  const open: { anchor: TileCoordinate; distance: number }[] = [];
  for (let ty = 1; ty < state.height - BLOCK; ty += 1) {
    for (let tx = 1; tx < state.width - BLOCK; tx += 1) {
      const cells = blockCells({ tx, ty });
      if (!cells.every(cell => openFieldCell(state, cell.tx, cell.ty, zoneCells))) continue;
      open.push({ anchor: { tx, ty }, distance: Math.min(...roads.map(road => Math.abs(road.tx - tx) + Math.abs(road.ty - ty))) });
    }
  }
  open.sort((a, b) => a.distance - b.distance || a.anchor.ty - b.anchor.ty || a.anchor.tx - b.anchor.tx);
  for (const candidate of open.slice(0, 24)) {
    if (autoplaySearchExhausted()) return NONE;
    if (!blockKeepsSpace(state, candidate.anchor)) continue;
    const road = plannedBuildingRoadAction(state, virtualBlock(candidate.anchor));
    if (road.kind !== "none") return road;
  }
  return NONE;
}

/**
 * AF-13 grain step: a farmstead for an untended field (beside the field, within reach of its strips), else a
 * field block. `buildAction` places the farmstead through the ordinary placement search.
 */
export function arableAction(state: GameState, buildAction: FarmsteadBuildAction, newFarmsteadAllowed: boolean): AutoplayAction {
  if (hasPendingFarmstead(state)) return NONE;
  const untended = untendedArableCells(state);
  if (untended.length > 0) {
    if (!newFarmsteadAllowed) return NONE;
    // The new farmstead must reach the first unworked strip and stand nearer to it than any farmstead already there,
    // so the strip becomes its own (AF-8 picks the nearest).
    const sample = untended.slice(0, BLOCK * BLOCK);
    const nearestTo = (tile: Pick<Building, "tx" | "ty">) => Math.min(...sample.map(cell => Math.abs(cell.tx - tile.tx) + Math.abs(cell.ty - tile.ty)));
    const current = Math.min(Infinity, ...state.buildings.filter(building => building.kind === "farmstead").map(nearestTo));
    return buildAction(state, "farmstead", coordinate =>
      farthest(coordinate, sample) <= ARABLE_CONFIG.tendRadius && nearestTo(coordinate) < current);
  }
  return fieldBlockAction(state, newFarmsteadAllowed);
}
