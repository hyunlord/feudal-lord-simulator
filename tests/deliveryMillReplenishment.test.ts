import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnCarters } from '../src/agents/delivery';
import { building, DELIVERY_INVENTORY, line, routePort } from './deliveryFixtures';

test('a mill with only one recipe refills before committing its carter to bread delivery', () => {
  const mill = building('mill', 'mill', { inventory: { wheat: 2, bread: 4 } });
  const store = building('store', 'granary', { inventory: { wheat: 40 } });
  const result = spawnCarters({ tick: 1, buildings: [mill, store], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ 'mill->store': line([0, 0], [1, 0], [2, 0]) }) });
  const carter = result.walkers[0];
  assert.ok(carter?.kind === 'carter');
  assert.equal(carter.mission, 'fetch');
  assert.equal(result.buildings.find(b => b.id === mill.id)?.inventory.bread, 4);
  assert.equal(result.buildings.find(b => b.id === store.id)?.stockReserved.wheat, 8);
  assert.equal(result.walkers.length, 1);
});

test('a full input batch leaves the mill carter free to deliver bread', () => {
  const mill = building('mill', 'mill', { inventory: { wheat: 8, bread: 4 } });
  const store = building('store', 'granary', { inventory: { wheat: 40 } });
  const result = spawnCarters({ tick: 1, buildings: [mill, store], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ 'mill->store': line([0, 0], [1, 0]) }) });
  const carter = result.walkers[0];
  assert.ok(carter?.kind === 'carter');
  assert.equal(carter.mission, 'deliver');
  assert.deepEqual(carter.cargo, { resource: 'bread', amount: 4 });
});

for (const condition of ['unavailable-input', 'full-home', 'other-converter'] as const) {
  test(`early mill refill preserves delivery when ${condition}`, () => {
    const isOther = condition === 'other-converter';
    const producer = building('producer', isOther ? 'sawmill' : 'mill', {
      inventory: isOther ? { logs: 2, timber: 4 } : { wheat: 2, bread: condition === 'full-home' ? 18 : 4 },
    });
    const store = building('store', isOther ? 'storehouse' : 'granary', {
      inventory: isOther ? { logs: 40 } : { wheat: condition === 'unavailable-input' ? 0 : 40 },
    });
    const result = spawnCarters({ tick: 1, buildings: [producer, store], walkers: [], inventory: DELIVERY_INVENTORY,
      routes: routePort({ 'producer->store': line([0, 0], [1, 0]) }) });
    const carter = result.walkers[0];
    assert.ok(carter?.kind === 'carter');
    assert.equal(carter.mission, 'deliver');
  });
}

test('normal production and a single carter conserve grain while repeatedly delivering real bread', async () => {
  const { stepCarters } = await import('../src/agents/delivery');
  const { stepProduction } = await import('../src/economy/production');
  const { BUILDING_CONFIG_BY_KIND } = await import('../src/content/buildingConfig');
  const mill = { ...building('mill', 'mill', { inventory: { wheat: 2, bread: 4 } }), workers: 2 };
  const store = building('store', 'granary', { inventory: { wheat: 40 } });
  const path = line([0, 0], [1, 0], [2, 0]);
  const routes = routePort({ 'mill->store': path, 'store->mill': [...path].reverse(),
    ...Object.fromEntries(path.map((tile, index) => [`${tile.tx},${tile.ty}->mill`, path.slice(0, index + 1).reverse()])) });
  let result = spawnCarters({ tick: 0, buildings: [mill, store], walkers: [], inventory: DELIVERY_INVENTORY, routes });
  let produced = 0;
  for (let tick = 1; tick <= 1200; tick += 1) {
    result = { ...result, buildings: result.buildings.map(b => {
      if (b.kind !== 'mill') return b;
      const next = stepProduction(b, BUILDING_CONFIG_BY_KIND.mill);
      if (next.produced === 'bread') produced += 1;
      return next.building;
    }) };
    result = stepCarters({ tick, buildings: result.buildings, walkers: result.walkers, inventory: DELIVERY_INVENTORY, routes });
    result = spawnCarters({ tick, buildings: result.buildings, walkers: result.walkers, inventory: DELIVERY_INVENTORY, routes });
    assert.ok(result.walkers.length <= 1);
    const units = result.buildings.reduce((sum, b) => sum + (b.inventory.wheat ?? 0) + 2 * (b.inventory.bread ?? 0), 0)
      + result.walkers.reduce((sum, w) => sum + (w.cargo === null ? 0 : w.cargo.amount * (w.cargo.resource === 'bread' ? 2 : 1)), 0);
    assert.equal(units, 50);
  }
  assert.ok(produced >= 18);
  assert.ok((result.buildings.find(b => b.id === store.id)?.inventory.bread ?? 0) >= 20);
});

test('competing mills cannot reserve the same early refill grain twice', () => {
  const mills = ['a', 'b'].map(id => building(id, 'mill', { inventory: { wheat: 2, bread: 4 } }));
  const store = building('store', 'granary', { inventory: { wheat: 8 } });
  const result = spawnCarters({ tick: 1, buildings: [...mills, store], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ 'a->store': line([0, 0], [1, 0]), 'b->store': line([2, 0], [1, 0]) }) });
  assert.equal(result.buildings.find(b => b.id === store.id)?.stockReserved.wheat, 8);
  const first = result.walkers.find(w => w.kind === 'carter' && w.homeBuildingId === 'a');
  const second = result.walkers.find(w => w.kind === 'carter' && w.homeBuildingId === 'b');
  assert.ok(first?.kind === 'carter' && second?.kind === 'carter');
  assert.equal(first.mission, 'fetch');
  assert.equal(second.mission, 'deliver');
  assert.equal(result.walkers.length, 2);
});

test('a mill sends a full finished bread batch before fetching into its remaining two slots', async () => {
  const { stepProduction } = await import('../src/economy/production');
  const { BUILDING_CONFIG_BY_KIND } = await import('../src/content/buildingConfig');
  let mill = { ...building('mill', 'mill', { inventory: { wheat: 4, bread: 16 } }), workers: 2 };
  for (let tick = 0; tick < 60; tick += 1) {
    mill = stepProduction(mill, BUILDING_CONFIG_BY_KIND.mill).building;
  }
  assert.deepEqual(mill.inventory, { wheat: 0, bread: 18 });
  const store = building('store', 'granary', { inventory: { wheat: 40 } });
  const result = spawnCarters({ tick: 241, buildings: [mill, store], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ 'mill->store': line([0, 0], [1, 0]) }) });
  const carter = result.walkers[0];
  assert.ok(carter?.kind === 'carter');
  assert.equal(carter.mission, 'deliver');
  assert.deepEqual(carter.cargo, { resource: 'bread', amount: 8 });
  assert.equal(result.buildings.find(b => b.id === store.id)?.stockReserved.wheat ?? 0, 0);
});

test('a finished mill batch still refills when every bread destination is full', () => {
  const mill = building('mill', 'mill', { inventory: { wheat: 0, bread: 8 } });
  const store = building('store', 'granary', { inventory: { wheat: 100, bread: 100 } });
  const result = spawnCarters({ tick: 1, buildings: [mill, store], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ 'mill->store': line([0, 0], [1, 0]) }) });
  const carter = result.walkers[0];
  assert.ok(carter?.kind === 'carter');
  assert.equal(carter.mission, 'fetch');
  assert.equal(result.buildings.find(b => b.id === store.id)?.stockReserved.wheat, 8);
});
