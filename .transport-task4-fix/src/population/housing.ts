import type { House } from "./population.types";

export function evolveHouse(house: House): House {
  const sustenanceAvailable = house.hasWater && house.breadStock > 0;
  const residents = sustenanceAvailable
    ? house.residents + 1
    : Math.max(0, house.residents - 1);
  const breadStock = sustenanceAvailable ? house.breadStock - 1 : house.breadStock;
  const level = Math.max(0, Math.min(3, Math.floor(residents / 2)));

  return {
    ...house,
    residents,
    breadStock,
    level,
  };
}
