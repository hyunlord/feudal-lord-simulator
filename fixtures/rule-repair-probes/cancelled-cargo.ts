import { DEFAULT_GAME_STATE, gameReducer } from '../../src/state/gameStore';
import { advanceTick } from '../../src/engine/tick';
import { createConstructionSite } from '../../src/economy/construction';
import type { GameState } from '../../src/engine/engine.types';

// Storehouse (only store) full at 200; site already has 16 timber delivered; treasury 0.
const s0 = structuredClone(DEFAULT_GAME_STATE);
const site = { ...createConstructionSite({ ordinal: 1, kind: 'sawmill', tx: 48, ty: 40, startedTick: 0 }), delivered: { timber: 16 } };
let s: GameState = { ...s0, treasuryTimber: 0,
  buildings: s0.buildings.map(b => b.kind === 'storehouse' ? { ...b, inventory: { timber: 200 } } : b),
  tiles: s0.tiles.map(t => t.tx === 48 && t.ty === 40 ? { ...t, buildingId: site.id } : t),
  constructionSites: [site], nextConstructionOrdinal: 2 };
s = advanceTick(s);
const store = () => s.buildings.find(b => b.kind === 'storehouse')!;
const carters = () => s.walkers.filter(w => w.kind === 'carter').map(w => `${w.id} ${w.phase} cargo=${w.cargo?.amount ?? 0} cancel=${w.cancellation?.reason ?? '-'}`);
console.log('t', s.tick, 'store', JSON.stringify(store().inventory), 'carters', carters());
for (let i = 0; i < 20; i += 1) s = advanceTick(s);
s = gameReducer(s, { type: 'cancel_construction', siteId: site.id } as never);
console.log('after cancel t', s.tick, 'store', JSON.stringify(store().inventory), 'reserved', JSON.stringify(store().reserved), 'treasury', s.treasuryTimber, 'carters', carters());
// A second site that also needs timber from this storehouse.
const site2 = createConstructionSite({ ordinal: s.nextConstructionOrdinal, kind: 'wheat_farm', tx: 48, ty: 42, startedTick: s.wallTick });
s = { ...s, constructionSites: [...s.constructionSites, site2], nextConstructionOrdinal: s.nextConstructionOrdinal + 1,
  tiles: s.tiles.map(t => (t.tx === 48 || t.tx === 49) && (t.ty === 42 || t.ty === 43) ? { ...t, buildingId: site2.id } : t) };
for (let i = 0; i < 3000; i += 1) s = advanceTick(s);
const s2 = s.constructionSites.find(x => x.id === site2.id);
console.log('t', s.tick, 'store', JSON.stringify(store().inventory), 'treasury', s.treasuryTimber, 'carters', carters(),
  'site2', s2 === undefined ? 'completed/absent' : `delivered=${JSON.stringify(s2.delivered)} reserved=${JSON.stringify(s2.reserved)} stall=${s2.stall}`);
