import { houseLotArea } from "../geometry/buildingFootprint";
import { houseHasFood } from "../population/houseFood";
import type { GameState } from "./engine.types";
import type { SettlementMetrics } from "./settlement.types";
export function settlementMetrics(state: GameState): SettlementMetrics {
  const occupied = state.houses.filter(house => house.residents > 0);
  const buildings = new Map(state.buildings.map(building => [building.id, building]));
  const occupiedL4Lots = occupied.reduce((lots, house) => {
    const building = buildings.get(house.buildingId);
    return lots + (house.level === 4 && building?.kind === "house" ? houseLotArea(building) : 0);
  }, 0);
  const fedHouses = occupied.filter(houseHasFood).length;
  const suppliedHouses = occupied.filter(house => house.hasWater && houseHasFood(house)).length;
  const segments = state.palisade?.segments ?? [];
  const completedWall = segments.length > 0 && segments.every(segment => segment.completed);
  return {
    population: state.population,
    occupiedHouses: occupied.length, occupiedL4Lots, suppliedHouses, fedHouses,
    suppliedPercent: occupied.length === 0 ? 0 : suppliedHouses * 100 / occupied.length,
    foodPercent: occupied.length === 0 ? 0 : fedHouses * 100 / occupied.length,
    completedWall,
    completedStoneWall: completedWall && segments.every(segment => segment.material === "stone" && segment.replacementConstructionSiteId == null),
  };
}
