/**
 * RECOVER-1 (spec docs/design/recovery.md RC-5): in lord mode the short side pulls — a mill reorders wheat by its round
 * trip (× the margin, never below the old 12) and sends more intake carts on a long one; elsewhere LB-7 is unchanged.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnCarters } from '../src/agents/delivery';
import { millIntakeCarts, millReorderPoint } from '../src/agents/deliverySpawn';
import { BALANCE, LABOUR_BALANCE } from '../src/content/balanceConfig';
import { MILL_PULL } from '../src/content/recoveryConfig';
import { building, DELIVERY_INVENTORY, routePort } from './deliveryFixtures';

const straight = (tiles: number) => Array.from({ length: tiles }, (_, index) => ({ tx: index, ty: 0 }));

test('RC-5 the reorder point is the wheat ground during a round trip × the margin, never below 12; carts cover it up to the cap', () => {
  assert.equal(millReorderPoint(1), LABOUR_BALANCE.millWheatTarget, 'a mill beside its wheat keeps the old 12');
  const far = millReorderPoint(25);
  assert.equal(far, Math.ceil(2 * 25 / BALANCE.CARTER_SPEED * 2 / 30 * MILL_PULL.marginPermille / 1000));
  assert.ok(far > 30, `${far}`);
  assert.equal(millIntakeCarts(12), 1);
  assert.equal(millIntakeCarts(far), Math.min(MILL_PULL.maxIntakeCarts, Math.ceil(far / LABOUR_BALANCE.millCartCapacity)));
  assert.equal(millIntakeCarts(10_000), MILL_PULL.maxIntakeCarts);
});

test('RC-5 in lord mode a far mill with 14 wheat sends intake carts until its reorder point is covered; LB-7 sends none', () => {
  const mill = building('mill', 'mill', { inventory: { wheat: 14 } });
  const barn = building('store', 'granary', { inventory: { wheat: 400 } });
  const routes = routePort({ 'mill->store': straight(25) });
  const pull = (walkers: Parameters<typeof spawnCarters>[0]['walkers'], buildings = [mill, barn]) =>
    spawnCarters({ tick: 1, buildings, walkers, inventory: DELIVERY_INVENTORY, routes, millPull: true });
  const intakeCount = (result: ReturnType<typeof spawnCarters>) => result.walkers.filter(walker => walker.kind === 'carter' && walker.cart === 'intake').length;
  // LB-7: 14 ≥ 12, no intake cart.
  assert.equal(intakeCount(spawnCarters({ tick: 1, buildings: [mill, barn], walkers: [], inventory: DELIVERY_INVENTORY, routes })), 0);
  // Pull: one cart a tick while the wheat held and coming stays under the reorder point and the carts under the cap.
  let result = pull([]);
  assert.equal(intakeCount(result), 1);
  for (let tick = 0; tick < 5; tick += 1) result = pull(result.walkers, [...result.buildings]);
  // The wheat held and coming covers the round trip as far as the mill's room allows (more than one cart's load).
  const coming = result.buildings.find(entry => entry.id === 'mill')!.reserved.wheat ?? 0;
  assert.ok(intakeCount(result) >= 2 && intakeCount(result) <= MILL_PULL.maxIntakeCarts, `${intakeCount(result)} carts`);
  assert.ok(coming > LABOUR_BALANCE.millCartCapacity, `${coming} coming`);
  const grindTicks = (14 + coming) / (2 / 30);
  assert.ok(grindTicks >= 2 * 25 / BALANCE.CARTER_SPEED, `${Math.round(grindTicks)} ticks of grinding cover the ${Math.round(2 * 25 / BALANCE.CARTER_SPEED)}-tick round trip`);
});

test('RC-5 a mill next to its wheat keeps one cart and the old target under pull', () => {
  const mill = building('mill', 'mill', { inventory: { wheat: 14 } });
  const barn = building('store', 'granary', { inventory: { wheat: 400 } });
  const result = spawnCarters({ tick: 1, buildings: [mill, barn], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ 'mill->store': straight(2) }), millPull: true });
  assert.equal(result.walkers.filter(walker => walker.kind === 'carter' && walker.cart === 'intake').length, 0);
});
