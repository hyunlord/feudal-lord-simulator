import type { Building } from '../content/buildingConfig';
import { buildingRoadAccessTiles } from './routing';
import { labelRoadComponents } from '../world/roadGraph';
import type { WallGrid } from '../world/wallTraversal';

export function marketRoadService(grid: WallGrid): (home: Building, market: Building) => boolean {
  const labels = labelRoadComponents(grid);
  const accessLabels = new Map<Building, ReadonlySet<number>>();
  const components = (building: Building): ReadonlySet<number> => {
    const cached = accessLabels.get(building);
    if (cached !== undefined) return cached;
    const result = new Set<number>();
    for (const road of buildingRoadAccessTiles(grid, building)) {
      const label = labels.get(`${road.tx},${road.ty}`);
      if (label !== undefined) result.add(label);
    }
    accessLabels.set(building, result);
    return result;
  };
  return (home, market) => {
    const homeComponents = components(home);
    return [...components(market)].some(label => homeComponents.has(label));
  };
}
