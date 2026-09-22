import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';
import type { GameState } from '../src/engine/engine.types';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';

/** Prepared connected town: no production history is invented for policy tests. */
export function connectedHousingFixture(count = 4): GameState {
  const make = (id: string, kind: Building['kind'], tx: number, ty: number): Building => ({ id, kind, tx, ty,
    workers: BUILDING_CONFIG_BY_KIND[kind].workersRequired, inventory: kind === 'storehouse' ? { timber: 100, stone: 100 } : {},
    reserved: {}, stockReserved: {}, productionProgress: 0 });
  const homes = Array.from({ length: count }, (_, index) => make(`home-${index}`, 'house', 6 + index, 10));
  const buildings = [...homes, make('well', 'well', 9, 9), make('market', 'market', 10, 12),
    make('church', 'church', 15, 12), make('store', 'storehouse', 20, 12),
    { ...make('granary', 'granary', 20, 8), inventory: { bread: 80 } },
    make('farm', 'wheat_farm', 5, 5), make('mill', 'mill', 5, 8)];
  return { ...structuredClone(DEFAULT_GAME_STATE), width: 30, height: 20, era: 'stone_town',
    buildings, palisade: null, constructionSites: [], walkers: [], population: count * 22, idleWorkers: 20, treasuryTimber: 500,
    houses: homes.map(home => ({ buildingId: home.id, level: 3, residents: 22, breadStock: 20,
      hasWater: true, lastServicedTick: 0, unmetRequirementTicks: 0 })),
    tiles: Array.from({ length: 600 }, (_, index) => {
      const tx = index % 30, ty = Math.floor(index / 30);
      const owner = buildings.find(b => tx >= b.tx && tx < b.tx + BUILDING_CONFIG_BY_KIND[b.kind].width
        && ty >= b.ty && ty < b.ty + BUILDING_CONFIG_BY_KIND[b.kind].height);
      return { tx, ty, terrain: 'grass', buildingId: owner?.id ?? null,
        hasRoad: !owner && ((ty === 7 || ty === 11) && tx >= 3 && tx <= 25 || tx === 3 && ty >= 7 && ty <= 11) };
    }) };
}
