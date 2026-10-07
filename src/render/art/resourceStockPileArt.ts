import type { Building } from '../../content/buildingConfig';
import type { GameState } from '../../engine/engine.types';
import { stateCalendar } from '../../engine/scenarioState';
import type { ArtEntry, ArtPoint, StockPileEntry } from './artContract';
import { createArtAdapters } from './artAdapters';
import type { ArtImageEnvironment } from './artImageLoader';
import type { ArtRegistry } from './artRegistry';
import { ART_REGISTRY } from './wave42Registry';

type StockState = Pick<GameState, 'seed' | 'tick' | 'scenarioId'>;
function isStockPile(entry: ArtEntry | null): entry is StockPileEntry {
  return entry?.kind === 'ground-prop' && entry.placement === 'stock-pile';
}
/** Only real positive inventory is a selector fact; the catalogue owns resource and building membership. */
export function createResourceStockPileArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  const adapters = createArtAdapters(registry, environment);
  const resources = [...new Set(registry.entries('ground-prop').filter(isStockPile).map(entry => entry.resource))];
  const select = (state: StockState, building: Pick<Building, 'id' | 'kind' | 'inventory'>): StockPileEntry | null => {
    const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
    const season = seasons[stateCalendar(state).season];
    const seed = stockPileSeed(building.id, state.seed);
    for (const resource of resources) {
      const amount = Object.entries(building.inventory).find(([key]) => key === resource)?.[1] ?? 0;
      if (!(amount > 0)) continue;
      const entry = registry.select('ground-prop', 'stock-pile', { placement: 'stock-pile', buildingKind: building.kind, resource, season }, seed);
      if (isStockPile(entry) && entry.resource === resource) return entry;
    }
    return null;
  };
  const draw = (context: Parameters<typeof adapters.draw>[0], state: StockState, building: Building, at: ArtPoint): boolean => {
    const entry = select(state, building);
    return entry !== null && adapters.draw(context, entry.id, { at });
  };
  return { select, draw, loadSettled: adapters.loadSettled, placement: adapters.placement };
}
export const RESOURCE_STOCK_PILE_ART = createResourceStockPileArt(ART_REGISTRY);

// Preserve the authored a/b choice without activating the optional curved-ground modules.
function stockPileSeed(id: string, seed: number): number {
  let key = 2_166_136_261;
  for (const character of id) {
    const scaled = character.charCodeAt(0) * 1024;
    key = Math.imul(key ^ (scaled & 0xffff), 16_777_619) >>> 0;
    key = Math.imul(key ^ ((scaled >>> 16) & 0xffff), 16_777_619) >>> 0;
  }
  let hash = Math.imul(key ^ 0x9e37_79b9, 73_856_093) ^ Math.imul(seed + 101_111, 19_349_663) ^ Math.imul(38, 83_492_791);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  return (hash ^ (hash >>> 15)) >>> 0;
}
