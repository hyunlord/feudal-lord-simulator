import { DEFAULT_GAME_STATE } from '../../src/state/gameStore';
import { settleMarkets } from '../../src/engine/marketSettlement';
import { createConstructionSite } from '../../src/economy/construction';
import { placementSpendableResource } from '../../src/world/placement';
import type { GameState } from '../../src/engine/engine.types';

const market = { id: 'market-48-39-probe', kind: 'market' as const, tx: 48, ty: 39, workers: 3, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
function base(era: GameState['era'], store: Record<string, number>, siteKind: 'keep' | 'sawmill'): GameState {
  const s = structuredClone(DEFAULT_GAME_STATE);
  const site = createConstructionSite({ ordinal: 1, kind: siteKind, tx: 30, ty: 30, startedTick: 0 });
  return { ...s, tick: 80, era,
    buildings: [...s.buildings.map(b => b.kind === 'storehouse' ? { ...b, inventory: { ...store } } : b), market],
    tiles: s.tiles.map(t => (t.tx === 48 || t.tx === 49) && (t.ty === 39 || t.ty === 40) ? { ...t, buildingId: market.id } : t),
    constructionSites: [site], nextConstructionOrdinal: 2 };
}
// 1) stone_town: keep site needs 150 stone; storehouse has 100 stone.
let a = base('stone_town', { stone: 100 }, 'keep');
const before = placementSpendableResource(a, 'stone');
for (let t = 80; t <= 80 * 30; t += 80) a = settleMarkets({ ...a, tick: t });
const storeA = a.buildings.find(b => b.kind === 'storehouse')!;
console.log('stone_town keep-site need', a.constructionSites[0]!.required, 'spendable stone before', before,
  'after 30 cadences stone', storeA.inventory.stone ?? 0, 'coin', a.treasuryCoin, 'spendable after', placementSpendableResource(a, 'stone'));
// 2) palisade: sawmill site needs 30 timber; storehouse has 70 timber.
let b = base('palisade', { timber: 70 }, 'sawmill');
const tb = placementSpendableResource(b, 'timber');
for (let t = 80; t <= 80 * 30; t += 80) b = settleMarkets({ ...b, tick: t });
console.log('palisade sawmill-site need', b.constructionSites[0]!.required, 'spendable timber before', tb,
  'storehouse timber after', b.buildings.find(x => x.kind === 'storehouse')!.inventory.timber ?? 0, 'coin', b.treasuryCoin,
  'spendable after', placementSpendableResource(b, 'timber'));
