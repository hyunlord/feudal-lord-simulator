import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../content/buildingConfig";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import { HOUSING_CONFIG } from "../content/housingConfig";
import { isBuildingConstructionSite } from "../economy/construction";
import { evaluateEraRequirements } from "./era";
import { buildingHasRequiredRoadAccess } from "./roadAccess";
import { buildingRoadAccessTiles } from "./routing";
import type { GameState } from "./engine.types";
import type { TileCoordinate } from "../world/grid";
import { getTile } from "../world/grid";
import { canPlaceBuilding, placementSpendableResource } from "../world/placement";
import { canPlaceRoad, roadLine } from "../world/roadGraph";
import { hasConnectedConstructionRoute } from "./autoplayConstructionRoute";

import type { AutoplayAction } from "./autoplay.types";

export type { AutoplayAction } from "./autoplay.types";

const NONE = { kind: "none" } as const satisfies AutoplayAction;

const coordinateKey = (coordinate: TileCoordinate): string => `${coordinate.tx},${coordinate.ty}`;

function compareCoordinates(left: TileCoordinate, right: TileCoordinate): number {
  return left.ty - right.ty || left.tx - right.tx;
}

function distance(left: TileCoordinate, right: TileCoordinate): number {
  return Math.abs(left.tx - right.tx) + Math.abs(left.ty - right.ty);
}

function buildingOrigin(building: Building): TileCoordinate {
  return { tx: building.tx, ty: building.ty };
}

type WaterlessHome = Readonly<{ building: Building; residents: number; deprivation: number }>;

function hasBuiltOrPlannedBuilding(state: GameState, kind: BuildingKind): boolean {
  return state.buildings.some((building) => building.kind === kind) ||
    hasPlannedBuilding(state, kind);
}

function hasPlannedBuilding(state: GameState, kind: BuildingKind): boolean {
  return state.constructionSites.some((site) => isBuildingConstructionSite(site) && site.kind === kind);
}

function buildingForHouse(state: GameState, buildingId: string): Building | null {
  return state.buildings.find((building) => building.id === buildingId) ?? null;
}

function breadStock(state: GameState): number {
  const buildingBread = state.buildings.reduce((total, building) => total + (building.inventory.bread ?? 0), 0);
  const houseBread = state.houses.reduce((total, house) => total + house.breadStock, 0);
  return buildingBread + houseBread;
}

function houseCapacity(state: GameState): number {
  return state.houses.reduce((total, house) => {
    const capacity = HOUSING_CONFIG.find((definition) => definition.level === house.level)?.capacity ?? 0;
    return total + capacity;
  }, 0);
}

function wellCoversHouse(state: GameState, home: Building): boolean {
  const finishedWellCovers = state.buildings.some((building) =>
    building.kind === "well" &&
    buildingFootprintDistance(home, building) <= BUILDING_CONFIG_BY_KIND.well.serviceRadius,
  );
  return finishedWellCovers || state.constructionSites.some((site) =>
    isBuildingConstructionSite(site) &&
    site.kind === "well" &&
    buildingFootprintDistance(home, virtualBuilding("well", site)) <= BUILDING_CONFIG_BY_KIND.well.serviceRadius,
  );
}

function waterlessHomes(state: GameState): readonly WaterlessHome[] {
  return state.houses
    .filter((house) => house.residents > 0)
    .map((house) => {
      const building = buildingForHouse(state, house.buildingId);
      if (building === null || wellCoversHouse(state, building)) return null;
      return {
        building,
        residents: house.residents,
        deprivation: Math.max(0, house.unmetRequirementTicks) * house.residents + house.residents,
      };
    })
    .filter((home): home is WaterlessHome => home !== null)
    .sort((left, right) => compareCoordinates(buildingOrigin(left.building), buildingOrigin(right.building)));
}

function isGrassOrigin(state: GameState, coordinate: TileCoordinate): boolean {
  return getTile(state, coordinate)?.terrain === "grass";
}

function findBuildSite(
  state: GameState,
  kind: BuildingKind,
  accepts: (coordinate: TileCoordinate) => boolean = () => true,
): TileCoordinate | null {
  for (let ty = 1; ty < state.height - 1; ty += 1) {
    for (let tx = 1; tx < state.width - 1; tx += 1) {
      const coordinate = { tx, ty };
      if (!isGrassOrigin(state, coordinate)) continue;
      if (!accepts(coordinate)) continue;
      if (canPlaceBuilding(state, kind, tx, ty).ok) return coordinate;
    }
  }
  return null;
}

function waterAction(state: GameState): AutoplayAction {
  const homes = waterlessHomes(state);
  if (homes.length === 0) return NONE;
  const candidates: readonly TileCoordinate[] = Array.from({ length: state.width * state.height }, (_unused, index) => ({
    tx: index % state.width,
    ty: Math.floor(index / state.width),
  })).filter((coordinate) => isGrassOrigin(state, coordinate) && canPlaceBuilding(state, "well", coordinate.tx, coordinate.ty).ok);
  const ranked = candidates
    .map((candidate) => {
      const well = virtualBuilding("well", candidate);
      const covered = homes.filter((home) =>
        buildingFootprintDistance(home.building, well) <= BUILDING_CONFIG_BY_KIND.well.serviceRadius,
      );
      return {
        candidate,
        count: covered.length,
        deprivation: covered.reduce((total, home) => total + home.deprivation, 0),
        residents: covered.reduce((total, home) => total + home.residents, 0),
        sum: covered.reduce((total, home) => total + distance(candidate, buildingOrigin(home.building)), 0),
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((left, right) =>
      right.deprivation - left.deprivation ||
      right.count - left.count ||
      right.residents - left.residents ||
      left.sum - right.sum ||
      compareCoordinates(left.candidate, right.candidate),
    );
  const best = ranked[0]?.candidate;
  return best === undefined ? NONE : { kind: "place_building", building: "well", tx: best.tx, ty: best.ty };
}

function virtualBuilding(kind: BuildingKind, coordinate: TileCoordinate): Building {
  return {
    id: "autoplay-candidate",
    kind,
    tx: coordinate.tx,
    ty: coordinate.ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function roadTiles(state: GameState): readonly TileCoordinate[] {
  return state.tiles
    .filter((tile) => tile.hasRoad)
    .map(({ tx, ty }) => ({ tx, ty }))
    .sort(compareCoordinates);
}

function roadActionForBuilding(state: GameState, building: Building): AutoplayAction {
  let best: { readonly from: TileCoordinate; readonly to: TileCoordinate; readonly length: number } | null = null;
  const accessTiles = buildingRoadAccessTiles({ ...state, tiles: state.tiles.map((tile) => ({ ...tile, hasRoad: true })) }, building)
    .filter((coordinate) => canPlaceRoad(state, coordinate))
    .sort(compareCoordinates);
  for (const road of roadTiles(state)) {
    for (const access of accessTiles) {
      const line = roadLine(road, access);
      const path = line.slice(1);
      const from = path[0];
      const destination = path.at(-1);
      if (
        from === undefined ||
        destination === undefined ||
        destination.tx !== access.tx ||
        destination.ty !== access.ty ||
        !path.every((coordinate) => canPlaceRoad(state, coordinate))
      ) continue;
      const candidate = { from, to: access, length: path.length };
      if (
        best === null ||
        candidate.length < best.length ||
        (candidate.length === best.length && compareCoordinates(candidate.from, best.from) < 0)
      ) {
        best = candidate;
      }
    }
  }
  return best === null ? NONE : { kind: "place_road", from: best.from, to: best.to };
}

function roadAccessAction(state: GameState): AutoplayAction {
  const candidate = state.buildings
    .filter((building) => BUILDING_CONFIG_BY_KIND[building.kind].requiresRoad)
    .filter((building) => BUILDING_CONFIG_BY_KIND[building.kind].workersRequired > 0 && building.workers === 0)
    .filter((building) => !buildingHasRequiredRoadAccess(state, building))
    .sort((left, right) => compareCoordinates(buildingOrigin(left), buildingOrigin(right)))[0];
  return candidate === undefined ? NONE : roadActionForBuilding(state, candidate);
}

function buildAction(state: GameState, kind: BuildingKind): AutoplayAction {
  const site = findBuildSite(state, kind, (coordinate) =>
    !BUILDING_CONFIG_BY_KIND[kind].requiresRoad ||
    hasConnectedConstructionRoute(state, virtualBuilding(kind, coordinate)),
  );
  return site === null ? NONE : { kind: "place_building", building: kind, tx: site.tx, ty: site.ty };
}

function foodAction(state: GameState): AutoplayAction {
  if (state.houses.length === 0 || breadStock(state) >= 20) return NONE;
  if (!hasBuiltOrPlannedBuilding(state, "wheat_farm")) return buildAction(state, "wheat_farm");
  if (!hasBuiltOrPlannedBuilding(state, "mill")) return buildAction(state, "mill");
  if (!hasBuiltOrPlannedBuilding(state, "granary")) return buildAction(state, "granary");
  return NONE;
}

function timberAction(state: GameState): AutoplayAction {
  if (placementSpendableResource(state, "timber") >= 40) return NONE;
  if (!hasBuiltOrPlannedBuilding(state, "logging_camp")) return buildAction(state, "logging_camp");
  if (!hasBuiltOrPlannedBuilding(state, "sawmill")) return buildAction(state, "sawmill");
  return NONE;
}

function housingAction(state: GameState): AutoplayAction {
  if (state.idleWorkers <= 6 || state.population < houseCapacity(state) || hasPlannedBuilding(state, "house")) return NONE;
  const roads = new Set(roadTiles(state).map(coordinateKey));
  const site = findBuildSite(state, "house", (coordinate) =>
    [
      { tx: coordinate.tx, ty: coordinate.ty - 1 },
      { tx: coordinate.tx + 1, ty: coordinate.ty },
      { tx: coordinate.tx, ty: coordinate.ty + 1 },
      { tx: coordinate.tx - 1, ty: coordinate.ty },
    ].some((neighbor) => roads.has(coordinateKey(neighbor))),
  );
  return site === null ? NONE : { kind: "place_building", building: "house", tx: site.tx, ty: site.ty };
}

function eraAction(state: GameState): AutoplayAction {
  const requirements = evaluateEraRequirements(state);
  const unmet = requirements.filter((requirement) => !requirement.met);
  if (unmet.length === 0) return { kind: "proclaim_era" };
  if (unmet.length !== 1) return NONE;
  switch (unmet[0]?.key) {
    case "granary":
      return hasPlannedBuilding(state, "granary") ? NONE : buildAction(state, "granary");
    case "chapel":
      return hasPlannedBuilding(state, "chapel") ? NONE : buildAction(state, "chapel");
    case "market":
      return hasPlannedBuilding(state, "market") ? NONE : buildAction(state, "market");
    case "masonry":
      return hasPlannedBuilding(state, "masonry") ? NONE : buildAction(state, "masonry");
    case "population":
    case "timber":
    case "stone":
    case "coin":
    case undefined:
      return NONE;
  }
}

export function decideNextAction(state: GameState): AutoplayAction {
  if (state.era === "stone_town") return NONE;
  for (const action of [
    waterAction(state),
    roadAccessAction(state),
    foodAction(state),
    timberAction(state),
    housingAction(state),
    eraAction(state),
  ]) {
    if (action.kind !== "none") return action;
  }
  return NONE;
}
