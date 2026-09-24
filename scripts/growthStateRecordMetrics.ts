import type { GameState } from '../src/engine/engine.types';
import { buildingFootprint } from '../src/geometry/buildingFootprint';
import { constructionSiteFootprint, isBuildingConstructionSite } from '../src/economy/construction';
import { housingLotCount } from '../src/population/housing';
import { isPointInsidePalisade } from '../src/world/palisadeGeometry';

/** Density only: proclaimed polygon, even while unfinished; never a pass/fail criterion. */
export function growthDensityMetrics(state: GameState) {
  const lots = housingLotCount(state);
  const buildings = state.buildings.length;
  const occupied = new Set<string>();
  const farmTiles = new Set<string>();
  for (const building of state.buildings) {
    const footprint = buildingFootprint(building);
    for (let dy = 0; dy < footprint.height; dy += 1) for (let dx = 0; dx < footprint.width; dx += 1) {
      const key = `${building.tx + dx},${building.ty + dy}`;
      occupied.add(key);
      if (building.kind === 'wheat_farm') farmTiles.add(key);
    }
  }
  for (const site of state.constructionSites.filter(isBuildingConstructionSite)) {
    const footprint = constructionSiteFootprint(site);
    for (let dy = 0; dy < footprint.height; dy += 1) for (let dx = 0; dx < footprint.width; dx += 1) occupied.add(`${site.tx + dx},${site.ty + dy}`);
  }
  const polygon = state.palisade?.polygon;
  const inside = polygon === undefined ? [] : state.tiles.filter(tile => isPointInsidePalisade({ x: tile.tx + 0.5, y: tile.ty + 0.5 }, polygon));
  const insideFarmTiles = inside.filter(tile => farmTiles.has(`${tile.tx},${tile.ty}`)).length;
  const emptyLandTiles = inside.filter(tile => tile.terrain === 'grass' && !tile.hasRoad && tile.buildingId === null && !occupied.has(`${tile.tx},${tile.ty}`)).length;
  return {
    buildings, lots, buildingsPerLot: lots === 0 ? null : buildings / lots,
    wallInterior: polygon === undefined ? null : {
      tileCount: inside.length, farmTiles: insideFarmTiles, emptyLandTiles,
      farmAreaRatio: inside.length === 0 ? null : insideFarmTiles / inside.length,
      emptyLandRatio: inside.length === 0 ? null : emptyLandTiles / inside.length,
      shareOfFarmAreaInside: farmTiles.size === 0 ? null : insideFarmTiles / farmTiles.size,
      completedSegments: state.palisade?.segments.filter(segment => segment.completed).length ?? 0,
      totalSegments: state.palisade?.segments.length ?? 0,
      definition: 'Tile centers inside proclaimed polygon, including unfinished walls; empty means grass without road, building or building construction footprint. Geometric area only, not proof that a footprint is legally buildable.',
    },
  };
}
