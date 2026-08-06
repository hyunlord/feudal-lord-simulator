import { BALANCE } from "../content/balanceConfig";
import { buildingRoadAccessTiles } from "../engine/routing";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { existingRoadComponent, getOrthogonalRoadNeighbors } from "../world/roadGraph";

function coordinateKey(coordinate: TileCoordinate): string {
  return `${coordinate.tx},${coordinate.ty}`;
}

export function distributionReachTiles(state: GameState): readonly TileCoordinate[] {
  const frontier = state.buildings
    .filter((building) => building.kind === "granary")
    .flatMap((building) =>
      buildingRoadAccessTiles(state, building).map((coordinate) => ({ coordinate, distance: 0 })),
    );
  const reached: TileCoordinate[] = [];
  const visited = new Set<string>();

  for (let index = 0; index < frontier.length; index += 1) {
    const current = frontier[index];
    if (current === undefined) continue;
    const key = coordinateKey(current.coordinate);
    if (visited.has(key) || current.distance > BALANCE.DISTRIBUTOR_RANGE) continue;
    visited.add(key);
    reached.push(current.coordinate);

    if (current.distance === BALANCE.DISTRIBUTOR_RANGE) continue;
    for (const neighbor of getOrthogonalRoadNeighbors(state, current.coordinate)) {
      if (!visited.has(coordinateKey(neighbor))) {
        frontier.push({ coordinate: neighbor, distance: current.distance + 1 });
      }
    }
  }
  return reached;
}

export function selectedBuildingRoadComponent(
  state: GameState,
  selectedBuildingId: string | null,
): readonly TileCoordinate[] {
  if (selectedBuildingId === null) return [];
  const building = state.buildings.find((candidate) => candidate.id === selectedBuildingId);
  if (building === undefined) return [];
  return existingRoadComponent(state, buildingRoadAccessTiles(state, building));
}
