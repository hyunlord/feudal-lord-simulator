import { houseBuiltLevel } from "../population/houseCondition";
import type { Walker } from "../agents/walker.types";
import type { Building } from "../content/buildingConfig";
import { constructionSiteFootprint, isBuildingConstructionSite } from "../economy/construction";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { getTile } from "../world/grid";
import { hasBuildingWallClearance } from "../world/placement";
import type { GameState } from "./engine.types";
import { buildingHasRequiredRoadAccess } from "./roadAccess";

export type HouseMergeOption = Readonly<{
  targetBuildingId: string;
  label: string;
  enabled: boolean;
  reason: string | null;
}>;

function referencesHouse(walker: Walker, id: string): boolean {
  if (walker.homeBuildingId === id) return true;
  if (walker.kind !== "carter") return false;
  const claim = walker.reservation.sourceStockClaim;
  return (walker.destination.kind === "building" && walker.destination.buildingId === id)
    || (walker.reservation.destination.kind === "building" && walker.reservation.destination.buildingId === id)
    || (claim?.kind === "building" && claim.buildingId === id)
    || walker.reservation.homeCapacityClaim?.buildingId === id;
}

function houseReason(state: GameState, building: Building | undefined): string | null {
  if (building?.kind !== "house") return "완성된 주택을 선택하세요.";
  if (building.houseLot !== undefined) return "이미 두 필지를 합친 연립주택입니다.";
  const house = state.houses.find((candidate) => candidate.buildingId === building.id);
  if (house === undefined || !Number.isInteger(house.level) || house.level < 2 || house.level > 4) return "2단계 이상으로 발전한 주택끼리 합칠 수 있습니다.";
  if (state.walkers.some((walker) => referencesHouse(walker, building.id))) return "이 주택에 연결된 운송이 끝난 뒤 합칠 수 있습니다.";
  if ([building.inventory, building.reserved, building.stockReserved].some((stock) => Object.values(stock).some((amount) => amount > 0))) return "주택에 남은 운송 재고와 예약을 먼저 정리해야 합니다.";
  const tile = getTile(state, building);
  if (tile?.buildingId !== building.id || tile.hasRoad || tile.terrain === "water" || tile.terrain === "rock"
    || state.tiles.filter((candidate) => candidate.buildingId === building.id).length !== 1) return "주택의 점유 영역이 올바르지 않습니다.";
  return null;
}

function combinedBuilding(source: Building, target: Building): Building {
  return { ...source, tx: Math.min(source.tx, target.tx), ty: Math.min(source.ty, target.ty),
    houseLot: source.ty === target.ty ? "horizontal" : "vertical" };
}

function mergeReason(state: GameState, source: Building, target: Building): string | null {
  const individualReason = houseReason(state, source) ?? houseReason(state, target);
  if (individualReason !== null) return individualReason;
  if (source.id === target.id || Math.abs(source.tx - target.tx) + Math.abs(source.ty - target.ty) !== 1) return "변을 맞댄 두 주택만 합칠 수 있습니다.";
  const first = state.houses.find((house) => house.buildingId === source.id);
  const second = state.houses.find((house) => house.buildingId === target.id);
  if (first?.level !== second?.level) return "발전 단계가 같은 주택끼리 합칠 수 있습니다.";
  if (first !== undefined && second !== undefined && houseBuiltLevel(first) !== houseBuiltLevel(second)) return "건축 단계가 같은 주택끼리 합칠 수 있습니다. 생활 등급과 건물 외형을 확인하세요.";
  const lot = combinedBuilding(source, target);
  const footprint = buildingFootprint(lot);
  for (const site of state.constructionSites) {
    const occupied = constructionSiteFootprint(site);
    if (isBuildingConstructionSite(site) && occupied.tx < lot.tx + footprint.width && occupied.tx + occupied.width > lot.tx
      && occupied.ty < lot.ty + footprint.height && occupied.ty + occupied.height > lot.ty) return "겹치는 공사가 끝난 뒤 합칠 수 있습니다.";
  }
  if (!hasBuildingWallClearance(state, { id: lot.id, tx: lot.tx, ty: lot.ty, ...footprint })) return "성벽과 최소 1칸 간격을 두고 합쳐야 합니다.";
  if (!buildingHasRequiredRoadAccess(state, lot)) return "합친 주택에 연결된 길이 필요합니다.";
  return null;
}

export function houseMergeOptions(state: GameState, sourceId: string): readonly HouseMergeOption[] {
  const source = state.buildings.find((building) => building.id === sourceId);
  if (source?.kind !== "house" || source.houseLot !== undefined) return [];
  return state.buildings.filter((target) => target.kind === "house" && target.id !== sourceId
    && Math.abs(target.tx - source.tx) + Math.abs(target.ty - source.ty) === 1)
    .sort((a, b) => a.ty - b.ty || a.tx - b.tx || a.id.localeCompare(b.id))
    .map((target) => {
      const reason = mergeReason(state, source, target);
      const direction = target.tx > source.tx ? "오른쪽 아래"
        : target.tx < source.tx ? "왼쪽 위"
          : target.ty > source.ty ? "왼쪽 아래" : "오른쪽 위";
      return { targetBuildingId: target.id,
        label: `${direction} 주택과 ${source.ty === target.ty ? "2×1" : "1×2"} 합필`,
        enabled: reason === null, reason };
    });
}

export function houseMergeStatus(state: GameState, sourceId: string): string {
  return houseReason(state, state.buildings.find((building) => building.id === sourceId))
    ?? "같은 발전 단계의 인접 주택과 합쳐 주민과 식량을 보존합니다.";
}

export function mergeHouses(state: GameState, sourceId: string, targetId: string): GameState {
  const source = state.buildings.find((building) => building.id === sourceId);
  const target = state.buildings.find((building) => building.id === targetId);
  if (source === undefined || target === undefined || mergeReason(state, source, target) !== null) return state;
  const first = state.houses.find((house) => house.buildingId === sourceId);
  const second = state.houses.find((house) => house.buildingId === targetId);
  if (first === undefined || second === undefined) return state;
  const merged = { ...first, builtLevel: Math.max(houseBuiltLevel(first), houseBuiltLevel(second)), residents: first.residents + second.residents, breadStock: first.breadStock + second.breadStock,
    emptyFoodTicks: first.breadStock + second.breadStock > 0 ? 0 : Math.max(first.emptyFoodTicks ?? 0, second.emptyFoodTicks ?? 0),
    hasWater: first.hasWater && second.hasWater, lastServicedTick: Math.min(first.lastServicedTick, second.lastServicedTick),
    starvationGraceUntilTick: Math.min(first.starvationGraceUntilTick ?? 0, second.starvationGraceUntilTick ?? 0),
    unmetRequirementTicks: Math.max(first.unmetRequirementTicks, second.unmetRequirementTicks),
    promotionTicks: Math.min(first.promotionTicks ?? 0, second.promotionTicks ?? 0) };
  return { ...state,
    buildings: state.buildings.filter((building) => building.id !== targetId).map((building) => building.id === sourceId ? combinedBuilding(source, target) : building),
    houses: state.houses.filter((house) => house.buildingId !== targetId).map((house) => house.buildingId === sourceId ? merged : house),
    tiles: state.tiles.map((tile) => tile.buildingId === targetId ? { ...tile, buildingId: sourceId } : tile),
    roadRevision: state.roadRevision + 1, pathCache: {},
  };
}
