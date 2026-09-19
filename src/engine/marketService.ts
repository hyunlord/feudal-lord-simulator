import type { Building } from '../content/buildingConfig';
import { buildingRoadAccessTiles } from './routing';
import { existingRoadComponent } from '../world/roadGraph';
import type { WallGrid } from '../world/wallTraversal';

export function marketRoadService(grid: WallGrid): (home: Building, market: Building) => boolean {
  const components = new Map<string, ReadonlySet<string>>();
  return (home, market) => {
    let roads = components.get(home.id);
    if (roads === undefined) {
      roads = new Set(existingRoadComponent(grid, buildingRoadAccessTiles(grid, home)).map(road => `${road.tx},${road.ty}`));
      components.set(home.id, roads);
    }
    return buildingRoadAccessTiles(grid, market).some(road => roads.has(`${road.tx},${road.ty}`));
  };
}
