import assert from 'node:assert/strict';
import { building, state as baseState, stoneSite, palisade, palisadeSegment } from './stoneWallConversionFixtures';
import { buildingFootprint } from '../src/geometry/buildingFootprint';
import type { GameState } from '../src/engine/engine.types';
import { materialRawSource } from '../src/engine/autoplayMaterialRoutes';
import { materialPathKey } from '../src/engine/autoplayMaterialCycle';
import { createSimulationRoutePorts } from '../src/engine/simulationPorts';

export function materialPolicyTown(secondIncumbent = false): GameState {
  const width = 15, height = 8;
  const buildings = [
    building('raw', 'storehouse', 5, 0, { inventory: { stone_raw: 80, timber: 100 } }),
    building('incumbent', 'masonry', 3, 2, { workers: 3 }),
    building('home-a', 'house', 1, 2), building('water', 'well', 2, 1),
    building('market', 'market', 0, 4, { workers: 3 }), building('church', 'church', 3, 5),
    ...(secondIncumbent ? [building('near-active', 'masonry', 11, 2, { workers: 3 })] : []),
  ];
  const sites = [11, 3, 4].map((x, index) => stoneSite(index, { path: [{ x, y: 4 }, { x: x + 1, y: 4 }] }));
  return baseState({ width, height, tick: 1000, era: 'stone_town', eraProclaimedTick: 10, population: 32,
    idleWorkers: 10, treasuryTimber: 0, buildings, walkers: [], pathCache: {}, constructionSites: sites,
    palisade: palisade(sites.map((site, index) => palisadeSegment(index, { edgePath: site.path, replacementConstructionSiteId: site.id }))),
    houses: [{ buildingId: 'home-a', level: 4, builtLevel: 4, residents: 32, hasWater: true, breadStock: 12,
      lastServicedTick: 1000, unmetRequirementTicks: 0 }],
    tiles: Array.from({ length: width * height }, (_, index) => {
      const tx = index % width, ty = Math.floor(index / width);
      const owner = buildings.find(home => { const size = buildingFootprint(home);
        return tx >= home.tx && tx < home.tx + size.width && ty >= home.ty && ty < home.ty + size.height; });
      const hasRoad = ty === 3 || tx === 6 && ty === 2 || tx === 2 && (ty === 4 || ty === 5);
      return { tx, ty, hasRoad, buildingId: owner?.id ?? null,
        terrain: owner || hasRoad || tx === 7 && ty === 2 ? 'grass' : 'rock' };
    }),
  });
}

export function observedMaterialTown(): GameState {
  const state = materialPolicyTown(), home = state.buildings.find(item => item.id === 'incumbent');
  assert.ok(home);
  const source = materialRawSource(state, home, createSimulationRoutePorts(state).delivery);
  assert.ok(source);
  const wallId = state.palisade?.id, epoch = state.eraProclaimedTick;
  assert.ok(wallId && epoch !== null);
  return { ...state, autoplayMaterialRecovery: { version: 1, status: 'observing', wallId, epoch, incumbentId: home.id,
    completedCycle: { startedTick: 100, returnedTick: 999, sourceId: source.building.id, fetchWalkerId: 'prior-fetch',
      rawPath: materialPathKey(source.path), rawEdges: source.path.length - 1, roadRevision: state.roadRevision,
      outputWalkerId: 'prior-output', deliveredSiteId: 'earlier-wall', outputEdges: 8, rawArrived: 8, produced: 4,
      wallDelivered: 4, workingTicks: 180, haulNoInputTicks: 300 } } };
}
