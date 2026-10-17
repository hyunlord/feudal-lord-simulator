/**
 * STONE-FEED (the user's ruling 2026-10-17): in lord mode the masonry is an `INPUT_PULL` converter — its raw stone comes
 * by intake carts reordered by the round trip, while its main cart carries the stone out; elsewhere one cart as before.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnCarters } from '../src/agents/delivery';
import { inputReorderPoint } from '../src/agents/deliverySpawn';
import { INPUT_PULL } from '../src/content/recoveryConfig';
import { building, DELIVERY_INVENTORY, routePort } from './deliveryFixtures';

const MASONRY = INPUT_PULL.chains.find(chain => chain.converter === 'masonry')!;
const straight = (tiles: number) => Array.from({ length: tiles }, (_, index) => ({ tx: index, ty: 0 }));
const carts = (result: ReturnType<typeof spawnCarters>, cart: 'intake' | undefined) =>
  result.walkers.filter(walker => walker.kind === 'carter' && walker.homeBuildingId === 'masonry' && walker.cart === cart);

test('STONE-FEED the masonry reorders raw stone by its round trip, never below one stone\'s', () => {
  assert.equal(inputReorderPoint(MASONRY, 1), 2);
  assert.ok(inputReorderPoint(MASONRY, 28) > 2, `${inputReorderPoint(MASONRY, 28)}`);
});

test('STONE-FEED in lord mode a far masonry whose cart carries its stone out still gets raw stone by an intake cart; without the pull it waits', () => {
  // Three raw stone (above the old fetch at 2) and stone to carry out: the main cart takes the stone to the store.
  const masonry = building('masonry', 'masonry', { inventory: { stone_raw: 3, stone: 8 } });
  const store = building('store', 'storehouse', { inventory: { stone_raw: 100 } });
  const routes = routePort({ 'masonry->store': straight(28) });
  const step = (inputPull: boolean) => spawnCarters({ tick: 1, buildings: [masonry, store], walkers: [], inventory: DELIVERY_INVENTORY, routes, inputPull });
  const one = step(false);
  assert.equal(carts(one, undefined).length, 1, 'the main cart goes out');
  assert.equal(carts(one, 'intake').length, 0, 'no intake cart without the pull');
  const pulled = step(true);
  assert.equal(carts(pulled, undefined).length, 1);
  assert.ok(carts(pulled, 'intake').length >= 1, 'an intake cart fetches the raw stone while the main cart is out');
  assert.equal((carts(pulled, 'intake')[0] as { mission?: string }).mission, 'fetch');
});

test('STONE-FEED a masonry next to its raw stone keeps the old fetch under pull', () => {
  const masonry = building('masonry', 'masonry', { inventory: { stone_raw: 3, stone: 8 } });
  const store = building('store', 'storehouse', { inventory: { stone_raw: 100 } });
  const result = spawnCarters({ tick: 1, buildings: [masonry, store], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ 'masonry->store': straight(1) }), inputPull: true });
  assert.equal(carts(result, 'intake').length, 0);
});
