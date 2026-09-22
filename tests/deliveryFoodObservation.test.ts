import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnCarters, stepCarters } from '../src/agents/delivery';
import { building, DELIVERY_INVENTORY, line, routePort } from './deliveryFixtures';

test('actual grain deposit observation is optional and does not change delivery state', () => {
  const farm = building('farm', 'wheat_farm', { inventory: { wheat: 8 } });
  const store = building('store', 'granary');
  const path = line([0, 0], [1, 0]);
  const routes = routePort({ 'farm->store': path, 'store->farm': [...path].reverse(),
    '0,0->farm': line([0, 0]), '1,0->farm': [...path].reverse() });
  const initial = spawnCarters({ tick: 0, buildings: [farm, store], walkers: [], inventory: DELIVERY_INVENTORY, routes });
  let ordinary = initial;
  let observed = initial;
  const deposits: number[] = [];
  for (let tick = 1; tick <= 30; tick += 1) {
    ordinary = stepCarters({ tick, buildings: ordinary.buildings, walkers: ordinary.walkers, inventory: DELIVERY_INVENTORY, routes });
    observed = stepCarters({ tick, buildings: observed.buildings, walkers: observed.walkers, inventory: DELIVERY_INVENTORY, routes,
      buildingDelivery: event => { assert.equal(event.homeBuildingId, farm.id); assert.equal(event.destinationBuildingId, store.id);
        assert.equal(event.resource, 'wheat'); deposits.push(event.amount); } });
    assert.deepEqual(observed, ordinary);
  }
  assert.deepEqual(deposits, [8]);
  assert.equal(observed.buildings.find(b => b.id === store.id)?.inventory.wheat, 8);
});
