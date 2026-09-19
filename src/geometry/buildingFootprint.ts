import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";

export type BuildingFootprint = Readonly<{ width: number; height: number }>;

export function buildingFootprint(building: Pick<Building, "kind" | "houseLot">): BuildingFootprint {
  if (building.kind === "house") {
    if (building.houseLot === "horizontal") return { width: 2, height: 1 };
    if (building.houseLot === "vertical") return { width: 1, height: 2 };
  }
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  return { width: definition.width, height: definition.height };
}

export function houseLotArea(building: Pick<Building, "kind" | "houseLot"> | undefined): number {
  return building?.kind === "house" && building.houseLot !== undefined ? 2 : 1;
}
