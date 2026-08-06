import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import type { TileCoordinate } from "../src/world/grid";

export function placeFinishedBuilding(
  state: GameState,
  kind: BuildingKind,
  origin: TileCoordinate,
): GameState {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  const id = `${kind}-${origin.tx}-${origin.ty}-fixture`;
  const building: Building = {
    id,
    kind,
    tx: origin.tx,
    ty: origin.ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
  return {
    ...state,
    tiles: state.tiles.map((tile) => {
      const inside =
        tile.tx >= origin.tx &&
        tile.tx < origin.tx + definition.width &&
        tile.ty >= origin.ty &&
        tile.ty < origin.ty + definition.height;
      return inside ? { ...tile, buildingId: id } : tile;
    }),
    buildings: [...state.buildings, building],
    houses: kind === "house"
      ? [
          ...state.houses,
          {
            buildingId: id,
            level: 0,
            residents: 0,
            hasWater: false,
            breadStock: 0,
            lastServicedTick: state.tick,
            unmetRequirementTicks: 0,
          },
        ]
      : state.houses,
  };
}
