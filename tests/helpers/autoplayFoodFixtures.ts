import { foodFlowLayout, foodFlowRoutes } from '../../src/engine/autoplayFoodFlow';
import { DEFAULT_GAME_STATE } from '../../src/state/gameStore';
import type { Building, BuildingKind } from '../../src/content/buildingConfig';
import type { GameState } from '../../src/engine/engine.types';
import type { Zone } from '../../src/zones/zone.types';

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

/**
 * AF-13: appends two ample farmsteads (each tending a 31×2 arable block, ~1580 wheat/year) past the
 * fixture's own map, wired into its existing road network (from the first road tile found) so
 * `measuredFoodDecision`'s expected-harvest grain check reads "not short" no matter how much bread the
 * fixture's houses demand. Use this where a test's point is the bread/mill logic downstream of grain, not
 * the grain decision itself.
 */
export function withAmpleGrain(state: GameState): GameState {
  const width = state.width;
  const height = state.height;
  const anchor = state.tiles.find(tile => tile.hasRoad) ?? { tx: 0, ty: 0 };
  const corridorX = anchor.tx;
  const corridorRow = height;
  const farmRow = height + 1;
  const zoneRow0 = height + 2;
  const newWidth = Math.max(width, corridorX + 70);
  const newHeight = height + 4;
  const oldRows = Array.from({ length: height }, (_, ty) => {
    const row = state.tiles.slice(ty * width, ty * width + width)
      .map(tile => tile.tx === corridorX && ty > anchor.ty ? { ...tile, hasRoad: true, buildingId: null } : tile);
    const pad = Array.from({ length: newWidth - width }, (_, i) => ({ tx: width + i, ty, terrain: 'grass' as const, hasRoad: false, buildingId: null }));
    return [...row, ...pad];
  }).flat();
  const newRows = Array.from({ length: newHeight - height }, (_, offset) => {
    const ty = height + offset;
    return Array.from({ length: newWidth }, (_, tx) => ({
      tx, ty, terrain: 'grass' as const, buildingId: null,
      hasRoad: (tx === corridorX && ty <= corridorRow) || (ty === corridorRow && tx >= corridorX && tx <= corridorX + 66),
    }));
  }).flat();
  const strip = (colFrom: number): readonly number[] => {
    const cells: number[] = [];
    for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 31; dx += 1) cells.push((zoneRow0 + dy) * newWidth + (colFrom + dx));
    return cells.sort((a, b) => a - b);
  };
  const zones: Zone[] = [
    { id: 'zone-ample-grain-a', kind: 'arable', strokes: [], membership: strip(corridorX + 1), createdOrdinal: 9001 },
    { id: 'zone-ample-grain-b', kind: 'arable', strokes: [], membership: strip(corridorX + 35), createdOrdinal: 9002 },
  ];
  return {
    ...state, width: newWidth, height: newHeight, tiles: [...oldRows, ...newRows], pathCache: {},
    zones: [...(state.zones ?? []), ...zones],
    buildings: [...state.buildings,
      building('ample-farmstead-a', 'farmstead', corridorX + 1, farmRow, 4),
      building('ample-farmstead-b', 'farmstead', corridorX + 35, farmRow, 4)],
  };
}

export function withMeasuredFood(state: GameState, wheat = 20, bread = 10): GameState {
  const sample = { startedTick: state.tick - 400, untilTick: state.tick,
    wheatProduced: wheat, breadProduced: bread, wheatExported: 0, breadExported: 0 };
  return { ...state, autoplayFoodFlow: { layout: foodFlowLayout(state), routes: foodFlowRoutes(state), roadRevision: state.roadRevision, current: sample, completed: sample } };
}
