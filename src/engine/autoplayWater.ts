import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import { isBuildingConstructionSite } from "../economy/construction";
import type { GameState } from "./engine.types";
import type { TileCoordinate } from "../world/grid";

import { canPlaceBuilding } from "../world/placement";
import { hasAutoplayBuildingClearance } from "./autoplaySetback";
import { hasConnectedConstructionRoute } from "./autoplayConstructionRoute";
import { plannedBuildingRoadAction } from "./autoplayConstructionRoads";
import { preserveRoadExpansion } from "./autoplayExpansion";
import { allocateHouseServices } from "../population/serviceAllocation";
import { rankServiceCandidates } from './autoplayServiceCandidates';
import { rankServiceRoadPlans } from './autoplayServiceRoadPlans';
import { serviceAccessDistances } from './autoplayServiceAccess';
import type { AutoplayAction } from "./autoplay.types";

const NONE = { kind: "none" } as const satisfies AutoplayAction;

type WaterlessHome = Readonly<{ building: Building }>;

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

function waterlessHomes(state: GameState): readonly WaterlessHome[] {
  const plannedWells = state.constructionSites.flatMap(site =>
    isBuildingConstructionSite(site) && site.kind === "well"
      ? [{ ...virtualBuilding("well", site), id: site.id }]
      : []);
  const services = allocateHouseServices({ houses: state.houses, buildings: [...state.buildings, ...plannedWells] });
  return state.houses
    .map((house) => {
      const building = state.buildings.find((candidate) => candidate.id === house.buildingId);
      if (building === undefined || services.houses.get(house.buildingId)?.water.kind === "served") return null;
      return {
        building,
      };
    })
    .filter((home): home is WaterlessHome => home !== null)
    .sort((left, right) => left.building.ty - right.building.ty || left.building.tx - right.building.tx);
}

export function waterAction(state: GameState): AutoplayAction {
  const homes = waterlessHomes(state);
  if (homes.length === 0) return NONE;
  const candidates = state.tiles.filter(coordinate => hasAutoplayBuildingClearance(state, "well", coordinate)
    && canPlaceBuilding(state, "well", coordinate.tx, coordinate.ty).ok)
    .map(coordinate => virtualBuilding('well', coordinate))
    .filter(candidate => homes.some(home => buildingFootprintDistance(home.building, candidate) <= BUILDING_CONFIG_BY_KIND.well.serviceRadius));
  const planned = state.constructionSites.flatMap(site => isBuildingConstructionSite(site) && site.kind === 'well'
    ? [{ ...virtualBuilding('well', site), id: site.id }] : []);
  const allocation = { houses: state.houses, buildings: [...state.buildings, ...planned] };
  const current = allocateHouseServices(allocation);
  const distance = serviceAccessDistances(state);
  const ranked = rankServiceCandidates({ service: 'water', allocation, current,
    candidates: candidates.filter(candidate => hasConnectedConstructionRoute(state, candidate))
      .map(building => ({ building, roadDistance: distance(building) })) });
  for (const { building: candidate } of ranked) {
    if (!hasConnectedConstructionRoute(state, virtualBuilding('well', candidate))
      || !preservesAutoplayWallSpace(state, 'well', candidate)
      || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'well', tx: candidate.tx, ty: candidate.ty })) continue;
    const expansion = preserveRoadExpansion(state, { ...candidate, kind: 'well' });
    if (expansion?.kind === 'none') continue;
    return expansion ?? { kind: 'place_building', building: 'well', tx: candidate.tx, ty: candidate.ty };
  }
  for (const { building: candidate } of rankServiceRoadPlans({ ...state, buildings: [...state.buildings, ...planned] }, 'water', candidates)) {
    if (!preservesAutoplayWallSpace(state, "well", candidate) || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'well', tx: candidate.tx, ty: candidate.ty })) continue;
    const road = plannedBuildingRoadAction(state, virtualBuilding("well", candidate));
    if (road.kind !== "none") return road;
  }
  return NONE;
}
