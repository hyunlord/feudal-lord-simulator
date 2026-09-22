import { foodFlowLayout, foodFlowRoutes } from '../../src/engine/autoplayFoodFlow';
import { DEFAULT_GAME_STATE } from '../../src/state/gameStore';
import type { Building, BuildingKind } from '../../src/content/buildingConfig';
import type { GameState } from '../../src/engine/engine.types';

export function building(id: string, kind: BuildingKind, tx: number, ty: number, workers: number): Building {
  return { id, kind, tx, ty, workers, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

export const foodBuildRequest = (_state: GameState, kind: BuildingKind) =>
  ({ kind: 'place_building', building: kind, tx: 0, ty: 0 } as const);

export function stressedTown(): GameState {
  const buildings = [building('granary', 'granary', 1, 1, 2),
    ...Array.from({ length: 5 }, (_, n) => building(`mill${n}`, 'mill', 8 + n * 8, 2, 2)),
    ...Array.from({ length: 10 }, (_, n) => building(`farm${n}`, 'wheat_farm', 4 + n * 5, 4, 4)),
    ...Array.from({ length: 16 }, (_, n) => building(`home${n}`, 'house', 10 + n * 2, 0, 0))];
  return { ...structuredClone(DEFAULT_GAME_STATE), tick: 6000, width: 64, height: 8, era: 'palisade', palisade: null,
    buildings, constructionSites: [], walkers: [], population: 256, idleWorkers: 50,
    houses: buildings.filter(b => b.kind === 'house').map((b, n) => ({ buildingId: b.id, level: 3, builtLevel: 3,
      residents: 16, hasWater: true, breadStock: n === 15 ? 0 : 2, lastServicedTick: 0,
      emptyFoodTicks: n === 15 ? 401 : 0, unmetRequirementTicks: 0 })),
    tiles: Array.from({ length: 512 }, (_, n) => ({ tx: n % 64, ty: Math.floor(n / 64), terrain: 'grass',
      hasRoad: [1, 3].includes(Math.floor(n / 64)) || n % 64 === 0, buildingId: null })), pathCache: {},
  };
}

export function routedStockTown(stockIsReachable: boolean): GameState {
  const buildings = [
    building('granary', 'granary', stockIsReachable ? 1 : 20, 2, 2),
    { ...building('mill', 'mill', stockIsReachable ? 5 : 22, 0, 2), productionProgress: 10 },
    { ...building('farm', 'wheat_farm', stockIsReachable ? 7 : 24, 2, 4), inventory: { wheat: 20 } },
    ...Array.from({ length: 8 }, (_, n) => building(`home${n}`, 'house', n, 0, 0)),
  ];
  return { ...structuredClone(DEFAULT_GAME_STATE), tick: 6000, width: 32, height: 5, era: 'hamlet', palisade: null,
    buildings, constructionSites: [], walkers: [], population: 128, idleWorkers: 20,
    houses: buildings.filter(b => b.kind === 'house').map((b, n) => ({ buildingId: b.id, level: 3, builtLevel: 3,
      residents: 16, hasWater: true, breadStock: n === 7 ? 0 : 2, lastServicedTick: 0,
      emptyFoodTicks: n === 7 ? 401 : 0, unmetRequirementTicks: 0 })),
    tiles: Array.from({ length: 160 }, (_, n) => {
      const tx = n % 32;
      const ty = Math.floor(n / 32);
      const hasRoad = ty === 1 && (stockIsReachable || tx <= 10 || tx >= 18);
      return { tx, ty, terrain: 'grass', hasRoad, buildingId: null };
    }), pathCache: {},
  };
}

export function withMeasuredFood(state: GameState, wheat = 20, bread = 10): GameState {
  const sample = { startedTick: state.tick - 400, untilTick: state.tick,
    wheatProduced: wheat, breadProduced: bread, wheatExported: 0, breadExported: 0 };
  return { ...state, autoplayFoodFlow: { layout: foodFlowLayout(state), routes: foodFlowRoutes(state), roadRevision: state.roadRevision, current: sample, completed: sample } };
}
