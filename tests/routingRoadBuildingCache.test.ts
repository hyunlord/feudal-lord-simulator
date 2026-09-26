import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { Building } from '../src/content/buildingConfig';
import type { GameState } from '../src/engine/engine.types';
import { resolveRoadToBuildingRoute } from '../src/engine/routing';
import { advanceTick } from '../src/engine/tick';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';

const destination: Building = { id: 'home', kind: 'house', tx: 6, ty: 3, workers: 0,
  inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
const start = { tx: 1, ty: 3 };
function town(): GameState {
  return { ...structuredClone(DEFAULT_GAME_STATE), width: 8, height: 8, buildings: [destination], houses: [],
    tiles: Array.from({ length: 64 }, (_, n) => ({ tx: n % 8, ty: Math.floor(n / 8), terrain: 'grass', hasRoad: true, buildingId: null })),
    palisade: null, roadRevision: 1, pathCache: {} };
}
function cold(state: GameState, target = destination) {
  return resolveRoadToBuildingRoute({ ...state, tiles: [...state.tiles] }, start, target);
}
function wall(completed: boolean, gateY: number): NonNullable<GameState['palisade']> {
  return { id: 'wall', gate: { x: 4, y: gateY }, polygon: [], segments: [{ id: 'segment', order: 0,
    edgePath: [{ x: 4, y: 0 }, { x: 4, y: 8 }], tileCount: 8, completed, constructionSiteId: null, material: 'timber' }] };
}

test('road-to-building cold and repeated queries keep exact path order and serialized state', () => {
  const state = town();
  const before = JSON.stringify(state);
  const expected = [1, 2, 3, 4, 5].map(tx => ({ tx, ty: 3 }));
  assert.deepEqual(resolveRoadToBuildingRoute(state, start, destination), expected);
  const changed = { ...state, tick: 900, buildings: [{ ...destination, inventory: { bread: 20 }, workers: 2 }] };
  assert.deepEqual(resolveRoadToBuildingRoute(changed, start, changed.buildings[0]!), expected);
  assert.equal(JSON.stringify(state), before);
});

test('immutable road and bridge edits invalidate successful and null road-to-building paths', () => {
  const state = town();
  const line = { ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: tile.ty === 3 })) };
  assert.ok(resolveRoadToBuildingRoute(line, start, destination));
  const broken = { ...line, tiles: line.tiles.map(tile => tile.tx === 3 ? { ...tile, hasRoad: false } : tile) };
  assert.equal(resolveRoadToBuildingRoute(broken, start, destination), null);
  assert.equal(resolveRoadToBuildingRoute(broken, start, destination), null);
  const bridge = { ...line, tiles: line.tiles.map(tile => tile.tx === 3 ? { ...tile, terrain: 'water' as const } : tile) };
  assert.deepEqual(resolveRoadToBuildingRoute(bridge, start, destination), cold(bridge));
  assert.ok(resolveRoadToBuildingRoute(bridge, start, destination));
  const invalidBridge = { ...bridge, tiles: bridge.tiles.map(tile => tile.tx === 2 && tile.ty === 3 ? { ...tile, buildingId: 'blocking-bank' } : tile) };
  assert.equal(resolveRoadToBuildingRoute(invalidBridge, start, destination), null);
  assert.ok(resolveRoadToBuildingRoute(line, start, destination));
});

test('wall completion, main gate and auxiliary gate changes invalidate without a revision bump', () => {
  const state = town();
  const unfinished = { ...state, palisade: wall(false, -2) };
  assert.ok(resolveRoadToBuildingRoute(unfinished, start, destination));
  const closed = { ...state, palisade: wall(true, -2) };
  assert.equal(resolveRoadToBuildingRoute(closed, start, destination), null);
  const mainGate = { ...state, palisade: wall(true, 3.5) };
  assert.deepEqual(resolveRoadToBuildingRoute(mainGate, start, destination), cold(mainGate));
  assert.ok(resolveRoadToBuildingRoute(mainGate, start, destination));
  const auxiliary = { ...closed, palisade: { ...closed.palisade, additionalGates: [{ x: 4, y: 3.5 }] } };
  assert.ok(resolveRoadToBuildingRoute(auxiliary, start, destination));
  assert.equal(resolveRoadToBuildingRoute(closed, start, destination), null);
});

test('destination position, kind, actual merged footprint and grid dimensions are cache inputs', () => {
  const state = town();
  resolveRoadToBuildingRoute(state, start, destination);
  for (const target of [{ ...destination, tx: 5, ty: 5 }, { ...destination, kind: 'mill' as const },
    { ...destination, houseLot: 'horizontal' as const }, { ...destination, houseLot: 'vertical' as const }]) {
    assert.deepEqual(resolveRoadToBuildingRoute(state, start, target), cold(state, target));
  }
  const short = { ...state, height: 3 };
  assert.equal(resolveRoadToBuildingRoute(short, start, destination), null);
  const narrow = { ...state, width: 7 };
  assert.deepEqual(resolveRoadToBuildingRoute(narrow, start, destination), cold(narrow));
  assert.deepEqual(resolveRoadToBuildingRoute(state, start, destination), cold(state));
  assert.deepEqual(resolveRoadToBuildingRoute({ ...state, roadRevision: 2 }, start, destination), cold(state));
});

test('merged footprint and building kind changes replace an actually shorter perimeter route', () => {
  const state = town();
  for (const [point, target] of [
    [{ tx: 7, ty: 4 }, { ...destination, houseLot: 'horizontal' as const }],
    [{ tx: 5, ty: 4 }, { ...destination, houseLot: 'vertical' as const }],
    [{ tx: 5, ty: 4 }, { ...destination, kind: 'wheat_farm' as const }],
  ] as const) {
    const single = resolveRoadToBuildingRoute(state, point, destination);
    const changed = resolveRoadToBuildingRoute(state, point, target);
    assert.ok(single && changed);
    assert.ok(changed.length < single.length);
    assert.deepEqual(changed, resolveRoadToBuildingRoute({ ...state, tiles: [...state.tiles] }, point, target));
  }
});

test('road-to-building query order cannot change equal-length route selection', () => {
  const state = town();
  const targets = [destination, { ...destination, id: 'second', tx: 2, ty: 6 }];
  const expected = targets.map(target => cold(state, target));
  for (const target of [...targets].reverse()) resolveRoadToBuildingRoute(state, start, target);
  assert.deepEqual(targets.map(target => resolveRoadToBuildingRoute(state, start, target)), expected);
});

test('road-to-building memoization reuses paths but evicts after2048 distinct requests', () => {
  const state = town();
  const first = resolveRoadToBuildingRoute(state, start, destination);
  assert.ok(first);
  assert.equal(resolveRoadToBuildingRoute({ ...state, tick: 5 }, start, { ...destination, inventory: { bread: 5 }, workers: 3 }), first);
  for (let n = 0; n < 2048; n += 1) resolveRoadToBuildingRoute(state, start, { ...destination, id: `other-${n}` });
  const afterEviction = resolveRoadToBuildingRoute(state, start, destination);
  assert.notEqual(afterEviction, first);
  assert.deepEqual(afterEviction, first);
});

test('natural seed3 full state including serialized pathCache stays identical after120 cold and warm ticks', () => {
  const initial: GameState = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/routing/seed3-403cfa9-324000.json.gz', import.meta.url))).toString());
  let warm = initial;
  let coldState = structuredClone(initial);
  for (let n = 0; n < 120; n += 1) {
    warm = advanceTick(warm);
    coldState = advanceTick({ ...coldState, tiles: [...coldState.tiles] });
  }
  const hash = (state: GameState) => createHash('sha256').update(JSON.stringify(state)).digest('hex');
  // B2/K4-1: this stone-town city has no completed stone wall, so its prosperity hold now counts (0 -> 120).
  // C2 (spec M-1): the market no longer pays the treasury, so the ledger and treasury differ from B3 (13740b9c…).
  // Without any money field the state is the pre-C2 one (4950b10 gives 6a7136ec… for the same stripped state).
  // C1c-2: the food-flow and recurring-delivery layout keys list farmsteads (AF-13), and a converter with nothing in
  // store fetches from its producer while deliveries leave claimed stock alone (AF-9), so carters, buildings and the
  // path cache differ from d823005 (cb416e16… / 6a7136ec…). Cold and warm caches still agree (below).
  // C3: households (members), labour v2 (field hands, granary haulers, `labour`) and the mills' intake carts change
  // houses, buildings and walkers from C1c-2 (03db9d54… / 144a486d…).
  // F0-A: winter meals eat 1.2× and the state records seasons, eras and household shortages (spec FP-*), so houses and
  // the state differ from C3 (2fc10332… / b40558e9…). Cold and warm caches still agree (below).
  // F0-B: the weather takes its share of wet summers' harvests and the state records events (spec EV-*), so the state
  // differs from F0-A (4bdd32a8… / fe6ed3b3…). Cold and warm caches still agree (below).
  // F0-C1: the state records politics (petitions, rights, the chapter) and the market charter lowers stall fees, so the
  // state differs from F0-B (1aaecca7… / 0effea2a…).
  assert.equal(hash(warm), '295502ea582dc05d9fb86c8b76f50099627b3e6ec75023348f048c77029d7eb8');
  const { coinLedger: _coinLedger, ledger: _ledger, treasuryCoin: _treasury, money: _money, ...withoutMoney } = warm as GameState & { coinLedger?: unknown };
  const moneyFree = { ...withoutMoney, buildings: withoutMoney.buildings.map(({ upkeepUnpaid: _unpaid, ...building }) => building) };
  assert.equal(createHash('sha256').update(JSON.stringify(moneyFree)).digest('hex'), '24f719ed7f3841658308325a1db67afbf0e871fd4b29d21c15965dd26f74d20b');
  assert.equal(hash(coldState), hash(warm));
});
