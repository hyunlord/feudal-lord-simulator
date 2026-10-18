/**
 * CONVERTER-FEED (the user's ruling 2026-10-18): in lord mode the sawmill and the malt kiln are `INPUT_PULL` converters, as
 * the masonry — an intake cart brings the input while the main cart carries the output out; elsewhere one cart as before.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnCarters } from '../src/agents/delivery';
import { inputReorderPoint } from '../src/agents/deliverySpawn';
import type { BuildingKind } from '../src/content/buildingConfig';
import { INPUT_PULL } from '../src/content/recoveryConfig';
import { building, DELIVERY_INVENTORY, routePort } from './deliveryFixtures';

const straight = (tiles: number) => Array.from({ length: tiles }, (_, index) => ({ tx: index, ty: 0 }));
const cases = [
  { converter: 'sawmill', input: 'logs', output: 'timber', held: 3, floor: 2, store: 'storehouse' },
  { converter: 'malt_kiln', input: 'barley', output: 'malt', held: 2, floor: 1, store: 'granary' },
] as const;

for (const { converter, input, output, held, floor, store: storeKind } of cases) {
  const chain = INPUT_PULL.chains.find(entry => entry.converter === converter)!;
  test(`CONVERTER-FEED ${converter}: reorders ${input} by its round trip, never below ${floor}`, () => {
    assert.ok(inputReorderPoint(chain, 1) >= floor);
    assert.ok(inputReorderPoint(chain, 30) > inputReorderPoint(chain, 1), `${inputReorderPoint(chain, 30)}`);
  });
  test(`CONVERTER-FEED ${converter}: a far one whose cart carries its ${output} out still gets ${input} by an intake cart in lord mode; without the pull none`, () => {
    const home = building('home', converter as BuildingKind, { inventory: { [input]: held, [output]: 6 } });
    const store = building('store', storeKind, { inventory: { [input]: 100 } });
    const routes = routePort({ 'home->store': straight(30) });
    const step = (inputPull: boolean) => spawnCarters({ tick: 1, buildings: [home, store], walkers: [], inventory: DELIVERY_INVENTORY, routes, inputPull });
    const intake = (result: ReturnType<typeof spawnCarters>) => result.walkers.filter(walker => walker.kind === 'carter' && walker.homeBuildingId === 'home' && walker.cart === 'intake');
    assert.equal(intake(step(false)).length, 0);
    assert.ok(intake(step(true)).length >= 1);
  });
}
