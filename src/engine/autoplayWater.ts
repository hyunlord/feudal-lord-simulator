import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import { isBuildingConstructionSite } from "../economy/construction";
import type { GameState } from "./engine.types";
import type { TileCoordinate } from "../world/grid";
import { getTile } from "../world/grid";
import { canPlaceBuilding } from "../world/placement";
import type { AutoplayAction } from "./autoplay.types";

const NONE = { kind: "none" } as const satisfies AutoplayAction;

type WaterlessHome = Readonly<{ building: Building; residents: number; deprivation: number }>;

function virtualBuilding(kind: "well", coordinate: TileCoordinate): Building {
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

function wellCoversHouse(state: GameState, home: Building): boolean {
  const finishedWellCovers = state.buildings.some((building) =>
    building.kind === "well" &&
    buildingFootprintDistance(home, building) <= BUILDING_CONFIG_BY_KIND.well.serviceRadius,
  );
  return finishedWellCovers || state.constructionSites.some((site) =>
    isBuildingConstructionSite(site) &&
    site.kind === "well" &&
    buildingFootprintDistance(home, virtualBuilding("well", { tx: site.tx, ty: site.ty })) <= BUILDING_CONFIG_BY_KIND.well.serviceRadius,
  );
}

function waterlessHomes(state: GameState): readonly WaterlessHome[] {
  return state.houses
    .filter((house) => house.residents > 0)
    .map((house) => {
      const building = state.buildings.find((candidate) => candidate.id === house.buildingId);
      if (building === undefined || wellCoversHouse(state, building)) return null;
      return {
        building,
        residents: house.residents,
        deprivation: Math.max(0, house.unmetRequirementTicks) * house.residents + house.residents,
      };
    })
    .filter((home): home is WaterlessHome => home !== null)
    .sort((left, right) => left.building.ty - right.building.ty || left.building.tx - right.building.tx);
}

export function waterAction(state: GameState): AutoplayAction {
  const homes = waterlessHomes(state);
  if (homes.length === 0) return NONE;
  const candidates: readonly TileCoordinate[] = Array.from({ length: state.width * state.height }, (_unused, index) => ({
    tx: index % state.width,
    ty: Math.floor(index / state.width),
  })).filter((coordinate) => getTile(state, coordinate)?.terrain === "grass" && canPlaceBuilding(state, "well", coordinate.tx, coordinate.ty).ok);
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
        sum: covered.reduce((total, home) => total + Math.abs(candidate.tx - home.building.tx) + Math.abs(candidate.ty - home.building.ty), 0),
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((left, right) =>
      right.deprivation - left.deprivation ||
      right.count - left.count ||
      right.residents - left.residents ||
      left.sum - right.sum ||
      left.candidate.ty - right.candidate.ty ||
      left.candidate.tx - right.candidate.tx,
    );
  const best = ranked[0]?.candidate;
  return best === undefined ? NONE : { kind: "place_building", building: "well", tx: best.tx, ty: best.ty };
}
