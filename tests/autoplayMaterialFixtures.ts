import { building, state as baseState, stoneSite, palisade, palisadeSegment } from './stoneWallConversionFixtures';
import type { GameState } from '../src/engine/engine.types';
import type { MaterialCycle, MaterialScore } from '../src/engine/autoplayMaterialTypes';
export function materialTown(width = 12): GameState {
  const buildings = [building('raw', 'storehouse', 0, 0, { inventory: { stone_raw: 80, timber: 100 } }),
    building('masonry', 'masonry', width - 3, 1, { workers: 3 }), building('home-a', 'house', width - 1, 0)];
  const wall = stoneSite(0, { path: [{ x: width - 3, y: 3 }, { x: width - 2, y: 3 }] });
  return baseState({ width, height: 5, buildings, era: 'stone_town', eraProclaimedTick: 10, walkers: [], palisade: palisade([palisadeSegment(0, { edgePath: wall.path, replacementConstructionSiteId: wall.id })]),
    houses: baseState().houses.map(home => ({ ...home, breadStock: 1000 })),
    constructionSites: [wall],
    tiles: Array.from({ length: width * 5 }, (_, index) => {
      const tx = index % width, ty = Math.floor(index / width);
      return { tx, ty, terrain: 'grass', hasRoad: ty === 2 && tx >= 1 && tx < width - 1 || tx === 2 && ty === 1,
        buildingId: tx < 2 && ty < 2 ? 'raw' : tx === width - 3 && ty === 1 ? 'masonry' : tx === width - 1 && ty === 0 ? 'home-a' : null };
    }) });
}
export const syntheticCycle: MaterialCycle = { startedTick: 1, returnedTick: 90, sourceId: 'raw', fetchWalkerId: 'prior-fetch',
  rawPath: '2,1', rawEdges: 0, roadRevision: 0, rawArrived: 8, produced: 4, wallDelivered: 4, workingTicks: 180, haulNoInputTicks: 300,
  outputWalkerId: 'prior-output', deliveredSiteId: 'old-wall-site', outputEdges: 1 };
export const syntheticScore: MaterialScore = { score: 1, incumbentScore: 2, activeEdges: 1, incumbentActiveEdges: 2, sourceId: 'raw', rawEdges: 0, admittedRaw: 8 };
