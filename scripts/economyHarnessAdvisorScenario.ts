import type { Building } from "../src/content/buildingConfig";
import type { House } from "../src/population/population.types";
import type { GameState } from "../src/engine/engine.types";
import { createEconomyHarnessScenario } from "./economyHarnessScenario";

const ADVISOR_CAP_HOUSE: Building = {
  id: "house-advisor-cap",
  kind: "house",
  tx: 12,
  ty: 1,
  workers: 0,
  inventory: {},
  reserved: {},
  stockReserved: {},
  productionProgress: 0,
};

const ADVISOR_CAP_HOUSE_STATE: House = {
  buildingId: ADVISOR_CAP_HOUSE.id,
  level: 2,
  residents: 14,
  hasWater: true,
  breadStock: 1,
  lastServicedTick: 0,
  unmetRequirementTicks: 0,
};

export function createAdvisorMetricScenario(): GameState {
  const base = createEconomyHarnessScenario({ seed: 3 });
  return {
    ...base,
    buildings: [...base.buildings, ADVISOR_CAP_HOUSE],
    houses: [...base.houses, ADVISOR_CAP_HOUSE_STATE],
    population: base.population + ADVISOR_CAP_HOUSE_STATE.residents,
    tiles: base.tiles.map((tile) =>
      tile.tx === ADVISOR_CAP_HOUSE.tx && tile.ty === ADVISOR_CAP_HOUSE.ty
        ? { ...tile, buildingId: ADVISOR_CAP_HOUSE.id, hasRoad: false }
        : tile,
    ),
  };
}
